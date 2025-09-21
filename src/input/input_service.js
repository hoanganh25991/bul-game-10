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
    try { raycast.updateMouseNDC(e); } catch (_) {}
    const p = raycast.raycastGround?.();
    if (p) {
      state.lastMouseGroundPoint.copy(p);
    }
    // Aiming removed
    // Capture only updates state; do not stopPropagation to allow hover elsewhere
  }

  function onMouseDownCapture(e) {
    // Right-click or left-click selection/aim confirm – we will handle here, and stop propagation
    try { raycast.updateMouseNDC(e); } catch (_) {}

    // Frozen/click through to portal UI
    if (player.frozen) {
      e.preventDefault(); e.stopImmediatePropagation();
      try { portals.handleFrozenPortalClick(raycast, camera, player, () => {}); } catch (_) {}
      return;
    }

    if (e.button === 2) {
      // Right click: move or select
      e.preventDefault(); e.stopImmediatePropagation();
      try {
        const obj = raycast.raycastEnemyOrGround?.();
        if (obj && obj.type === "enemy") {
          effects.spawnTargetPing(obj.enemy);
          // Manual selection
          // Note: selection ring follows selectedUnit in main; keep minimal here
        } else {
          const p = raycast.raycastGround?.();
          if (p) {
            player.moveTarget = p.clone();
            player.target = null;
            player.attackMove = false;
            effects.spawnMovePing(p);
          }
        }
      } catch (_) {}
      return;
    }

    if (e.button === 0) {
      // Left click: aim confirm or selection
      e.preventDefault(); e.stopImmediatePropagation();
      try {
        const obj = raycast.raycastPlayerOrEnemyOrGround?.();
        // Selection only (no auto-attack/move)
        if (obj && obj.type === "enemy") {
          effects.spawnTargetPing(obj.enemy);
        } else if (obj && obj.type === "ground" && DEBUG && obj.point) {
          if (!player.frozen) {
            player.moveTarget = obj.point.clone();
            player.target = null;
            effects.spawnMovePing(obj.point);
          }
        }
      } catch (_) {}
      return;
    }
  }

  // ---- Public API ----
  function attachCaptureListeners() {
    // Keyboard (capture)
    window.addEventListener("keydown", onKeyDownCapture, true);
    window.addEventListener("keyup", onKeyUpCapture, true);
    // Mouse on renderer (capture)
    renderer?.domElement?.addEventListener("mousemove", onMouseMoveCapture, true);
    renderer?.domElement?.addEventListener("mousedown", onMouseDownCapture, true);
  }

  function detachListeners() {
    window.removeEventListener("keydown", onKeyDownCapture, true);
    window.removeEventListener("keyup", onKeyUpCapture, true);
    renderer?.domElement?.removeEventListener("mousemove", onMouseMoveCapture, true);
    renderer?.domElement?.removeEventListener("mousedown", onMouseDownCapture, true);
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

    // Touch joystick or keyboard arrows for movement
    let moved = false;
    if (state.touch && typeof state.touch.getMoveDir === "function") {
      const joy = state.touch.getMoveDir();
      if (joy.active && !player.frozen) {
        const ahead = 26;
        const px = player.pos().x + joy.x * ahead;
        const pz = player.pos().z + joy.y * ahead;
        player.moveTarget = new THREE.Vector3(px, 0, pz);
        player.attackMove = false;
        player.target = null;
        moved = true;
      }
    }
    if (!moved) {
      const km = getKeyMoveDir();
      if (km.active && !player.frozen) {
        const ahead = 26;
        const px = player.pos().x + km.x * ahead;
        const pz = player.pos().z + km.y * ahead;
        player.moveTarget = new THREE.Vector3(px, 0, pz);
        player.attackMove = false;
        player.target = null;
      }
    }
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
