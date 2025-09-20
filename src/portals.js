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

  function ensureVillagePortal() {
    if (villagePortal) return;
    const pm = createPortalMesh(COLOR.village);
    pm.group.position.copy(VILLAGE_POS).add(new THREE.Vector3(4, 1, 0));
    scene.add(pm.group);
    villagePortal = { ...pm, linkTo: null, radius: 2.2 };
  }
  ensureVillagePortal();

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
    // Create/refresh return portal where player stands (no instant teleport)
    const here = player.pos().clone();
    if (!returnPortal) {
      const pm = createPortalMesh(COLOR.portal);
      scene.add(pm.group);
      returnPortal = { ...pm, linkTo: null, radius: 2.2 };
    }
    returnPortal.group.position.copy(here).add(new THREE.Vector3(0, 1, 0));
    returnPortal.ring.rotation.x = Math.PI / 2;

    // Link portals
    returnPortal.linkTo = villagePortal;
    villagePortal.linkTo = returnPortal;

    // Freeze player until clicking the portal
    player.frozen = true;
    setCenterMsg && setCenterMsg("Click the portal to travel to the village");
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
      teleportToPortal(villagePortal, player);
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
    arr.forEach((p) => {
      if (!p) return;
      p.ring.rotation.z += dt * 0.8;
    });
  }

  return {
    getVillagePortal: () => villagePortal,
    getReturnPortal: () => returnPortal,
    ensureVillagePortal,
    recallToVillage,
    handleFrozenPortalClick,
    teleportToPortal,
    update,
  };
}
