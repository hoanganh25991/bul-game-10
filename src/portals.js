import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR, VILLAGE_POS, REST_RADIUS } from "./constants.js";
import { createPortalMesh } from "./meshes.js";
import { distance2D, now } from "./utils.js";

/**
 * Portals/Recall system:
 * - Creates a fixed village portal near VILLAGE_POS
 * - recallToVillage(player): spawns/refreshes a return portal at player's current position, links portals, freezes player, and shows message
 * - handleFrozenPortalClick(raycast, camera, player, clearCenterMsg): click portal to teleport while frozen
 * - update(dt): spins portal rings
 * - teleportToPortal(dest, player): utility to move player to portal
 */
export function initPortals(scene) {
  let returnPortal = null; // placed where B was cast
  let villagePortal = null; // fixed in village
  const extraPortals = [];  // dynamic portals added in distant villages

  function ensureVillagePortal() {
    if (villagePortal) return;
    const pm = createPortalMesh(COLOR.village);
    pm.group.position.copy(VILLAGE_POS).add(new THREE.Vector3(4, 1, 0));
    scene.add(pm.group);
    villagePortal = { ...pm, linkTo: null, radius: 2.2, __kind: "village" };
  }
  ensureVillagePortal();

  // Return all destination portals (exclude the temporary returnPortal)
  function getAllPortals() {
    const arr = [];
    if (villagePortal) arr.push(villagePortal);
    for (const p of extraPortals) if (p) arr.push(p);
    return arr;
  }

  // Add a new portal at a position (used by generated distant villages)
  function addPortalAt(position, color = COLOR.village) {
    const pm = createPortalMesh(color);
    pm.group.position.copy(position.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.add(pm.group);
    const portal = { ...pm, linkTo: null, radius: 2.2, __kind: "dynamic" };
    extraPortals.push(portal);
    return portal;
  }

  function getNearestPortal(pos) {
    ensureVillagePortal();
    const arr = getAllPortals();
    let best = null, bestD = Infinity;
    for (const p of arr) {
      const d = pos.distanceTo(p.group.position);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best || villagePortal;
  }

  function teleportToPortal(dest, player) {
    if (!dest) return;
    const to = dest.group.position.clone();
    to.y = 0;
    player.mesh.position.copy(to).add(new THREE.Vector3(1.5, 0, 0));
    // clear orders
    player.moveTarget = null;
    player.target = null;
  }

  function recallToVillage(player, setCenterMsg) {
    // Create/refresh return portal where player stands and auto-teleport after countdown
    const here = player.pos().clone();
    if (!returnPortal) {
      const pm = createPortalMesh(COLOR.village);
      scene.add(pm.group);
      returnPortal = { ...pm, linkTo: null, radius: 2.2 };
    } else {
      // cancel any existing countdown on refresh
      if (returnPortal.__countTimers && Array.isArray(returnPortal.__countTimers)) {
        returnPortal.__countTimers.forEach((t) => { try { clearTimeout(t); } catch (_) {} });
        returnPortal.__countTimers = null;
      }
    }
    returnPortal.group.position.copy(here).add(new THREE.Vector3(0, 1, 0));
    // ensure vertical orientation (no horizontal flip)
    try { returnPortal.ring.rotation.x = 0; } catch (_) {}

    // Link portals to the nearest destination portal
    const dest = getNearestPortal(here);
    returnPortal.linkTo = dest;
    if (dest) dest.linkTo = returnPortal;

    // Freeze and start a 3-2-1 countdown, then auto-teleport
    player.frozen = true;
    const msg = (k) => `Dịch chuyển sau ${k}… • Teleporting in ${k}…`;
    setCenterMsg && setCenterMsg(msg(3));

    const timers = [];
    timers.push(setTimeout(() => { setCenterMsg && setCenterMsg(msg(2)); }, 1000));
    timers.push(setTimeout(() => { setCenterMsg && setCenterMsg(msg(1)); }, 2000));
    timers.push(setTimeout(() => {
      try { teleportToPortal(returnPortal.linkTo || villagePortal, player); } catch (_) {}
      player.frozen = false;
      try { setCenterMsg && setCenterMsg("Đã dịch chuyển • Teleported"); } catch (_) {}
      setTimeout(() => { try { setCenterMsg && setCenterMsg(""); } catch (_) {} }, 600);
    }, 3000));
    returnPortal.__countTimers = timers;
  }

  /**
   * Handle clicks while player is frozen from recall: allow interacting with the return portal
   * to travel to the village. Returns true if teleport happened, false otherwise.
   * Uses current mouse ray and camera.
   * @returns {boolean}
   */
  function handleFrozenPortalClick(raycast, camera, player, clearCenterMsg) {
    if (!returnPortal) return false;
    // Re-use the provided raycaster
    raycast.raycaster.setFromCamera(raycast.mouseNDC, camera);
    const hitPortal = raycast.raycaster.intersectObject(returnPortal.group, true)[0];
    const p = raycast.raycastGround();
    const nearPortal =
      p && distance2D(p, returnPortal.group.position) <= (returnPortal.radius + 0.8);
    if (hitPortal || nearPortal) {
      // cancel any pending countdown and teleport immediately
      try {
        if (returnPortal.__countTimers && Array.isArray(returnPortal.__countTimers)) {
          returnPortal.__countTimers.forEach((t) => { try { clearTimeout(t); } catch (_) {} });
          returnPortal.__countTimers = null;
        }
      } catch (_) {}
      teleportToPortal(returnPortal.linkTo || villagePortal, player);
      player.frozen = false;
      clearCenterMsg && clearCenterMsg();
      return true;
    }
    return false;
  }

  function update(dt) {
    const arr = [];
    if (returnPortal) arr.push(returnPortal);
    if (villagePortal) arr.push(villagePortal);
    extraPortals.forEach((p) => { if (p) arr.push(p); });
    arr.forEach((p) => {
      if (!p) return;
      // vertical gate spin
      try { p.ring.rotation.y += dt * 0.8; } catch (_) {}
      // inner swirl animation and subtle glow pulse
      try {
        const tnow = now();
        if (p.swirl) {
          p.swirl.rotation.z -= dt * 1.6;
          const s = 1 + Math.sin(tnow * 3.2) * 0.05;
          p.swirl.scale.set(s, s, 1);
          if (p.swirl.material) p.swirl.material.opacity = 0.26 + 0.12 * (0.5 + 0.5 * Math.sin(tnow * 2.2));
        }
        if (p.glow) {
          const gs = 1.05 + 0.07 * Math.sin(tnow * 1.6);
          p.glow.scale.set(gs, gs, 1);
        }
      } catch (_) {}
    });
  }

  return {
    getVillagePortal: () => villagePortal,
    getReturnPortal: () => returnPortal,
    ensureVillagePortal,
    addPortalAt,
    getNearestPortal,
    recallToVillage,
    handleFrozenPortalClick,
    teleportToPortal,
    update,
  };
}
