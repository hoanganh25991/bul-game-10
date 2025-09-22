import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR, VILLAGE_POS, REST_RADIUS } from "./constants.js";
import { createHouse } from "./meshes.js";

/**
 * Villages System
 * - Handles dynamic village spawning based on distance from origin
 * - Tracks village entry/exit and connects visited villages with curved roads
 * - Provides rest regen check while inside any village (base or dynamic)
 *
 * Usage:
 *   const villages = createVillagesSystem(scene, portals);
 *   villages.ensureFarVillage(player.pos());
 *   villages.updateVisitedVillage(player.pos());
 *   villages.updateRest(player, dt);
 */
export function createVillagesSystem(scene, portals) {
  // Spacing and registries
  const VILLAGE_SPACING = 10000; // world units between distant villages
  const dynamicVillages = new Map(); // key "ix,iz" -> { center, radius, group, portal }
  const builtRoadKeys = new Set(); // canonical "a|b" keys to avoid duplicates
  let currentVillageKey = null; // "origin" or "{ix},{iz}"

  // Dynamic roads group
  const dynamicRoads = new THREE.Group();
  dynamicRoads.name = "dynamicRoads";
  scene.add(dynamicRoads);

  // Helpers
  function getVillageCenterByKey(key) {
    if (!key) return null;
    if (key === "origin") return VILLAGE_POS.clone();
    const v = dynamicVillages.get(key);
    return v ? v.center.clone() : null;
  }

  // Curved ribbon road along a Catmull–Rom spline
  function createCurvedRoad(points, width = 7, segments = 200, color = 0x2b2420) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    const pos = new Float32Array((segments + 1) * 2 * 3);
    const uv = new Float32Array((segments + 1) * 2 * 2);
    const idx = new Uint32Array(segments * 6);

    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const left = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
      const a = i / segments;
      curve.getPointAt(a, p);
      curve.getTangentAt(a, t).normalize();
      left.crossVectors(up, t).normalize();
      const hw = width * 0.5;
      const l = new THREE.Vector3().copy(p).addScaledVector(left, hw);
      const r = new THREE.Vector3().copy(p).addScaledVector(left, -hw);
      l.y = (l.y || 0) + 0.015;
      r.y = (r.y || 0) + 0.015;

      const vi = i * 2 * 3;
      pos[vi + 0] = l.x; pos[vi + 1] = l.y; pos[vi + 2] = l.z;
      pos[vi + 3] = r.x; pos[vi + 4] = r.y; pos[vi + 5] = r.z;

      const uvi = i * 2 * 2;
      uv[uvi + 0] = 0; uv[uvi + 1] = a * 8;
      uv[uvi + 2] = 1; uv[uvi + 3] = a * 8;
    }

    for (let i = 0; i < segments; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;
      const ti = i * 6;
      idx[ti + 0] = i0; idx[ti + 1] = i1; idx[ti + 2] = i2;
      idx[ti + 3] = i1; idx[ti + 4] = i3; idx[ti + 5] = i2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geom.setIndex(new THREE.BufferAttribute(idx, 1));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = false;
    return mesh;
  }

  // Connect two village centers by a single gentle-curved road
  function ensureRoadBetween(keyA, keyB) {
    if (!keyA || !keyB || keyA === keyB) return;
    const canonical = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
    if (builtRoadKeys.has(canonical)) return;

    const a = getVillageCenterByKey(keyA);
    const b = getVillageCenterByKey(keyB);
    if (!a || !b) return;

    const mid = a.clone().lerp(b, 0.5);
    const dir = b.clone().sub(a).setY(0);
    const len = Math.max(1, dir.length());
    dir.normalize();
    const perp = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const curveAmt = Math.min(600, Math.max(30, len * 0.25));
    const ctrl = mid.clone().addScaledVector(perp, curveAmt * (Math.random() < 0.5 ? 1 : -1));
    ctrl.y = 0.0;

    const road = createCurvedRoad([a, ctrl, b], 7, 200, 0x2b2420);
    dynamicRoads.add(road);
    builtRoadKeys.add(canonical);
  }

  // Simple text sprite for gate names
  function createTextSprite(text, color = "#e6f4ff", bg = "rgba(0,0,0,0.35)") {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const pad = 24;
    ctx.font = "bold 42px sans-serif";
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width + pad * 2);
    const h = 42 + pad * 2;
    canvas.width = w;
    canvas.height = h;
    const ctx2 = canvas.getContext("2d");
    ctx2.font = "bold 42px sans-serif";
    ctx2.fillStyle = bg;
    ctx2.fillRect(0, 0, w, h);
    ctx2.fillStyle = color;
    ctx2.textBaseline = "top";
    ctx2.fillText(text, pad, pad);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.04;
    sprite.scale.set(w * scale, h * scale, 1);
    sprite.position.y = 3.2;
    return sprite;
  }

  // Build a dynamic village at center; size scales with distance
  function createDynamicVillageAt(center, distanceFromOrigin) {
    const scale = Math.min(4, 1 + distanceFromOrigin / VILLAGE_SPACING);
    const fenceRadius = Math.max(REST_RADIUS + 4, REST_RADIUS * (0.9 + scale));
    const posts = Math.max(28, Math.floor(28 * (0.9 + scale * 0.6)));
    const houseCount = Math.max(6, Math.floor(6 * (0.8 + scale * 1.4)));

    const villageGroup = new THREE.Group();
    villageGroup.name = "dynamicVillage";
    scene.add(villageGroup);

    // Fence posts
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a });
    const postPositions = [];
    for (let i = 0; i < posts; i++) {
      const ang = (i / posts) * Math.PI * 2;
      const px = center.x + Math.cos(ang) * fenceRadius;
      const pz = center.z + Math.sin(ang) * fenceRadius;
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 0.9, pz);
      post.rotation.y = -ang;
      post.receiveShadow = true;
      post.castShadow = true;
      villageGroup.add(post);
      postPositions.push({ x: px, z: pz });
    }

    // Rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x4b3620 });
    const railHeights = [0.5, 1.0, 1.5];
    for (let i = 0; i < posts; i++) {
      const a = postPositions[i];
      const b = postPositions[(i + 1) % posts];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      for (const h of railHeights) {
        const railGeo = new THREE.BoxGeometry(len, 0.06, 0.06);
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set((a.x + b.x) / 2, h, (a.z + b.z) / 2);
        rail.rotation.y = -angle;
        rail.receiveShadow = true;
        villageGroup.add(rail);
      }
    }

    // Ground ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(fenceRadius - 0.1, fenceRadius + 0.1, 64),
      new THREE.MeshBasicMaterial({ color: COLOR.village, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0, center.z);
    villageGroup.add(ring);

    // Houses
    for (let i = 0; i < houseCount; i++) {
      const house = createHouse();
      const ang = (i / houseCount) * Math.PI * 2 + Math.random() * 0.2;
      const r = (fenceRadius * (0.35 + 0.5 * Math.random()));
      house.position.set(center.x + Math.cos(ang) * r, 0, center.z + Math.sin(ang) * r);
      house.rotation.y = Math.random() * Math.PI * 2;
      const sc = 0.9 + Math.random() * (0.4 + scale * 0.2);
      house.scale.setScalar(sc);
      villageGroup.add(house);
    }

    // Gate and label
    const gatePos = new THREE.Vector3(center.x + fenceRadius, 0, center.z);
    const pillarGeo = new THREE.BoxGeometry(0.3, 3.2, 0.4);
    const beamGeo = new THREE.BoxGeometry(2.8, 0.35, 0.4);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const leftPillar = new THREE.Mesh(pillarGeo, gateMat);
    const rightPillar = new THREE.Mesh(pillarGeo, gateMat);
    leftPillar.position.set(gatePos.x - 1.6, 1.6, gatePos.z);
    rightPillar.position.set(gatePos.x + 1.6, 1.6, gatePos.z);
    const beam = new THREE.Mesh(beamGeo, gateMat);
    beam.position.set(gatePos.x, 3.1, gatePos.z);
    [leftPillar, rightPillar, beam].forEach((m) => { m.castShadow = true; villageGroup.add(m); });

    const quadrant =
      Math.abs(center.x) > Math.abs(center.z)
        ? (center.x >= 0 ? "East" : "West")
        : (center.z >= 0 ? "South" : "North");
    const km = Math.round(distanceFromOrigin / 1000);
    const label = createTextSprite(`${quadrant} Gate — ${km}k`);
    label.position.set(gatePos.x, 3.6, gatePos.z + 0.01);
    villageGroup.add(label);

    // Portal inside the village near the gate
    const portalOffset = new THREE.Vector3(-2.5, 0, 0);
    const portal = portals.addPortalAt(gatePos.clone().add(portalOffset), COLOR.portal);

    return { center: center.clone(), radius: fenceRadius, group: villageGroup, portal };
  }

  function getPlayerVillageKey(playerPos) {
    if (!playerPos) return null;
    if (playerPos.distanceTo(VILLAGE_POS) <= REST_RADIUS) return "origin";
    let bestKey = null;
    let bestDist = Infinity;
    dynamicVillages.forEach((v, key) => {
      const d = Math.hypot(playerPos.x - v.center.x, playerPos.z - v.center.z);
      if (d <= v.radius && d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    });
    return bestKey;
  }

  function updateVisitedVillage(playerPos) {
    const key = getPlayerVillageKey(playerPos);
    if (key !== currentVillageKey) {
      if (key && currentVillageKey) {
        ensureRoadBetween(currentVillageKey, key);
      }
      currentVillageKey = key;
    }
  }

  function ensureFarVillage(playerPos) {
    if (!playerPos) return;
    const distFromOrigin = Math.hypot(playerPos.x - VILLAGE_POS.x, playerPos.z - VILLAGE_POS.z);
    if (distFromOrigin < VILLAGE_SPACING * 0.9) return;

    const ix = Math.round(playerPos.x / VILLAGE_SPACING);
    const iz = Math.round(playerPos.z / VILLAGE_SPACING);
    const key = `${ix},${iz}`;
    if (dynamicVillages.has(key)) return;

    const center = new THREE.Vector3(ix * VILLAGE_SPACING, 0, iz * VILLAGE_SPACING);
    const info = createDynamicVillageAt(center, Math.hypot(center.x, center.z));
    dynamicVillages.set(key, info);
  }

  // Public: add rest regen if inside any village (base or dynamic)
  function updateRest(player, dt) {
    if (!player) return;
    let inVillage = player.pos().distanceTo(VILLAGE_POS) <= REST_RADIUS;
    if (!inVillage && dynamicVillages.size > 0) {
      const p = player.pos();
      for (const [, v] of dynamicVillages.entries()) {
        const d = Math.hypot(p.x - v.center.x, p.z - v.center.z);
        if (d <= v.radius) { inVillage = true; break; }
      }
    }
    if (inVillage) {
      player.hp = Math.min(player.maxHP, player.hp + 8 * dt);
      player.mp = Math.min(player.maxMP, player.mp + 10 * dt);
    }
  }

  return {
    ensureFarVillage,
    updateVisitedVillage,
    updateRest,
  };
}
