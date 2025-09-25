import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR, VILLAGE_POS, REST_RADIUS } from "./constants.js";
import { createHouse } from "./meshes.js";

/**
 * Villages System
 * Encapsulates:
 *  - Dynamic village spawning based on distance from origin
 *  - Road creation between consecutively visited villages
 *  - Village rest (regen) logic for player inside any village
 *
 * Usage:
 *   const villages = initVillages(scene, portals);
 *   // inside game loop:
 *   villages.ensureFarVillage(player.pos());
 *   villages.updateVisitedVillage(player.pos());
 *   villages.updateRest(player, dt);
 */
export function initVillages(scene, portals, opts = {}) {
  const VILLAGE_SPACING = opts.spacing || 500;

  // Logarithmic spacing/size controls
  const SPACING_LOG_K = (typeof opts.spacingLogK === "number") ? opts.spacingLogK : 0.85;
  const SIZE_LOG_K = (typeof opts.villageSizeLogK === "number") ? opts.villageSizeLogK : 0.65;
  const SPACING_MULT = (typeof opts.spacingMultiplier === "number") ? opts.spacingMultiplier : 0.5;

  // Spacing grows ~logarithmically with radius; increases distance required to find next village
  function dynamicSpacingAtRadius(r) {
    const base = VILLAGE_SPACING;
    const rr = Math.max(0, r);
    return base * (1 + Math.log1p(rr / base) * SPACING_LOG_K) * SPACING_MULT;
  }

  // Village size grows steadily with radius
  function scaleFromDistance(distance) {
    const base = VILLAGE_SPACING;
    const s = 1 + Math.log1p(Math.max(0, distance) / base) * SIZE_LOG_K;
    return Math.min(6, s);
  }

  // Deterministic "good" village names from key
  function nameForKey(key) {
    const A = ["Oak","Storm","Dawn","Iron","Sky","Elder","Moon","Sun","Frost","Ash","Raven","Wolf","Dragon","Silver","Gold","Star","High","Low","West","East","North","South","Bright","Shadow","Mist","Cloud","Thunder","Wind","Stone","River","Glen","Vale","Hill","Mist","Fire","Ice","Dust","Ember","Lumen","Myth"];
    const B = ["field","watch","reach","ford","hold","haven","gate","spire","fall","brook","ridge","vale","crest","keep","market","run","moor","hollow","wick","stead","burgh","bridge","rock","cliff","grove","meadow","harbor","shore","spring","cairn","peak","barrow"];
    const C = ["Village","Town","Haven","Outpost","Gate","Hold","Rest","Hamlet","Retreat","Sanctum"];
    const r1 = Math.floor(_seededRand01(key + ":1") * A.length);
    const r2 = Math.floor(_seededRand01(key + ":2") * B.length);
    const r3 = Math.floor(_seededRand01(key + ":3") * C.length);
    return A[r1] + B[r2].charAt(0).toUpperCase() + B[r2].slice(1) + " " + C[r3];
  }

  // Compute center for a given grid key with deterministic jitter, based on radial spacing
  function centerForKey(ix, iz) {
    const approxR = Math.hypot(ix, iz) * VILLAGE_SPACING;
    const sp = dynamicSpacingAtRadius(approxR);
    let cx = ix * sp;
    let cz = iz * sp;
    const key = `${ix},${iz}`;
    const jitter = sp * 0.3;
    cx += (_seededRand01(key + ":x") - 0.5) * jitter * 2;
    cz += (_seededRand01(key + ":z") - 0.5) * jitter * 2;
    return new THREE.Vector3(cx, 0, cz);
  }

  // State
  const dynamicVillages = new Map(); // key "ix,iz" -> { center, radius, group, portal }
  const builtRoadKeys = new Set();   // canonical "a|b"
  let currentVillageKey = null;      // "origin" or "{ix},{iz}"
  const roadGeoms = new Map(); // canonical -> { aKey, bKey, a:{x,z}, ctrl:{x,z}, b:{x,z}, width, segments }
  const roadPolylines = new Map(); // canonical -> Array<{x,z}>

  // Roads parent
  const dynamicRoads = new THREE.Group();
  dynamicRoads.name = "dynamicRoads";
  scene.add(dynamicRoads);

  // Persistence keys
  const STORAGE_VILLAGES = "got.dynamic.villages.v1";
  const STORAGE_ROADS = "got.dynamic.roads.v1";
  const STORAGE_ROADS_GEOM = "got.dynamic.roads_geom.v1";

  function saveVillagesToStorage() {
    try {
      const arr = Array.from(dynamicVillages.keys());
      localStorage.setItem(STORAGE_VILLAGES, JSON.stringify(arr));
    } catch (_) {}
  }

  function saveRoadsToStorage() {
    try {
      const arr = Array.from(builtRoadKeys.values());
      localStorage.setItem(STORAGE_ROADS, JSON.stringify(arr));
    } catch (_) {}
  }

  function saveRoadGeomsToStorage() {
    try {
      const obj = {};
      roadGeoms.forEach((g, k) => { obj[k] = g; });
      localStorage.setItem(STORAGE_ROADS_GEOM, JSON.stringify(obj));
    } catch (_) {}
  }

  (function loadFromStorage() {
    try {
      const vraw = localStorage.getItem(STORAGE_VILLAGES);
      const graw = localStorage.getItem(STORAGE_ROADS_GEOM);
      const rraw = localStorage.getItem(STORAGE_ROADS);
      const vKeys = vraw ? JSON.parse(vraw) : [];
      if (Array.isArray(vKeys)) {
        vKeys.forEach((key) => {
          if (typeof key !== "string" || dynamicVillages.has(key)) return;
          const [ixStr, izStr] = key.split(",");
          const ix = parseInt(ixStr, 10), iz = parseInt(izStr, 10);
          if (!Number.isFinite(ix) || !Number.isFinite(iz)) return;
          const center = centerForKey(ix, iz);
          const info = createDynamicVillageAt(center, Math.hypot(center.x, center.z), nameForKey(key));
          dynamicVillages.set(key, info);
        });
      }
      const geoms = graw ? JSON.parse(graw) : null;
      if (geoms && typeof geoms === "object") {
        Object.keys(geoms).forEach((canonical) => {
          if (typeof canonical !== "string" || builtRoadKeys.has(canonical)) return;
          const parts = canonical.split("|");
          if (parts.length !== 2) return;
          const aKey = parts[0];
          const bKey = parts[1];
          const hasA = (aKey === "origin") || dynamicVillages.has(aKey);
          const hasB = (bKey === "origin") || dynamicVillages.has(bKey);
          if (hasA && hasB) {
            _ensureRoadFromGeom(canonical, geoms[canonical]);
          }
        });
      }
      const roads = rraw ? JSON.parse(rraw) : [];
      if (Array.isArray(roads)) {
        roads.forEach((canonical) => {
          if (typeof canonical !== "string" || builtRoadKeys.has(canonical)) return;
          const parts = canonical.split("|");
          if (parts.length !== 2) return;
          const a = parts[0];
          const b = parts[1];
          // Build only if endpoints are known or origin
          const hasA = (a === "origin") || dynamicVillages.has(a);
          const hasB = (b === "origin") || dynamicVillages.has(b);
          if (hasA && hasB) {
            ensureRoadBetween(a, b);
          }
        });
      }
    } catch (_) {}
  })();

  function getVillageCenterByKey(key) {
    if (!key) return null;
    if (key === "origin") return VILLAGE_POS.clone();
    const v = dynamicVillages.get(key);
    return v ? v.center.clone() : null;
  }

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

  // Helper: seeded random [0,1) based on string
  function _seededRand01(str) {
    let h = 0x811c9dc5; // FNV-1a 32-bit
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ((h >>> 0) / 4294967296);
  }

  // Compute a 2D polyline from stored road geometry
  function _computePolylineFromGeom(g, samples = 64) {
    try {
      const a = new THREE.Vector3(g.a.x, 0, g.a.z);
      const c = new THREE.Vector3(g.ctrl.x, 0, g.ctrl.z);
      const b = new THREE.Vector3(g.b.x, 0, g.b.z);
      const curve = new THREE.CatmullRomCurve3([a, c, b], false, "catmullrom", 0.5);
      const pts = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const p = curve.getPointAt(t);
        pts.push({ x: p.x, z: p.z });
      }
      return pts;
    } catch (_) {
      return [];
    }
  }

  // Build a road from persisted geometry
  function _ensureRoadFromGeom(canonical, g) {
    if (!canonical || !g) return;
    if (builtRoadKeys.has(canonical)) return;
    const pts = [
      new THREE.Vector3(g.a.x, 0, g.a.z),
      new THREE.Vector3(g.ctrl.x, 0, g.ctrl.z),
      new THREE.Vector3(g.b.x, 0, g.b.z)
    ];
    const width = g.width || 7;
    const segments = g.segments || 200;
    const mesh = createCurvedRoad(pts, width, segments, 0x2b2420);
    dynamicRoads.add(mesh);
    builtRoadKeys.add(canonical);
    roadGeoms.set(canonical, g);
    roadPolylines.set(canonical, _computePolylineFromGeom(g));
  }

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
    const sign = _seededRand01(canonical) < 0.5 ? 1 : -1;
    const ctrl = mid.clone().addScaledVector(perp, curveAmt * sign);
    ctrl.y = 0.0;

    const width = 7;
    const segments = 200;
    const road = createCurvedRoad([a, ctrl, b], width, segments, 0x2b2420);
    dynamicRoads.add(road);
    builtRoadKeys.add(canonical);

    // Persist geometry and sampled polyline for minimap
    const geomObj = {
      aKey: keyA,
      bKey: keyB,
      a: { x: a.x, z: a.z },
      ctrl: { x: ctrl.x, z: ctrl.z },
      b: { x: b.x, z: b.z },
      width,
      segments
    };
    roadGeoms.set(canonical, geomObj);
    roadPolylines.set(canonical, _computePolylineFromGeom(geomObj));

    saveRoadsToStorage();
    saveRoadGeomsToStorage();
  }

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

  function createDynamicVillageAt(center, distanceFromOrigin, name) {
    const scale = scaleFromDistance(distanceFromOrigin); // grows ~logarithmically with radius
    const fenceRadius = Math.max(REST_RADIUS + 4, REST_RADIUS * (0.9 + scale));
    const posts = Math.max(28, Math.floor(28 * (0.9 + scale * 0.6)));
    const houseCount = Math.max(6, Math.floor(6 * (0.8 + scale * 1.4)));
    const villageGroup = new THREE.Group();
    villageGroup.name = "dynamicVillage";
    scene.add(villageGroup);

    // Fence posts + rails
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

    // Gate + label
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
    const labelText = name || `${quadrant} Gate`;
    const label = createTextSprite(labelText);
    label.position.set(gatePos.x, 3.6, gatePos.z + 0.01);
    villageGroup.add(label);

    // Portal inside village
    const portalOffset = new THREE.Vector3(-2.5, 0, 0);
    const portal = portals.addPortalAt(gatePos.clone().add(portalOffset), COLOR.portal);

    return { center: center.clone(), radius: fenceRadius, group: villageGroup, portal, name };
  }

  function ensureFarVillage(playerPos) {
    if (!playerPos) return;
    const distFromOrigin = Math.hypot(playerPos.x - VILLAGE_POS.x, playerPos.z - VILLAGE_POS.z);
    const sp = dynamicSpacingAtRadius(distFromOrigin);
    if (distFromOrigin < sp * 0.9) return;

    const ix = Math.round(playerPos.x / sp);
    const iz = Math.round(playerPos.z / sp);
    const key = `${ix},${iz}`;
    if (dynamicVillages.has(key)) return;

    const center = centerForKey(ix, iz);
    const info = createDynamicVillageAt(center, Math.hypot(center.x, center.z), nameForKey(key));
    dynamicVillages.set(key, info);
    saveVillagesToStorage();
  }

  function getVillageKeyAt(pos) {
    if (!pos) return null;
    if (Math.hypot(pos.x - VILLAGE_POS.x, pos.z - VILLAGE_POS.z) <= REST_RADIUS) return "origin";
    let bestKey = null;
    let bestDist = Infinity;
    dynamicVillages.forEach((v, key) => {
      const d = Math.hypot(pos.x - v.center.x, pos.z - v.center.z);
      if (d <= v.radius && d < bestDist) {
        bestDist = d;
        bestKey = key;
      }
    });
    return bestKey;
  }

  // Returns info for the village that contains pos, or null.
  function getContainingVillageInfo(pos) {
    if (!pos) return null;
    // Origin first
    if (Math.hypot(pos.x - VILLAGE_POS.x, pos.z - VILLAGE_POS.z) <= REST_RADIUS) {
      return { key: "origin", center: VILLAGE_POS.clone(), radius: REST_RADIUS };
    }
    // Dynamic villages
    let found = null;
    dynamicVillages.forEach((v, key) => {
      if (found) return;
      const d = Math.hypot(pos.x - v.center.x, pos.z - v.center.z);
      if (d <= v.radius) {
        found = { key, center: v.center.clone(), radius: v.radius };
      }
    });
    return found;
  }

  function isInsideAnyVillage(pos) {
    const info = getContainingVillageInfo(pos);
    return info ? { inside: true, ...info } : { inside: false };
  }

  // For minimap: list dynamic villages (not including origin)
  function listVillages() {
    const arr = [];
    dynamicVillages.forEach((v, key) => {
      arr.push({ key, center: v.center.clone(), radius: v.radius, name: v.name });
    });
    return arr;
  }

  // For minimap: list road segments as world-space endpoints {a:{x,z}, b:{x,z}}
  function listRoadSegments() {
    const arr = [];
    builtRoadKeys.forEach((canonical) => {
      if (typeof canonical !== "string") return;
      const parts = canonical.split("|");
      if (parts.length !== 2) return;
      const a = getVillageCenterByKey(parts[0]);
      const b = getVillageCenterByKey(parts[1]);
      if (a && b) {
        arr.push({ a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z } });
      }
    });
    return arr;
  }

  // For minimap: list road polylines as arrays of {x,z}
  function listRoadPolylines() {
    const arr = [];
    roadPolylines.forEach((pts) => {
      if (Array.isArray(pts) && pts.length > 1) {
        arr.push(pts);
      }
    });
    return arr;
  }

  function updateVisitedVillage(playerPos) {
    const key = getVillageKeyAt(playerPos);
    // Do not clear currentVillageKey when outside; keep last visited so we can connect a road on next entry
    if (!key) return;
    if (key !== currentVillageKey) {
      if (currentVillageKey) {
        ensureRoadBetween(currentVillageKey, key);
      }
      currentVillageKey = key;
    }
  }

  function updateRest(player, dt) {
    if (!player) return;
    const p = player.pos();
    let inVillage = Math.hypot(p.x - VILLAGE_POS.x, p.z - VILLAGE_POS.z) <= REST_RADIUS;
    if (!inVillage && dynamicVillages.size > 0) {
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
    getVillageKeyAt,
    isInsideAnyVillage,
    listVillages,
    listRoadPolylines,
    listRoadSegments,
    _debug: {
      dynamicVillages,
      dynamicRoads,
      builtRoadKeys,
      roadGeoms,
      roadPolylines,
      get currentVillageKey() { return currentVillageKey; }
    }
  };
}

export function createVillagesSystem(scene, portals, opts = {}) {
  return initVillages(scene, portals, opts);
}
