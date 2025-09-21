/**
 * Mobile Touch Controls for Zeus RPG
 * - Virtual joystick bottom-left for movement
 * - Skill wheel bottom-right: center = basic, Q/W/E/R around
 * - Cancel button near joystick to cancel current aim
 *
 * Integration contract (from main.js):
 *   import { initTouchControls } from "./touch.js";
 *   const touch = initTouchControls({ player, skills, effects, aimPreview, attackPreview, enemies, getNearestEnemy, WORLD, SKILLS });
 *   // In animate():
 *   const joy = touch.getMoveDir();
 *   if (!player.frozen && !player.aimMode && joy.active) {
 *     const speed = 30; // target distance ahead
 *     const px = player.pos().x + joy.x * speed;
 *     const pz = player.pos().z + joy.y * speed;
 *     player.moveTarget = new THREE.Vector3(px, 0, pz);
 *     player.attackMove = false;
 *     player.target = null;
 *   }
 *
 * Notes:
 * - When a skill with type 'aoe' is active in aim mode, its own button becomes a mini-joystick for AOE placement.
 * - Tapping the same skill while in aim mode confirms the cast at current aim position.
 * - Cancel button exits aim mode.
 */

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

export function initTouchControls({ player, skills, effects, aimPreview, attackPreview, enemies, getNearestEnemy, WORLD, SKILLS }) {
  const els = {
    joystick: document.getElementById("joystick"),
    joyBase: document.getElementById("joyBase"),
    joyKnob: document.getElementById("joyKnob"),
    btnBasic: document.getElementById("btnBasic"),
    btnQ: document.getElementById("btnSkillQ"),
    btnW: document.getElementById("btnSkillW"),
    btnE: document.getElementById("btnSkillE"),
    btnR: document.getElementById("btnSkillR"),
  };

  const keyToButton = {
    Q: els.btnQ,
    W: els.btnW,
    E: els.btnE,
    R: els.btnR,
  };
  const skillKeys = ["Q", "W", "E", "R"];

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

  // Generic mini-joystick drag for AOE placement (for any AOE skill key)
  const aoeDrag = {
    active: false,
    key: null,
    center: { x: 0, y: 0 },
    radiusPx: 56,
    _pointerId: null,
    didDrag: false,
  };

  // Hold-to-cast state for touch buttons
  const holdState = { basic: false, skillQ: false, skillW: false, skillE: false, skillR: false };
  const downAt = { Q: 0, W: 0, E: 0, R: 0 };

  function clearHolds() {
    holdState.basic = holdState.skillQ = holdState.skillW = holdState.skillE = holdState.skillR = false;
    downAt.Q = downAt.W = downAt.E = downAt.R = 0;
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
    // Joystick does NOT steer any AOE aim; only ensure attack preview hidden
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
    computeBase();
  }
  if (els.joyKnob) {
    els.joyKnob.addEventListener("pointerdown", onPointerDown);
  }

  // Helpers
  function computeAimPositionFromJoystick(distance = 20) {
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

  function isAOE(key) {
    const def = SKILLS?.[key];
    return !!def && def.type === "aoe";
  }

  function cancelAim() {
    player.aimMode = false;
    player.aimModeSkill = null;
    if (aimPreview) aimPreview.visible = false;
    if (attackPreview) attackPreview.visible = false;
    try { document.body.style.cursor = "default"; } catch {}
  }


  // Mini-joystick drag handlers for AOE placement (for whichever key is active)
  function startAoeDrag(key, e) {
    const btn = keyToButton[key];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    aoeDrag.center.x = rect.left + rect.width / 2;
    aoeDrag.center.y = rect.top + rect.height / 2;
    aoeDrag.radiusPx = Math.min(64, Math.max(44, Math.min(rect.width, rect.height) * 0.65));
    aoeDrag._pointerId = e.pointerId;
    aoeDrag.active = true;
    aoeDrag.key = key;
    aoeDrag.didDrag = false;
    btn.setPointerCapture?.(e.pointerId);
  }

  function stopAoeDragIfMatch(e) {
    if (aoeDrag.active && e.pointerId === aoeDrag._pointerId) {
      try { keyToButton[aoeDrag.key]?.releasePointerCapture?.(e.pointerId); } catch {}
      aoeDrag.active = false;
      aoeDrag._pointerId = null;
      aoeDrag.key = null;
    }
  }

  function updateAoeAimFromPointer(x, y) {
    if (!aoeDrag.active) return;
    const dx = x - aoeDrag.center.x;
    const dy = y - aoeDrag.center.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, aoeDrag.radiusPx);
    const nx = len ? dx / len : 0;
    const nz = len ? dy / len : 0;
    if (clamped > 6) aoeDrag.didDrag = true;

    // Map drag distance to world distance (cap to ~20 units)
    const maxWorld = 20;
    // Increase sensitivity to 3x so smaller drags move the AOE farther (but still clamp to maxWorld)
    const worldDist = (clamped / aoeDrag.radiusPx) * maxWorld * 3;

    const aim = computeAimPositionFromVector(nx, nz, worldDist);
    lastAimPos.copy(aim);
    if (aimPreview) {
      aimPreview.visible = true;
      aimPreview.position.set(aim.x, 0.02, aim.z);
    }
  }

  window.addEventListener("pointermove", (e) => {
    if (!aoeDrag.active) return;
    updateAoeAimFromPointer(e.clientX, e.clientY);
  });
  window.addEventListener("pointerup", (e) => {
    stopAoeDragIfMatch(e);
  });
  window.addEventListener("pointercancel", (e) => {
    stopAoeDragIfMatch(e);
  });

  // Hold (continuous cast) bindings for touch buttons
  if (els.btnBasic) {
    els.btnBasic.addEventListener("pointerdown", () => { holdState.basic = true; });
  }
  // Pointerdown for skill buttons (generic)
  for (const key of skillKeys) {
    const btn = keyToButton[key];
    if (!btn) continue;
    btn.addEventListener("pointerdown", (e) => {
      if (player.aimMode && player.aimModeSkill === key && isAOE(key)) {
        startAoeDrag(key, e);
        e.preventDefault();
        return;
      }
      // normal hold-to-cast behavior when not in aim mode
      holdState["skill" + key] = true;
      downAt[key] = performance.now ? performance.now() : Date.now();
    });
  }

  // Skill wheel actions (generic)
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
          // No nearby enemy: do nothing
        }
      } catch (e) {
        // fail silently
      }
    });
  }

  // Click/tap handlers per skill key
  for (const key of skillKeys) {
    const btn = keyToButton[key];
    if (!btn) continue;
    btn.addEventListener("click", () => {
      // Ignore click if this was a drag interaction or long-press
      const nowTs = performance.now ? performance.now() : Date.now();
      if (aoeDrag.didDrag) { aoeDrag.didDrag = false; return; }
      if (downAt[key] && nowTs - downAt[key] > 250) { downAt[key] = 0; return; }
      downAt[key] = 0;

      const aoe = isAOE(key);
      if (player.aimMode && player.aimModeSkill === key && aoe) {
        // Confirm cast at current aim (if we have a lastAimPos; else compute default ahead)
        const pos = (lastAimPos && isFinite(lastAimPos.x)) ? lastAimPos.clone() : computeAimPositionFromJoystick();
        if (typeof skills.castSkill === "function") {
          skills.castSkill(key, pos);
        } else if (typeof skills.castW_AOE === "function" && key === "W") {
          // legacy fallback
          skills.castW_AOE(pos);
        }
        effects?.spawnMovePing?.(pos, 0x9fd8ff);
        cancelAim();
      } else if (aoe) {
        // Enter aim mode for this AOE key
        player.aimMode = true;
        player.aimModeSkill = key;
        const pos = computeAimPositionFromJoystick();
        lastAimPos.copy(pos);
        if (aimPreview) {
          aimPreview.visible = true;
          aimPreview.position.set(pos.x, 0.02, pos.z);
        }
      } else {
        // Non-AOE skills: instant cast
        if (typeof skills.castSkill === "function") {
          skills.castSkill(key);
        } else {
          // legacy fallbacks
          if (key === "Q" && typeof skills.castQ_ChainLightning === "function") return skills.castQ_ChainLightning();
          if (key === "E" && typeof skills.castE_StaticField === "function") return skills.castE_StaticField();
          if (key === "R" && typeof skills.castR_Thunderstorm === "function") return skills.castR_Thunderstorm();
        }
      }
    });
  }

  return {
    getMoveDir() {
      return { active: joyState.active, x: joyState.x, y: joyState.y }; // map to world (x, z)
    },
    cancelAim,
    getHoldState() {
      // Return hold booleans and, if an AOE skill is held, provide { aoeKey, aoePoint } for continuous casting.
      if (!holdState.basic && !holdState.skillQ && !holdState.skillW && !holdState.skillE && !holdState.skillR) return null;
      const state = Object.assign({}, holdState);
      // Determine if any held skill is AOE; prioritize Q,W,E,R order
      for (const key of skillKeys) {
        if (holdState["skill" + key] && isAOE(key)) {
          const pos = (lastAimPos && isFinite(lastAimPos.x)) ? lastAimPos.clone() : computeAimPositionFromJoystick();
          state.aoeKey = key;
          state.aoePoint = pos;
          break;
        }
      }
      return state;
    }
  };
}
