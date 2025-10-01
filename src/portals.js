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

  // Persistent Marks/Flags (user-placed permanent teleport portals)
  const MARK_COLOR = 0x66ffd1;
  const LS_KEY_MARKS = "persistentMarks";
  const LS_KEY_MARK_READY = "markNextReadyAt";
  const MARK_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
  let persistentMarks = []; // [{ portal, x, z, createdAt }]

  function ensureVillagePortal() {
    if (villagePortal) return;
    const pm = createPortalMesh(COLOR.village);
    pm.group.position.copy(VILLAGE_POS).add(new THREE.Vector3(4, 1, 0));
    scene.add(pm.group);
    villagePortal = { ...pm, linkTo: null, radius: 2.2, __kind: "village" };
  }
  ensureVillagePortal();

  // Load persistent marks from localStorage on init
  (function loadPersistentMarks() {
    try {
      const raw = localStorage.getItem(LS_KEY_MARKS);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      arr.forEach((m, i) => {
        if (!m || typeof m.x !== "number" || typeof m.z !== "number") return;
        const pm = createPortalMesh(MARK_COLOR);
        pm.group.position.set(m.x, 1, m.z);
        scene.add(pm.group);
        const portal = { ...pm, linkTo: null, radius: 2.2, __kind: "mark" };
        const name = (m.name && String(m.name).trim()) ? String(m.name).trim() : `Mark ${i + 1}`;
        persistentMarks.push({ portal, x: m.x, z: m.z, name, createdAt: m.createdAt || Date.now() });
        extraPortals.push(portal);
      });
    } catch (_) {}
  })();

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

  function recallToVillage(player, setCenterMsg, clearCenterMsg) {
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
    const msg = (k) => `⏳ ${k}…`;
    setCenterMsg && setCenterMsg(msg(3));

    const timers = [];
    timers.push(setTimeout(() => { setCenterMsg && setCenterMsg(msg(2)); }, 1000));
    timers.push(setTimeout(() => { setCenterMsg && setCenterMsg(msg(1)); }, 2000));
    timers.push(setTimeout(() => {
      try { teleportToPortal(returnPortal.linkTo || villagePortal, player); } catch (_) {}
      player.frozen = false;
      try { setCenterMsg && setCenterMsg("🛖"); } catch (_) {}
      setTimeout(() => { 
        try { 
          if (clearCenterMsg) {
            clearCenterMsg(); // Properly hide the div
          } else {
            setCenterMsg && setCenterMsg(""); // Fallback to empty string
          }
        } catch (_) {} 
      }, 600);
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

  function savePersistentMarks() {
    try {
      const data = persistentMarks.map((m) => ({
        x: m.x,
        z: m.z,
        name: m.name || "",
        createdAt: m.createdAt || Date.now()
      }));
      localStorage.setItem(LS_KEY_MARKS, JSON.stringify(data));
    } catch (_) {}
  }

  function getMarkCooldownMs() {
    try {
      const t = parseInt(localStorage.getItem(LS_KEY_MARK_READY) || "0", 10) || 0;
      const remain = Math.max(0, t - now() * 1000); // now() is seconds? Our now() returns seconds or ms?
    } catch (_) {}
    // Fallback: compute with Date.now()
    const next = parseInt(localStorage.getItem(LS_KEY_MARK_READY) || "0", 10) || 0;
    const remain = Math.max(0, next - Date.now());
    return remain;
  }

  function addPersistentMarkAt(position, name = "") {
    // cooldown gate
    const remain = getMarkCooldownMs();
    if (remain > 0) return null;

    const pm = createPortalMesh(MARK_COLOR);
    const x = position.x, z = position.z;
    pm.group.position.set(x, 1, z);
    scene.add(pm.group);
    const portal = { ...pm, linkTo: null, radius: 2.2, __kind: "mark" };
    const defName = name && String(name).trim() ? String(name).trim() : `Mark ${persistentMarks.length + 1}`;
    persistentMarks.push({ portal, x, z, name: defName, createdAt: Date.now() });
    extraPortals.push(portal);
    savePersistentMarks();
    try { localStorage.setItem(LS_KEY_MARK_READY, String(Date.now() + MARK_COOLDOWN_MS)); } catch (_) {}
    return portal;
  }

  function listPersistentMarks() {
    return persistentMarks.map((m, i) => ({
      index: i,
      x: m.x,
      z: m.z,
      name: m.name || "",
      createdAt: m.createdAt || Date.now()
    }));
  }

  function teleportToMark(index, player) {
    const m = persistentMarks[index];
    if (!m) return false;
    teleportToPortal(m.portal, player);
    return true;
  }

  function removePersistentMark(index) {
    const m = persistentMarks[index];
    if (!m) return false;
    try { scene.remove(m.portal.group); } catch (_) {}
    try { m.portal.group.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); } catch (_) {}
    persistentMarks.splice(index, 1);
    // also remove from extraPortals
    const idx = extraPortals.indexOf(m.portal);
    if (idx >= 0) extraPortals.splice(idx, 1);
    savePersistentMarks();
    return true;
  }

  function renamePersistentMark(index, newName) {
    const m = persistentMarks[index];
    if (!m) return false;
    const nn = (newName && String(newName).trim()) ? String(newName).trim() : m.name;
    m.name = nn;
    savePersistentMarks();
    return true;
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
    // Marks/Flags API
    addPersistentMarkAt,
    listPersistentMarks,
    teleportToMark,
    removePersistentMark,
    renamePersistentMark,
    getMarkCooldownMs,
    update,
  };
}
