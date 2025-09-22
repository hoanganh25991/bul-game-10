/**
 * Hexagonal Input Service (Ports & Adapters)
 *
 * Purpose:
 * - Define an application service that translates UI/Device inputs (keyboard, mouse, touch)
 *   into domain actions (move, basic attack, cast skills, aim/confirm AOE).
 * - Adapters (keyboard, mouse, touch) feed events into this service via attachCaptureListeners.
 * - Main loop calls inputService.update(t, dt) to process continuous holds/movement.
 *
 * Non-goals (initial cut):
 * - Full removal of all listeners from main.js (will be phased out after verifying behavior).
 * - Perfect separation yet — this is the first refactor step towards hexagonal input.
 */

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { distance2D, dir2D, now } from "../utils.js";

export function createInputService({
  renderer,
  raycast,
  camera,
  portals,
  player,
  enemies,
  effects,
  skills,
  WORLD,
  DEBUG,
}) {
  // ---- Internal State ----
  const state = {
    holdA: false,
    moveKeys: { up: false, down: false, left: false, right: false },
    lastMouseGroundPoint: new THREE.Vector3(),
    touch: null, // optional adapter from touch.js
    // movement release handling
    prevKeyActive: false,
    prevJoyActive: false,
    lastDir: { x: 0, y: 0 }, // last movement direction (normalized)
    stopUntil: 0,            // time until which we keep short glide
    lastMoveSource: null,    // 'joy' | 'keys' | 'order' (explicit click/tap)
  };

  // ---- Helpers ----
  function effectiveRange() {
    return WORLD.attackRange * (WORLD.attackRangeMult || 1);
  }

  function getKeyMoveDir() {
    const x = (state.moveKeys.right ? 1 : 0) + (state.moveKeys.left ? -1 : 0);
    const y = (state.moveKeys.down ? 1 : 0) + (state.moveKeys.up ? -1 : 0);
    const len = Math.hypot(x, y);
    if (len === 0) return { active: false, x: 0, y: 0 };
    return { active: true, x: x / len, y: y / len };
  }

  function attemptAutoBasic() {
    if (!player.alive || player.frozen) return;
    try {
      const effRange = effectiveRange();
      const nearest = getNearestEnemy(player.pos(), effRange, enemies);
      if (!nearest) return;
      player.target = nearest;
      player.moveTarget = null;
      try {
        const d = distance2D(player.pos(), nearest.pos());
        player.attackMove = d > effRange * 0.95;
      } catch (err) {
        player.attackMove = false;
      }
      effects.spawnTargetPing(nearest);
      skills.tryBasicAttack(player, nearest);
    } catch (e) {}
  }

  function getNearestEnemy(origin, maxDist, list) {
    let best = null;
    let bestD = Infinity;
    for (const en of list) {
      if (!en.alive) continue;
      const d = distance2D(origin, en.pos());
      if (d <= maxDist && d < bestD) {
        best = en; bestD = d;
      }
    }
    return best;
  }

  function cancelAim() { /* no-op: aiming removed */ }

  // Check if the event occurred over the renderer canvas (even if covered by overlays)
  function isEventOverRenderer(e) {
    try {
      const el = renderer?.domElement;
      if (!el) return false;
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (Array.isArray(path) && path.includes(el)) return true;
      const rect = el.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    } catch (_) { return false; }
  }

  // ---- Adapters (Capture-phase) ----
  function onKeyDownCapture(e) {
    const kraw = e.key || "";
    const k = kraw.toLowerCase();

    // Movement keys (arrows) – prevent scroll and capture
    if (kraw === "ArrowUp" || kraw === "ArrowDown" || kraw === "ArrowLeft" || kraw === "ArrowRight") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (kraw === "ArrowUp") state.moveKeys.up = true;
      if (kraw === "ArrowDown") state.moveKeys.down = true;
      if (kraw === "ArrowLeft") state.moveKeys.left = true;
      if (kraw === "ArrowRight") state.moveKeys.right = true;
      return;
    }

    // Space: cast all skills (Q, W, E, R)
    if (e.code === "Space" || kraw === " " || k === " " || k === "space" || kraw === "Spacebar") {
      e.preventDefault(); e.stopImmediatePropagation();
      try {
        // Choose AOE point: mouse ground point > nearest enemy > forward of player
        let point = null;
        if (state.lastMouseGroundPoint && Number.isFinite(state.lastMouseGroundPoint.x)) {
          point = state.lastMouseGroundPoint.clone();
        } else {
          const nearest = getNearestEnemy(player.pos(), 9999, enemies);
          if (nearest) {
            point = nearest.pos().clone();
          } else {
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion);
            point = player.pos().clone().add(forward.multiplyScalar(10));
          }
        }
        try { skills.castSkill("Q"); } catch (_) {}
        try { skills.castSkill("W", point); } catch (_) {}
        // Only turn aura on; avoid toggling it off if already active
        if (!player.staticField?.active) { try { skills.castSkill("E"); } catch (_) {} }
        try { skills.castSkill("R"); } catch (_) {}
      } catch (_) {}
      return;
    }

    if (k === "a") {
      e.preventDefault(); e.stopImmediatePropagation();
      state.holdA = true;
      // Defensive: cancel any existing aim UI
      cancelAim();
      // Attempt immediate basic
      attemptAutoBasic();
      return;
    }

    // Skill keys, stop propagation so legacy handlers don't conflict
    if (k === "q") { e.preventDefault(); e.stopImmediatePropagation(); try { skills.castSkill("Q"); } catch(_) {} return; }
    if (k === "e") { e.preventDefault(); e.stopImmediatePropagation(); try { skills.castSkill("E"); } catch(_) {} return; }
    if (k === "r") { e.preventDefault(); e.stopImmediatePropagation(); try { skills.castSkill("R"); } catch(_) {} return; }

    if (k === "w") {
      e.preventDefault(); e.stopImmediatePropagation();
      try { skills.castSkill("W"); } catch(_) {}
      return;
    }

    if (k === "escape") {
      e.preventDefault(); e.stopImmediatePropagation();
      cancelAim();
      return;
    }

    if (k === "s") {
      e.preventDefault(); e.stopImmediatePropagation();
      // stopPlayer: cancel movement/attack orders
      player.moveTarget = null;
      player.attackMove = false;
      player.target = null;
      cancelAim();
      player.holdUntil = now() + 0.4;
      return;
    }

    if (k === "b") {
      e.preventDefault(); e.stopImmediatePropagation();
      portals.recallToVillage(player, (t) => {
        try { /* no-op center msg passthrough */ } catch (_) {}
      });
      return;
    }
  }

  function onKeyUpCapture(e) {
    const kraw = e.key || "";
    const k = kraw.toLowerCase();
    if (k === "a") {
      state.holdA = false;
      return;
    }
    if (kraw === "ArrowUp") state.moveKeys.up = false;
    if (kraw === "ArrowDown") state.moveKeys.down = false;
    if (kraw === "ArrowLeft") state.moveKeys.left = false;
    if (kraw === "ArrowRight") state.moveKeys.right = false;
  }

  function onMouseMoveCapture(e) {
    if (!isEventOverRenderer(e)) return;
    try { raycast.updateMouseNDC(e); } catch (_) {}
    const p = raycast.raycastGround?.();
    if (p) {
      state.lastMouseGroundPoint.copy(p);
    }
    // Aiming removed
    // Capture only updates state; do not stopPropagation to allow hover elsewhere
  }

  function onMouseDownCapture(e) {
    if (!isEventOverRenderer(e)) return;
    // Right-click or left-click selection/aim confirm – we will handle here, and stop propagation
    try { raycast.updateMouseNDC(e); } catch (_) {}

    // Frozen/click through to portal UI
    if (player.frozen) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      try { portals.handleFrozenPortalClick(raycast, camera, player, () => {}); } catch (_) {}
      return;
    }

    // Treat secondary click as right-click: real button 2 or Ctrl+Click (macOS)
    const isSecondary = e.button === 2 || (e.button === 0 && (e.ctrlKey || e.metaKey));
    if (isSecondary) {
      // Right click: move or select
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      try {
        const obj = raycast.raycastEnemyOrGround?.();
        if (obj && obj.type === "enemy") {
          // Set explicit target on right-clicking enemy (no auto-attack)
          player.target = obj.enemy;
          player.attackMove = false;
          effects.spawnTargetPing(obj.enemy);
        } else {
          const p = raycast.raycastGround?.();
          if (p) {
            player.moveTarget = p.clone();
            player.target = null;
            player.attackMove = false;
            state.lastMoveSource = "order";
            effects.spawnMovePing(p);
          }
        }
      } catch (_) {}
      return;
    }

    if (e.button === 0) {
      // Left click: basic attack on enemy; ignore ground
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      try {
        const obj = raycast.raycastPlayerOrEnemyOrGround?.();
        if (obj && obj.type === "enemy") {
          if (!player.frozen && obj.enemy && obj.enemy.alive) {
            // Set target and attempt immediate basic attack
            player.target = obj.enemy;
            player.moveTarget = null;
            try {
              const effRange = effectiveRange();
              const d = distance2D(player.pos(), obj.enemy.pos());
              player.attackMove = d > effRange * 0.95;
            } catch (_) {
              player.attackMove = false;
            }
            effects.spawnTargetPing(obj.enemy);
            try { skills.tryBasicAttack(player, obj.enemy); } catch (_) {}
          }
        } else {
          // ignore ground and player clicks (no move/order on left click)
        }
      } catch (_) {}
      return;
    }
  }

  function onContextMenuCapture(e) {
    if (!isEventOverRenderer(e)) return;
    try {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (player.frozen) {
        try { portals.handleFrozenPortalClick(raycast, camera, player, () => {}); } catch (_) {}
        return;
      }
      try { raycast.updateMouseNDC(e); } catch (_) {}
      // Treat contextmenu as a right-click action fallback (some browsers/devices)
      try {
        const obj = raycast.raycastEnemyOrGround?.();
        if (obj && obj.type === "enemy") {
          player.target = obj.enemy;
          player.attackMove = false;
          effects.spawnTargetPing(obj.enemy);
        } else {
          const p = raycast.raycastGround?.();
          if (p) {
            player.moveTarget = p.clone();
            player.target = null;
            player.attackMove = false;
            state.lastMoveSource = "order";
            effects.spawnMovePing(p);
          }
        }
      } catch (_) {}
    } catch (_) {}
  }

  // ---- Public API ----
  function attachCaptureListeners() {
    // Keyboard (capture)
    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keyup", onKeyUpCapture, true);
    // Mouse at window level (capture) so overlays cannot block; we gate by isEventOverRenderer
    window.addEventListener("mousemove", onMouseMoveCapture, true);
    window.addEventListener("mousedown", onMouseDownCapture, true);
    // Prevent native context menu only over the renderer
    window.addEventListener("contextmenu", onContextMenuCapture, true);
  }

  function detachListeners() {
    window.removeEventListener("keydown", onKeyDownCapture, true);
    window.removeEventListener("keyup", onKeyUpCapture, true);
    window.removeEventListener("mousemove", onMouseMoveCapture, true);
    window.removeEventListener("mousedown", onMouseDownCapture, true);
    window.removeEventListener("contextmenu", onContextMenuCapture, true);
  }

  function setTouchAdapter(touch) {
    state.touch = touch;
  }

  function update(t, dt) {
    // Continuous A-hold
    if (state.holdA) attemptAutoBasic();

    // Touch holds
    if (state.touch && typeof state.touch.getHoldState === "function") {
      const hold = state.touch.getHoldState();
      if (hold) {
        if (hold.basic) attemptAutoBasic();

        // Unified continuous casting for skills:
        // - If a held skill is AOE, touch.getHoldState() provides { aoeKey, aoePoint }.
        // - Non-AOE held skills cast instantly each frame (respecting internal cooldowns).
        const keys = ["Q", "W", "E", "R"];
        for (const k of keys) {
          if (!hold["skill" + k]) continue;
          if (hold.aoeKey === k) {
            const pos = hold.aoePoint || state.lastMouseGroundPoint || player.pos().clone().add(new THREE.Vector3(0, 0, 10));
            try { skills.castSkill(k, pos); } catch (_) {}
          } else {
            try { skills.castSkill(k); } catch (_) {}
          }
        }
      }
    }

    // Touch joystick or keyboard arrows for movement with short glide on release
    const tnow = now();

    let joyActive = false;
    if (state.touch && typeof state.touch.getMoveDir === "function") {
      const joy = state.touch.getMoveDir();
      if (joy.active && !player.frozen) {
        const ahead = 26;
        const px = player.pos().x + joy.x * ahead;
        const pz = player.pos().z + joy.y * ahead;
        player.moveTarget = new THREE.Vector3(px, 0, pz);
        player.attackMove = false;
        player.target = null;
        state.lastMoveSource = "joy";
        // record last dir normalized
        const len = Math.hypot(joy.x, joy.y) || 1;
        state.lastDir.x = joy.x / len;
        state.lastDir.y = joy.y / len;
        joyActive = true;
      }
    }

    const km = getKeyMoveDir();
    const keyActive = km.active && !player.frozen;
    if (keyActive) {
      const ahead = 26;
      const px = player.pos().x + km.x * ahead;
      const pz = player.pos().z + km.y * ahead;
      player.moveTarget = new THREE.Vector3(px, 0, pz);
      player.attackMove = false;
      player.target = null;
      state.lastMoveSource = "keys";
      // record last dir normalized
      state.lastDir.x = km.x;
      state.lastDir.y = km.y;
    }

    // Detect release transitions and schedule a short glide (0.1s)
    if (state.prevJoyActive && !joyActive) {
      state.stopUntil = Math.max(state.stopUntil, tnow + 0.1);
    }
    if (state.prevKeyActive && !keyActive) {
      state.stopUntil = Math.max(state.stopUntil, tnow + 0.1);
    }

    // If no active input, apply brief glide or stop immediately
    if (!joyActive && !keyActive) {
      const analogSource = state.lastMoveSource === "joy" || state.lastMoveSource === "keys";
      if (analogSource) {
        if (tnow < state.stopUntil && (state.lastDir.x !== 0 || state.lastDir.y !== 0) && !player.frozen) {
          // short glide using a small lead distance
          const aheadStop = 6;
          const px = player.pos().x + state.lastDir.x * aheadStop;
          const pz = player.pos().z + state.lastDir.y * aheadStop;
          player.moveTarget = new THREE.Vector3(px, 0, pz);
          player.attackMove = false;
          player.target = null;
        } else {
          // fully stop movement induced by analog input
          player.moveTarget = null;
          player.attackMove = false;
          state.lastMoveSource = null;
        }
      }
      // If lastMoveSource is "order" (explicit click/tap), do not override player.moveTarget here.
    }

    // Update prev flags
    state.prevJoyActive = joyActive;
    state.prevKeyActive = keyActive;
  }

  return {
    attachCaptureListeners,
    detachListeners,
    setTouchAdapter,
    update,
    // Expose for debugging
    _state: state,
  };
}
