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
    // If in AOE aim mode, steer aim preview live
    if (player.aimMode && player.aimModeSkill === "W" && aimPreview) {
      const aim = computeAimPositionFromJoystick();
      lastAimPos.copy(aim);
      aimPreview.visible = true;
      aimPreview.position.set(aim.x, 0.02, aim.z);
    } else {
      // Attack-aim has been removed — ensure attack preview is hidden while using the joystick
      if (attackPreview) attackPreview.visible = false;
    }
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
      if (player.aimMode && player.aimModeSkill === "W") {
        // Confirm cast at current aim (if we have a lastAimPos; else compute default ahead)
        const pos = (lastAimPos && isFinite(lastAimPos.x)) ? lastAimPos.clone() : computeAimPositionFromJoystick();
        if (typeof skills.castSkill === "function") {
          skills.castSkill("W", pos);
        } else if (typeof skills.castW_AOE === "function") {
          skills.castW_AOE(pos);
        }
        effects?.spawnMovePing?.(pos, 0x9fd8ff);
        cancelAim();
      } else {
        // Enter aim mode for W
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
  };
}
