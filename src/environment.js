import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { makeNoiseTexture, createSeededRNG, seededRange } from "./utils.js";
import { WORLD } from "./constants.js";
import { createHouse, createGreekTemple, createVilla, createGreekColumn, createCypressTree, createOliveTree, createGreekStatue, createObelisk } from "./meshes.js";

/**
 * initEnvironment(scene, options)
 * - Adds a simple themed environment: scattered trees, rocks, flowers, a small village,
 *   optional water pool and toggleable rain.
 *
 * Returns an object with:
 *  - update(t, dt)  -> call each frame to animate rain / water
 *  - toggleRain(enabled)
 *
 * Implementation notes:
 * - Uses simple low-poly primitives (fast, no external assets).
 * - Uses WORLD.groundSize as placement bounds by default.
 */
export function initEnvironment(scene, options = {}) {
  const cfg = Object.assign(
    {
      // denser defaults for a richer environment (Phase A tuned)
      treeCount: 160,
      rockCount: 80,
      flowerCount: 300,
      villageCount: 2,
      villageRadius: 12,
      enableWater: true,
      waterRadius: 22,
      enableRain: true,
      rainCount: 800,
      seed: Date.now(),
    },
    options
  );

  // Quality preset scaling for environment complexity
  try { cfg.quality = cfg.quality || (JSON.parse(localStorage.getItem("renderPrefs") || "{}").quality || "high"); } catch (_) { cfg.quality = cfg.quality || "high"; }
  const __q = cfg.quality;
  // Scale prop counts based on quality unless explicitly overridden by options
  if (__q === "medium") {
    cfg.treeCount = Math.floor(cfg.treeCount * 0.6);
    cfg.rockCount = Math.floor(cfg.rockCount * 0.6);
    cfg.flowerCount = Math.floor(cfg.flowerCount * 0.5);
    cfg.villageCount = Math.max(1, Math.floor(cfg.villageCount * 0.8));
    cfg.rainCount = Math.floor(cfg.rainCount * 0.6);
  } else if (__q === "low") {
    cfg.treeCount = Math.floor(cfg.treeCount * 0.35);
    cfg.rockCount = Math.floor(cfg.rockCount * 0.45);
    cfg.flowerCount = Math.floor(cfg.flowerCount * 0.35);
    cfg.villageCount = 1;
    cfg.enableWater = false;
    cfg.rainCount = Math.floor(cfg.rainCount * 0.33);
  }
  // Road segments based on quality
  const __roadSegs = __q === "low" ? 36 : (__q === "medium" ? 80 : 140);
  // Whether to add light sources on houses (skip on low, dim on medium)
  const __houseLights = __q === "high" ? "full" : (__q === "medium" ? "dim" : "none");
  // Fireflies density factor
  const __fireflyMul = __q === "low" ? 0.25 : (__q === "medium" ? 0.5 : 1);
  // Dynamic light budget to cap per-frame lighting cost
  const __lightBudget = (__q === "low") ? 0 : (__q === "medium" ? 6 : 10);
  let __lightBudgetLeft = __lightBudget;
  function acquireLight(n = 1) {
    if (__lightBudgetLeft >= n) { __lightBudgetLeft -= n; return true; }
    return false;
  }

  const root = new THREE.Group();
  root.name = "environment";
  scene.add(root);
  const rng = createSeededRNG(cfg.seed);

  // atmospheric fog tuned for thunder/blue theme
  scene.fog = scene.fog || new THREE.FogExp2(0x081827, 0.0009);

  // Ambient & directional light to match thunder / blue theme (complements existing lights)
  const ambient = new THREE.AmbientLight(0x0f2633, 0.68);
  root.add(ambient);

  // warm rim directional light to contrast cool ambient (soft)
  const sun = new THREE.DirectionalLight(0xffeebb, 0.36);
  sun.position.set(60, 80, -40);
  sun.castShadow = false;
  root.add(sun);

  // Ground detail subtle overlay (tile noise material)
  const detailTex = makeNoiseTexture(256);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.repeat.set(12, 12);

  const groundOverlay = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(40, Math.min(300, WORLD.groundSize * 0.2)), 64),
    new THREE.MeshStandardMaterial({
      map: detailTex,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  groundOverlay.rotation.x = -Math.PI / 2;
  groundOverlay.position.y = 0.01;
  root.add(groundOverlay);

  // Helpers to place items within bounds
  const half = WORLD.groundSize * 0.5 - 6;
  function randomPosInBounds() {
    return new THREE.Vector3(
      (Math.random() * 2 - 1) * half,
      0,
      (Math.random() * 2 - 1) * half
    );
  }
  function seededRandomPosInBounds() {
    return new THREE.Vector3(
      (rng() * 2 - 1) * half,
      0,
      (rng() * 2 - 1) * half
    );
  }

  // Cache of objects that sway to avoid traversing full scene graph every frame
  const swayObjs = [];

  // ----------------
  // Primitive props
  // ----------------
  function createTree() {
    const g = new THREE.Group();

    const h = 1.6 + Math.random() * 1.2;
    const trunkGeo = new THREE.CylinderGeometry(0.12 * (0.85 + Math.random() * 0.6), 0.12 * (0.85 + Math.random() * 0.6), h * 0.45, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x332a22 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h * 0.225;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageGeo = new THREE.ConeGeometry(h * 0.6, h * 0.9, 8);
    // shift foliage color slightly toward cyan/teal to match thunder theme
    const hueBase = 0.52 + (Math.random() - 0.5) * 0.04;
    const foliageMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color().setHSL(hueBase, 0.45 + Math.random() * 0.12, 0.18 + Math.random() * 0.06)
    });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = h * 0.9;
    foliage.castShadow = true;
    g.add(foliage);

    // small sway params used by update() to animate subtle motion
    g.userData.swayPhase = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.004 + Math.random() * 0.01;
    // register for per-frame sway updates
    swayObjs.push(g);

    g.scale.setScalar(0.9 + Math.random() * 0.8);
    return g;
  }

  function createRock() {
    const s = 0.6 + Math.random() * 1.4;
    const geo = new THREE.DodecahedronGeometry(s, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x223344 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    m.castShadow = true;
    return m;
  }

  function createFlower() {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24), new THREE.MeshLambertMaterial({ color: 0x1a7a3e }));
    stem.position.y = 0.12;
    g.add(stem);
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshLambertMaterial({ color: 0xffcc66, emissive: 0xffb86b }));
    petal.position.y = 0.28;
    g.add(petal);
    g.scale.setScalar(0.9 + Math.random() * 0.6);
    return g;
  }

  // Curved road helper — builds a flat ribbon along a Catmull–Rom spline (connected and curved)
  function createCurvedRoad(points, width = 6, segments = 120, color = 0x2b2420) {
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
      // keep slightly above ground
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

  // Forest cluster generator - denser cluster of trees
  function createForest(center = new THREE.Vector3(0,0,0), radius = 8, count = 30) {
    const fg = new THREE.Group();
    for (let i=0;i<count;i++) {
      const t = createTree();
      const a = Math.random()*Math.PI*2;
      const r = Math.random()*radius;
      t.position.set(center.x + Math.cos(a)*r, 0, center.z + Math.sin(a)*r);
      t.rotateY(Math.random()*Math.PI*2);
      fg.add(t);
    }
    return fg;
  }

  // Scatter props
  const trees = new THREE.Group();
  const rocks = new THREE.Group();
  const flowers = new THREE.Group();
  trees.name = "trees";
  rocks.name = "rocks";
  flowers.name = "flowers";

  for (let i = 0; i < cfg.treeCount; i++) {
    const t = createTree();
    const p = randomPosInBounds();
    t.position.set(p.x, 0, p.z);
    t.rotateY(Math.random() * Math.PI * 2);
    trees.add(t);
  }
  for (let i = 0; i < cfg.rockCount; i++) {
    const r = createRock();
    const p = randomPosInBounds();
    r.position.set(p.x, 0, p.z);
    r.scale.multiplyScalar(0.7 + Math.random() * 1.2);
    rocks.add(r);
  }
  for (let i = 0; i < cfg.flowerCount; i++) {
    const f = createFlower();
    const p = randomPosInBounds();
    f.position.set(p.x, 0, p.z);
    flowers.add(f);
  }

  root.add(trees, rocks, flowers);

  // Add denser forest clusters for richness
  const forest1 = createForest(new THREE.Vector3(-WORLD.groundSize * 0.15, 0, -WORLD.groundSize * 0.12), Math.max(8, Math.floor(cfg.villageRadius*1.2)), Math.floor(cfg.treeCount * 0.25));
  const forest2 = createForest(new THREE.Vector3(WORLD.groundSize * 0.18, 0, WORLD.groundSize * 0.05), Math.max(8, Math.floor(cfg.villageRadius*1.0)), Math.floor(cfg.treeCount * 0.18));
  root.add(forest1, forest2);

  // (removed old straight cross roads; replaced with curved, connected network below)

  // ----------------
  // Village generator (simple clustering of houses)
  // ----------------
  function generateVillage(center = new THREE.Vector3(0, 0, 0), count = 6, radius = 8) {
    const vgroup = new THREE.Group();
    vgroup.name = "village";
      for (let i = 0; i < count; i++) {
      try {
        const house = createHouse();
        const ang = Math.random() * Math.PI * 2;
        const r = radius * (0.3 + Math.random() * 0.9);
        house.position.set(center.x + Math.cos(ang) * r, 0, center.z + Math.sin(ang) * r);
        house.rotation.y = Math.random() * Math.PI * 2;
        // small variant: scale slightly
        const sc = 0.9 + Math.random() * 0.5;
        house.scale.setScalar(sc);

        // Add a warm lantern and small emissive bulb near each house to match village ambiance
        let __hasLanternLight = false;
        if (__houseLights !== "none" && acquireLight(1)) {
          __hasLanternLight = true;
          const intensity = __houseLights === "dim" ? 0.4 : 0.9;
          const dist = __houseLights === "dim" ? 4 : 6;
          const decay = 2;
          const lanternLight = new THREE.PointLight(0xffd8a8, intensity, dist, decay);
          lanternLight.position.set(0.6, 0.8, 0.6);
          lanternLight.castShadow = false;
          house.add(lanternLight);
        }

        const lanternBulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshStandardMaterial({ emissive: 0xffd8a8, emissiveIntensity: (__houseLights === "none" ? 0.9 : 1.2), color: 0x663300, roughness: 0.7 })
        );
        lanternBulb.position.set(0.6, 0.8, 0.6);
        house.add(lanternBulb);
        if (typeof __hasLanternLight !== "undefined" && !__hasLanternLight) {
          lanternBulb.material.emissiveIntensity = (__houseLights === "none" ? 1.2 : 1.4);
        }

        // small ground decoration near house entrance
        const peb = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.22, 0),
          new THREE.MeshStandardMaterial({ color: 0x3b4850, roughness: 0.95 })
        );
        peb.position.set(0.9, 0.02, 0.2);
        peb.scale.setScalar(0.8 + Math.random() * 0.6);
        house.add(peb);

        vgroup.add(house);
      } catch (e) {
        // fallback safety
      }
    }
    root.add(vgroup);
    return vgroup;
  }

  // Place a village or multiple villages
  const villages = [];
  const villageCenters = [];
  for (let i = 0; i < cfg.villageCount; i++) {
    const c = randomPosInBounds();
    villages.push(generateVillage(c, 4 + Math.floor(Math.random() * 6), cfg.villageRadius));
    villageCenters.push(c);
  }

  // Build curved, connected road network between villages using MST (minimal, fully connected)
  try {
    if (villageCenters.length >= 2) {
      const roadsGroup = new THREE.Group();
      roadsGroup.name = "roads";

      // Prepare 2D points (y = 0)
      const pts = villageCenters.map(v => v.clone().setY(0));
      const n = pts.length;

      // Prim's algorithm for MST
      const inTree = new Array(n).fill(false);
      const d = new Array(n).fill(Infinity);
      const parent = new Array(n).fill(-1);

      inTree[0] = true;
      for (let j = 1; j < n; j++) {
        d[j] = pts[0].distanceTo(pts[j]);
        parent[j] = 0;
      }
      for (let k = 1; k < n; k++) {
        let m = -1, best = Infinity;
        for (let j = 0; j < n; j++) {
          if (!inTree[j] && d[j] < best) { best = d[j]; m = j; }
        }
        if (m < 0) break;
        inTree[m] = true;
        for (let j = 0; j < n; j++) {
          if (!inTree[j]) {
            const nd = pts[m].distanceTo(pts[j]);
            if (nd < d[j]) { d[j] = nd; parent[j] = m; }
          }
        }
      }

      // Create a curved road segment for each MST edge
      for (let i = 1; i < n; i++) {
        const a = pts[i];
        const b = pts[parent[i]];
        const mid = a.clone().lerp(b, 0.5);
        const dir = b.clone().sub(a).setY(0);
        const len = Math.max(1, dir.length());
        dir.normalize();
        const perp = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
        const curveAmt = Math.min(30, len * 0.25);
        const ctrl = mid.clone().addScaledVector(perp, (i % 2 === 0 ? 1 : -1) * curveAmt);
        ctrl.y = 0.0;

        const road = createCurvedRoad([a, ctrl, b], 6, __roadSegs, 0x2b2420);
        roadsGroup.add(road);
      }

      root.add(roadsGroup);
    }
  } catch (e) {
    console.warn("Road network generation failed", e);
  }

  // Fireflies: small glowing points around village centers for ambiance
  const fireflies = new THREE.Group();
  villageCenters.forEach((center, idx) => {
    const baseCount = 24 + Math.floor(Math.random() * 16);
    const count = Math.max(0, Math.floor(baseCount * __fireflyMul));
    const positions = new Float32Array(count * 3);
    for (let j = 0; j < count; j++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (cfg.villageRadius * 0.6);
      positions[j * 3 + 0] = center.x + Math.cos(a) * r + (Math.random() - 0.5) * 1.2;
      positions[j * 3 + 1] = 0.6 + Math.random() * 1.6;
      positions[j * 3 + 2] = center.z + Math.sin(a) * r + (Math.random() - 0.5) * 1.2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe0a8,
      size: 0.06,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geom, mat);
    fireflies.add(pts);
  });
  root.add(fireflies);

  // ----------------
  // Water pool (optional)
  // ----------------
  let water = null;
  if (cfg.enableWater) {
    const geo = new THREE.CircleGeometry(cfg.waterRadius, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x083b5d,
      metalness: 0.35,
      roughness: 0.35,
      transparent: true,
      opacity: 0.9,
    });
    water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, -Math.max(20, WORLD.groundSize * 0.15));
    water.receiveShadow = false;
    root.add(water);
  }

  // ----------------
  // Greek-inspired structures and extras (randomized, quality-scaled)
  // ----------------
  // Place after water/villages so we can avoid them
  try {
    const archGroup = new THREE.Group();
    archGroup.name = "greek-architecture";
    const natureExtraGroup = new THREE.Group();
    natureExtraGroup.name = "nature-extras";

    const placed = [];

    const waterCenter = (cfg.enableWater && water) ? new THREE.Vector3(water.position.x, 0, water.position.z) : null;

    function farFromVillages(p, minD) {
      if (!villageCenters || villageCenters.length === 0) return true;
      for (const c of villageCenters) {
        if (p.distanceTo(c) < (minD + (cfg.villageRadius || 0))) return false;
      }
      return true;
    }
    function farFromWater(p, minD) {
      if (!waterCenter) return true;
      return p.distanceTo(waterCenter) >= ((cfg.waterRadius || 0) + minD);
    }
    function farFromPlaced(p, minD) {
      for (const q of placed) {
        if (p.distanceTo(q) < minD) return false;
      }
      return true;
    }
    function pickPos(minVillage = 12, minWater = 10, minBetween = 10, maxTries = 60) {
      let tries = maxTries;
      while (tries-- > 0) {
        const p = seededRandomPosInBounds();
        if (farFromVillages(p, minVillage) && farFromWater(p, minWater) && farFromPlaced(p, minBetween)) {
          placed.push(p.clone());
          return p;
        }
      }
      const p = seededRandomPosInBounds();
      placed.push(p.clone());
      return p;
    }

    // Unified density approach:
    // - Compute the same total spot count as before (per quality).
    // - For each spot, randomly pick a structure type (equal chance) and place it with its constraints.
    const __templeCountForDensity = (__q === "low") ? 0 : (__q === "medium" ? 1 : (rng() < 0.3 ? 2 : 1));
    const __villaCountForDensity = (__q === "low") ? 2 : (__q === "medium" ? 4 : 7);
    const __columnCountForDensity = (__q === "low") ? 4 : (__q === "medium" ? 8 : 14);
    const __statueCountForDensity = (__q === "low") ? 3 : (__q === "medium" ? 5 : 8);
    const __obeliskCountForDensity = (__q === "low") ? 2 : (__q === "medium" ? 4 : 6);
    const structureSpotCount =
      __templeCountForDensity +
      __villaCountForDensity +
      __columnCountForDensity +
      __statueCountForDensity +
      __obeliskCountForDensity;

    const orders = ["doric", "ionic", "corinthian"];
    let structureTypes = [
      {
        key: "temple",
        place() {
          const pos = pickPos(16, 14, 24);
          const t = createGreekTemple({
            cols: Math.max(5, Math.floor(seededRange(rng, 6, 9))),
            rows: Math.max(7, Math.floor(seededRange(rng, 9, 12))),
            columnHeight: seededRange(rng, 5.2, 6.2),
            colSpacingX: seededRange(rng, 2.2, 2.8),
            colSpacingZ: seededRange(rng, 2.3, 3.0),
          });
          t.position.set(pos.x, 0, pos.z);
          t.rotation.y = seededRange(rng, 0, Math.PI * 2);
          archGroup.add(t);

          // Accent lights at entrance if perf allows
      if (__q !== "low" && acquireLight(2)) {
        const torchL = new THREE.PointLight(0xffd8a8, __q === "medium" ? 0.5 : 0.8, 14, 2);
        torchL.position.set(pos.x + 2.5, 1.2, pos.z - 4.5);
        const torchR = torchL.clone();
        torchR.position.set(pos.x - 2.5, 1.2, pos.z - 4.5);
        root.add(torchL, torchR);
      }
        }
      },
      {
        key: "villa",
        place() {
          const pos = pickPos(10, 10, 12);
          const v = createVilla({
            width: seededRange(rng, 10, 16),
            depth: seededRange(rng, 8, 12),
            height: seededRange(rng, 3.5, 5.2),
          });
          v.position.set(pos.x, 0, pos.z);
          v.rotation.y = seededRange(rng, 0, Math.PI * 2);
          v.scale.setScalar(seededRange(rng, 0.9, 1.2));
          archGroup.add(v);
        }
      },
      {
        key: "column",
        place() {
          const pos = pickPos(8, 8, 8);
          const c = createGreekColumn({
            height: seededRange(rng, 4.2, 6.2),
            radius: seededRange(rng, 0.24, 0.34),
            order: orders[Math.floor(seededRange(rng, 0, orders.length)) | 0],
          });
          c.position.set(pos.x, 0, pos.z);
          c.rotation.y = seededRange(rng, 0, Math.PI * 2);
          archGroup.add(c);
        }
      },
      {
        key: "statue",
        place() {
          const pos = pickPos(8, 8, 10);
          const s = createGreekStatue();
          s.position.set(pos.x, 0, pos.z);
          s.rotation.y = seededRange(rng, -Math.PI, Math.PI);
          archGroup.add(s);
      if (__q !== "low" && acquireLight(1)) {
        const l = new THREE.PointLight(0xffe0b8, __q === "medium" ? 0.35 : 0.55, 10, 2);
        l.position.set(pos.x, 1.0, pos.z);
        root.add(l);
      }
        }
      },
      {
        key: "obelisk",
        place() {
          const pos = pickPos(10, 10, 12);
          const o = createObelisk({ height: seededRange(rng, 5.5, 7.5) });
          o.position.set(pos.x, 0, pos.z);
          o.rotation.y = seededRange(rng, 0, Math.PI * 2);
          archGroup.add(o);
        }
      }
    ];

    if (__q === "low") {
      structureTypes = structureTypes.filter(t => t.key !== "temple");
    }

    // Preserve per-type counts while randomizing order to avoid blowing up heavy types.
    const typeByKey = Object.fromEntries(structureTypes.map(t => [t.key, t]));
    const typePool = [];
    const pushNTimes = (key, count) => { for (let i = 0; i < count; i++) typePool.push(key); };
    pushNTimes("temple", __templeCountForDensity);
    pushNTimes("villa", __villaCountForDensity);
    pushNTimes("column", __columnCountForDensity);
    pushNTimes("statue", __statueCountForDensity);
    pushNTimes("obelisk", __obeliskCountForDensity);

    // Safety on low: ensure no temples even if counts change in the future.
    if (__q === "low") {
      for (let i = typePool.length - 1; i >= 0; i--) {
        if (typePool[i] === "temple") typePool.splice(i, 1);
      }
    }

    // Seeded Fisher–Yates shuffle
    for (let i = typePool.length - 1; i > 0; i--) {
      const j = Math.floor(seededRange(rng, 0, i + 1));
      const tmp = typePool[i]; typePool[i] = typePool[j]; typePool[j] = tmp;
    }

    typePool.forEach((key) => {
      const t = typeByKey[key];
      if (t) t.place();
    });

    // Nature extras unified density: same total budget, random type per spot
    const __cypressCountForDensity = (__q === "low") ? 24 : (__q === "medium" ? 40 : 60);
    const __oliveCountForDensity = (__q === "low") ? 16 : (__q === "medium" ? 26 : 40);
    const natureTreeSpotCount = __cypressCountForDensity + __oliveCountForDensity;

    const cypressGroup = new THREE.Group();
    cypressGroup.name = "cypress";
    const oliveGroup = new THREE.Group();
    oliveGroup.name = "olive";

    // Preserve original ratio between cypress and olive, but randomize order
    const naturePool = [];
    for (let i = 0; i < __cypressCountForDensity; i++) naturePool.push("cypress");
    for (let i = 0; i < __oliveCountForDensity; i++) naturePool.push("olive");
    // Seeded shuffle
    for (let i = naturePool.length - 1; i > 0; i--) {
      const j = Math.floor(seededRange(rng, 0, i + 1));
      const tmp = naturePool[i]; naturePool[i] = naturePool[j]; naturePool[j] = tmp;
    }
    naturePool.forEach((kind) => {
      const p = pickPos(4, 6, 2);
      if (kind === "cypress") {
        const t = createCypressTree();
        t.position.set(p.x, 0, p.z);
        t.rotation.y = seededRange(rng, 0, Math.PI * 2);
        t.scale.setScalar(seededRange(rng, 0.85, 1.25));
        cypressGroup.add(t);
      } else {
        const t = createOliveTree();
        t.position.set(p.x, 0, p.z);
        t.rotation.y = seededRange(rng, 0, Math.PI * 2);
        t.scale.setScalar(seededRange(rng, 0.85, 1.2));
        oliveGroup.add(t);
      }
    });
    natureExtraGroup.add(cypressGroup, oliveGroup);

    root.add(archGroup, natureExtraGroup);
  } catch (e) {
    console.warn("Extra structures generation failed", e);
  }

  // ----------------
  // Rain particle system (toggleable)
  // ----------------
  const rain = {
    enabled: cfg.enableRain,
    points: null,
    velocities: null,
  };

  function createRain(count = cfg.rainCount) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * half;
      const y = 10 + Math.random() * 20;
      const z = (Math.random() * 2 - 1) * half;
      positions[i * 3 + 0] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      velocities[i] = 10 + Math.random() * 10;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.08, transparent: true, opacity: 0.8 });
    const pts = new THREE.Points(geom, mat);
    pts.name = "rain";
    root.add(pts);
    rain.points = pts;
    rain.velocities = velocities;
  }

  if (cfg.enableRain) createRain(cfg.rainCount);

  // ----------------
  // Update loop (animate water & rain)
  // ----------------
  let __lastSwayT = 0;
  function update(t, dt) {
    // simple water shimmer: slightly change rotation/scale or material roughness
    if (water && water.material) {
      const m = water.material;
      m.emissive = m.emissive || new THREE.Color(0x001a2b);
      m.emissiveIntensity = 0.02 + Math.sin(t * 0.8) * 0.02;
      // gentle animated offset if material map exists
      if (m.map) {
        m.map.offset.x = Math.sin(t * 0.12) * 0.0015;
        m.map.offset.y = Math.cos(t * 0.09) * 0.0015;
      }
    }

    // subtle tree/foliage sway: animate pre-collected swayers to avoid full graph traversal
    const doSway = (__q === "high") || (__q === "medium" && (t - __lastSwayT) > 0.12);
    if (doSway) {
      __lastSwayT = t;
      for (let i = 0; i < swayObjs.length; i++) {
        const obj = swayObjs[i];
        if (!obj) continue;
        const phase = (obj.userData && obj.userData.swayPhase) || 0;
        const amp = (obj.userData && obj.userData.swayAmp) || 0.006;
        obj.rotation.z = Math.sin(t + phase) * amp;
      }
    }

    if (rain.enabled && rain.points) {
      const pos = rain.points.geometry.attributes.position.array;
      for (let i = 0; i < rain.velocities.length; i++) {
        pos[i * 3 + 1] -= rain.velocities[i] * dt;
        if (pos[i * 3 + 1] < 0.2) {
          pos[i * 3 + 0] = (Math.random() * 2 - 1) * half;
          pos[i * 3 + 1] = 12 + Math.random() * 20;
          pos[i * 3 + 2] = (Math.random() * 2 - 1) * half;
        }
      }
      rain.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  function toggleRain(enabled) {
    rain.enabled = !!enabled;
    if (rain.enabled && !rain.points) createRain(cfg.rainCount);
    if (rain.points) rain.points.visible = rain.enabled;
  }

  // Adjust rain particle count live (recreate points)
  function setRainCount(count) {
    const n = Math.max(0, Math.floor(count || 0));
    cfg.rainCount = n;
    // Remove old points if any
    if (rain.points) {
      try { root.remove(rain.points); } catch (_) {}
      try { rain.points.geometry.dispose?.(); } catch (_) {}
      rain.points = null;
      rain.velocities = null;
    }
    if (rain.enabled && n > 0) {
      createRain(n);
      if (rain.points) rain.points.visible = true;
    }
  }

  // Convenience levels: 0=low, 1=medium, 2=high
  function setRainLevel(level) {
    const lvl = Math.max(0, Math.min(2, parseInt(level, 10) || 0));
    const map = [300, 900, 1800];
    setRainCount(map[lvl]);
  }

  // Expose a small API and return
  return {
    root,
    update,
    toggleRain,
    setRainCount,
    setRainLevel,
    addVillage: (center, n, r) => generateVillage(center, n, r),
  };
}
