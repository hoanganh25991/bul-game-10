/**
 * Mobile Touch Controls for Zeus RPG
 * - Virtual joystick bottom-left for movement and AOE aim steering
 * - Skill wheel bottom-right: center = basic/attack-aim, Q/W/E/R around
 * - Cancel button near joystick to cancel current aim
 *
 * Integration contract (from main.js):
 *   import { initTouchControls } from "./touch.js";
 *   const touch = initTouchControls({ player, skills, effects, aimPreview, attackPreview });
 *   // In animate():
 *   const joy = touch.getMoveDir();
 *   if (!player.frozen && !player.aimMode && joy.active) {
 *     // drive moveTarget continuously towards joystick direction
 *     const speed = 30; // target distance ahead
 *     const px = player.pos().x + joy.x * speed;
 *     const pz = player.pos().z + joy.y * speed;
 *     player.moveTarget = new THREE.Vector3(px, 0, pz);
 *     player.attackMove = false;
 *     player.target = null;
 *   }
 *
 * Notes:
 * - When W (AOE) is active in aim mode, joystick steers the aimPreview around the player.
 * - Tapping W while in aim mode confirms the cast at current aim position.
 * - Cancel button exits aim mode.
 */

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

export function initTouchControls({ player, skills, effects, aimPreview, attackPreview, enemies, getNearestEnemy, WORLD }) {
  const els = {
    joystick: document.getElementById("joystick"),
    joyBase: document.getElementById("joyBase"),
    joyKnob: document.getElementById("joyKnob"),
    btnCancelAim: document.getElementById("btnCancelAim"),
    btnBasic: document.getElementById("btnBasic"),
    btnQ: document.getElementById("btnSkillQ"),
    btnW: document.getElementById("btnSkillW"),
    btnE: document.getElementById("btnSkillE"),
    btnR: document.getElementById("btnSkillR"),
  };

  // Hide entire mobile controls on non-touch (optional heuristic)
  if (!("ontouchstart" in window) && els.joystick && els.joystick.parentElement) {
    // Keep visible to allow testing on desktop if desired – comment out to auto-hide:
    // els.joystick.parentElement.style.display = "none";
  }

  const joyState = {
    active: false,
    x: 0, // right = +1
    y: 0, // down = +1 (we will invert for world Z forward)
    _pointerId: null,
    _center: { x: 0, y: 0 },
    _radius: 0,
  };

  let lastAimPos = new THREE.Vector3(); // stores last computed aim position

  // Mini-joystick drag on W button for AOE placement
  const wDrag = {
    active: false,
    center: { x: 0, y: 0 },
    radiusPx: 56,
    _pointerId: null,
    didDrag: false,
  };

  // Hold-to-cast state for touch buttons
  const holdState = { basic: false, skillQ: false, skillW: false, skillE: false, skillR: false };
  let wDownAt = 0;
  function clearHolds() {
    holdState.basic = holdState.skillQ = holdState.skillW = holdState.skillE = holdState.skillR = false;
    wDownAt = 0;
  }
  window.addEventListener("pointerup", clearHolds);
  window.addEventListener("pointercancel", clearHolds);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearHolds(); });

  // Initialize geometry for joystick base
  function computeBase() {
    if (!els.joyBase) return;
    const rect = els.joyBase.getBoundingClientRect();
    joyState._center.x = rect.left + rect.width / 2;
    joyState._center.y = rect.top + rect.height / 2;
    joyState._radius = Math.min(rect.width, rect.height) * 0.45;
  }

  // Place knob visual given dx,dy (screen space)
  function placeKnob(dx, dy) {
    if (!els.joyKnob) return;
    els.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Reset knob to center
  function resetKnob() {
    placeKnob(0, 0);
  }

  // Convert pointer location to normalized dir within base
  function updateJoyFromPointer(clientX, clientY) {
    const dx = clientX - joyState._center.x;
    const dy = clientY - joyState._center.y;
    const len = Math.hypot(dx, dy);
    const maxLen = joyState._radius || 1;
    const clamped = Math.min(len, maxLen);
    const nx = (clamped === 0 ? 0 : dx / len) || 0;
    const ny = (clamped === 0 ? 0 : dy / len) || 0;
    const vx = nx * (clamped / maxLen);
    const vy = ny * (clamped / maxLen);
    joyState.x = vx;
    joyState.y = vy;
    placeKnob(vx * maxLen, vy * maxLen);
  }

  function onPointerDown(e) {
    if (joyState._pointerId !== null) return; // already tracking
    joyState._pointerId = e.pointerId;
    joyState.active = true;
    computeBase();
    updateJoyFromPointer(e.clientX, e.clientY);
    (e.target).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (joyState._pointerId !== e.pointerId) return;
    updateJoyFromPointer(e.clientX, e.clientY);
    // Joystick no longer steers W AOE; only ensure attack preview hidden
    if (attackPreview) attackPreview.visible = false;
  }
  function onPointerUp(e) {
    if (joyState._pointerId !== e.pointerId) return;
    joyState._pointerId = null;
    joyState.active = false;
    joyState.x = 0;
    joyState.y = 0;
    resetKnob();
    (e.target).releasePointerCapture?.(e.pointerId);
  }

  if (els.joyBase) {
    els.joyBase.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", computeBase);

    // Mini-joystick drag handlers on W (AOE placement)
    function updateWAimFromPointer(x, y) {
      if (!wDrag.active) return;
      const dx = x - wDrag.center.x;
      const dy = y - wDrag.center.y;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, wDrag.radiusPx);
      const nx = len ? dx / len : 0;
      const nz = len ? dy / len : 0;
      if (clamped > 6) wDrag.didDrag = true;

      // Map drag distance to world distance (cap to ~20 units)
      const maxWorld = 20;
      const worldDist = (clamped / wDrag.radiusPx) * maxWorld;

      const aim = computeAimPositionFromVector(nx, nz, worldDist);
      lastAimPos.copy(aim);
      if (aimPreview) {
        aimPreview.visible = true;
        aimPreview.position.set(aim.x, 0.02, aim.z);
      }
    }

    window.addEventListener("pointermove", (e) => {
      if (!wDrag.active) return;
      updateWAimFromPointer(e.clientX, e.clientY);
    });
    window.addEventListener("pointerup", (e) => {
      if (wDrag.active && e.pointerId === wDrag._pointerId) {
        try { els.btnW.releasePointerCapture?.(e.pointerId); } catch (_) {}
        wDrag.active = false;
        wDrag._pointerId = null;
      }
    });
    window.addEventListener("pointercancel", (e) => {
      if (wDrag.active && e.pointerId === wDrag._pointerId) {
        wDrag.active = false;
        wDrag._pointerId = null;
      }
    });

    computeBase();
  }
  if (els.joyKnob) {
    els.joyKnob.addEventListener("pointerdown", onPointerDown);
  }

  // Helpers
  function computeAimPositionFromJoystick(distance = 20) {
    // World X maps from joystick x; world Z maps directly from joystick y
    // Joystick up (negative screen Y) should map to negative world Z direction if needed,
    // but we keep a direct mapping: screen-up -> negative joyState.y already handled by updateJoyFromPointer.
    const dirX = joyState.x;
    const dirZ = joyState.y;
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    const base = player.pos();
    return new THREE.Vector3(base.x + nx * distance, 0, base.z + nz * distance);
  }

  // AOE aim from arbitrary 2D vector (nx, nz should be normalized)
  function computeAimPositionFromVector(nx, nz, distance = 20) {
    const base = player.pos();
    return new THREE.Vector3(base.x + nx * distance, 0, base.z + nz * distance);
  }

  function cancelAim() {
    player.aimMode = false;
    player.aimModeSkill = null;
    if (aimPreview) aimPreview.visible = false;
    if (attackPreview) attackPreview.visible = false;
    if (els.btnCancelAim) els.btnCancelAim.classList.add("hidden");
    // restore pointer cursor if needed (no-op on touch)
    try { document.body.style.cursor = "default"; } catch {}
  }

  if (els.btnCancelAim) {
    els.btnCancelAim.addEventListener("click", () => {
      cancelAim();
    });
  }

  // Hold (continuous cast) bindings for touch buttons
  if (els.btnBasic) {
    els.btnBasic.addEventListener("pointerdown", () => { holdState.basic = true; });
  }
  if (els.btnQ) {
    els.btnQ.addEventListener("pointerdown", () => { holdState.skillQ = true; });
  }
  if (els.btnW) {
    els.btnW.addEventListener("pointerdown", (e) => {
      // In W aim mode: turn the W button into a mini-joystick for AOE placement
      if (player.aimMode && player.aimModeSkill === "W") {
        const rect = els.btnW.getBoundingClientRect();
        wDrag.center.x = rect.left + rect.width / 2;
        wDrag.center.y = rect.top + rect.height / 2;
        wDrag.radiusPx = Math.min(64, Math.max(44, Math.min(rect.width, rect.height) * 0.65));
        wDrag._pointerId = e.pointerId;
        wDrag.active = true;
        wDrag.didDrag = false;
        e.target.setPointerCapture?.(e.pointerId);
        e.preventDefault();
      } else {
        // normal hold-to-cast behavior when not in aim mode
        holdState.skillW = true;
        wDownAt = performance.now ? performance.now() : Date.now();
      }
    });
  }
  if (els.btnE) {
    els.btnE.addEventListener("pointerdown", () => { holdState.skillE = true; });
  }
  if (els.btnR) {
    els.btnR.addEventListener("pointerdown", () => { holdState.skillR = true; });
  }

  // Skill wheel actions
  if (els.btnBasic) {
    els.btnBasic.addEventListener("click", () => {
      // Mobile "A" / Basic button: attempt immediate basic attack on nearest enemy.
      if (player.frozen) return;
      try {
        const nearest = (typeof getNearestEnemy === "function")
          ? getNearestEnemy(player.pos(), WORLD.attackRange * (WORLD.attackRangeMult || 1), enemies)
          : null;
        if (nearest) {
          // select and perform basic attack immediately
          player.target = nearest;
          player.moveTarget = null;
          try {
            const d = Math.hypot(player.pos().x - nearest.pos().x, player.pos().z - nearest.pos().z);
            player.attackMove = d > (WORLD.attackRange * (WORLD.attackRangeMult || 1)) * 0.95;
          } catch (err) {
            player.attackMove = false;
          }
          effects?.spawnTargetPing?.(nearest);
          try { skills.tryBasicAttack(player, nearest); } catch (err) { /* ignore */ }
        } else {
          // No nearby enemy: do nothing (do not enter aim mode)
        }
      } catch (e) {
        // fail silently
      }
    });
  }
  if (els.btnQ) {
    els.btnQ.addEventListener("click", () => {
      // Instant cast - prefer generic castSkill if available
      if (typeof skills.castSkill === "function") {
        skills.castSkill("Q");
      } else if (typeof skills.castQ_ChainLightning === "function") {
        skills.castQ_ChainLightning();
      }
    });
  }
  if (els.btnW) {
    els.btnW.addEventListener("click", () => {
      // Ignore click if this was a drag interaction or long-press
      const nowTs = performance.now ? performance.now() : Date.now();
      if (wDrag.didDrag) { wDrag.didDrag = false; return; }
      if (wDownAt && nowTs - wDownAt > 250) { wDownAt = 0; return; }
      wDownAt = 0;

      if (player.aimMode && player.aimModeSkill === "W") {
        // Confirm cast at current aim (if we have a lastAimPos; else keep previous)
        const pos = (lastAimPos && isFinite(lastAimPos.x)) ? lastAimPos.clone() : computeAimPositionFromJoystick();
        if (typeof skills.castSkill === "function") {
          skills.castSkill("W", pos);
        } else if (typeof skills.castW_AOE === "function") {
          skills.castW_AOE(pos);
        }
        effects?.spawnMovePing?.(pos, 0x9fd8ff);
        cancelAim();
      } else {
        // Enter aim mode for W; initial aim ahead of player
        player.aimMode = true;
        player.aimModeSkill = "W";
        if (els.btnCancelAim) els.btnCancelAim.classList.remove("hidden");
        const pos = computeAimPositionFromJoystick();
        lastAimPos.copy(pos);
        if (aimPreview) {
          aimPreview.visible = true;
          aimPreview.position.set(pos.x, 0.02, pos.z);
        }
      }
    });
  }
  if (els.btnE) {
    els.btnE.addEventListener("click", () => {
      if (typeof skills.castSkill === "function") {
        skills.castSkill("E");
      } else if (typeof skills.castE_StaticField === "function") {
        skills.castE_StaticField();
      }
    });
  }
  if (els.btnR) {
    els.btnR.addEventListener("click", () => {
      if (typeof skills.castSkill === "function") {
        skills.castSkill("R");
      } else if (typeof skills.castR_Thunderstorm === "function") {
        skills.castR_Thunderstorm();
      }
    });
  }

  return {
    getMoveDir() {
      return { active: joyState.active, x: joyState.x, y: joyState.y }; // map to world (x, z)
    },
    cancelAim,
    getHoldState() {
      if (!holdState.basic && !holdState.skillQ && !holdState.skillW && !holdState.skillE && !holdState.skillR) return null;
      const state = Object.assign({}, holdState);
      if (holdState.skillW) {
        // Provide a target point for W casts while holding
        const pos = (lastAimPos && isFinite(lastAimPos.x)) ? lastAimPos.clone() : computeAimPositionFromJoystick();
        state.wPoint = pos;
      }
      return state;
    }
  };
}
