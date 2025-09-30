import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { makeNoiseTexture, createSeededRNG, seededRange } from "./utils.js";
import { WORLD } from "./constants.js";
import { createHouse, createGreekTemple, createVilla, createGreekColumn, createCypressTree, createOliveTree, createGreekStatue, createObelisk } from "./meshes.js";
import { placeStructures } from "./environment/structures.js";

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
  // Freeze static overlay transform
  try { groundOverlay.matrixAutoUpdate = false; groundOverlay.updateMatrix(); } catch (_) {}

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
  // Water placeholder (declared early so update() can reference it safely)
  let water = null;

  // ----------------
  // Primitive props
  // ----------------
  function createTree() {
    const g = new THREE.Group();

    const h = 1.6 + Math.random() * 1.2;
    const trunkGeo = new THREE.CylinderGeometry(0.12 * (0.85 + Math.random() * 0.6), 0.12 * (0.85 + Math.random() * 0.6), h * 0.45, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x332a22 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h * 0.225;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageGeo = new THREE.ConeGeometry(h * 0.6, h * 0.9, 8);
    // shift foliage color slightly toward cyan/teal to match thunder theme
    const hueBase = 0.52 + (Math.random() - 0.5) * 0.04;
    const foliageMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hueBase, 0.45 + Math.random() * 0.12, 0.18 + Math.random() * 0.06)
    });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = h * 0.9;
    foliage.castShadow = true;
    g.add(foliage);

    // Freeze local transforms of static child meshes; parent group 'g' is animated for sway
    try {
      trunk.matrixAutoUpdate = false; trunk.updateMatrix();
      foliage.matrixAutoUpdate = false; foliage.updateMatrix();
    } catch (_) {}

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
    const mat = new THREE.MeshStandardMaterial({ color: 0x223344 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    m.castShadow = true;
    return m;
  }

  function createFlower() {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24), new THREE.MeshStandardMaterial({ color: 0x1a7a3e }));
    stem.position.y = 0.12;
    g.add(stem);
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffb86b }));
    petal.position.y = 0.28;
    g.add(petal);
    g.scale.setScalar(0.9 + Math.random() * 0.6);
    return g;
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
  // Instanced trees (trunks + foliage) with per-instance sway data
  const treesTrunkGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 6);
  const treesTrunkMat = new THREE.MeshStandardMaterial({ color: 0x332a22 });
  const treesFoliageGeo = new THREE.ConeGeometry(1, 1, 8);
  const treesFoliageMat = new THREE.MeshStandardMaterial({ vertexColors: true });

  const treesTrunkIM = new THREE.InstancedMesh(treesTrunkGeo, treesTrunkMat, Math.max(0, cfg.treeCount | 0));
  const treesFoliageIM = new THREE.InstancedMesh(treesFoliageGeo, treesFoliageMat, Math.max(0, cfg.treeCount | 0));
  const __treesData = new Array(Math.max(0, cfg.treeCount | 0));

  {
    const m = new THREE.Matrix4();
    const tBase = new THREE.Matrix4();
    const rZ = new THREE.Matrix4();
    const tUp = new THREE.Matrix4();
    const rY = new THREE.Matrix4();
    const s = new THREE.Matrix4();
    for (let i = 0; i < __treesData.length; i++) {
      const p = randomPosInBounds();
      const h = 1.6 + Math.random() * 1.2;
      const rMul = 0.85 + Math.random() * 0.6;
      const rotY = Math.random() * Math.PI * 2;
      const phase = Math.random() * Math.PI * 2;
      const amp = 0.004 + Math.random() * 0.01;

      // Derived dims to match previous visual rules
      const trunkH = h * 0.45;
      const trunkHC = trunkH * 0.5;      // center Y offset for trunk (unit height=1)
      const foliageR = h * 0.6;
      const foliageH = h * 0.9;
      const foliageY = h * 0.9;          // center Y offset for foliage

      __treesData[i] = {
        x: p.x, z: p.z,
        rMul,
        trunkH, trunkHC,
        foliageR, foliageH, foliageY,
        ry: rotY,
        phase, amp
      };

      // Initial pose (no sway) — trunk
      tBase.makeTranslation(p.x, 0, p.z);
      rZ.makeRotationZ(0);
      tUp.makeTranslation(0, trunkHC, 0);
      rY.makeRotationY(rotY);
      s.makeScale(rMul, trunkH, rMul);
      m.copy(tBase).multiply(rZ).multiply(tUp).multiply(rY).multiply(s);
      treesTrunkIM.setMatrixAt(i, m);

      // Initial pose (no sway) — foliage
      tUp.makeTranslation(0, foliageY, 0);
      s.makeScale(foliageR, foliageH, foliageR);
      m.copy(tBase).multiply(rZ).multiply(tUp).multiply(rY).multiply(s);
      treesFoliageIM.setMatrixAt(i, m);

      // Per-instance foliage color (slight hue shift as before)
      const hueBase = 0.52 + (Math.random() - 0.5) * 0.04;
      const col = new THREE.Color().setHSL(hueBase, 0.45 + Math.random() * 0.12, 0.18 + Math.random() * 0.06);
      try { treesFoliageIM.setColorAt(i, col); } catch (_) {}
    }
    try { treesFoliageIM.instanceColor.needsUpdate = true; } catch (_) {}
    try { treesTrunkIM.instanceMatrix.needsUpdate = true; treesFoliageIM.instanceMatrix.needsUpdate = true; } catch (_) {}
  }

  const rocks = new THREE.Group();
  const flowers = new THREE.Group();
  rocks.name = "rocks";
  flowers.name = "flowers";
  // Instanced rocks to reduce draw calls
  {
    const count = Math.max(0, cfg.rockCount | 0);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x223344 });
    const im = new THREE.InstancedMesh(rockGeo, rockMat, count);
    const h = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const p = randomPosInBounds();
      // Preserve original randomization (approximate): random base + random extra scale
      const s0 = 0.6 + Math.random() * 1.4;
      const s1 = 0.7 + Math.random() * 1.2;
      const sc = s0 * s1;
      h.position.set(p.x, 0, p.z);
      h.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      h.scale.set(sc, sc, sc);
      h.updateMatrix();
      im.setMatrixAt(i, h.matrix);
    }
    try { im.instanceMatrix.needsUpdate = true; } catch (_) {}
    im.receiveShadow = true;
    try { im.castShadow = false; } catch (_) {}
    rocks.add(im);
  }
  // Instanced flowers (stems + petals) to reduce draw calls
  {
    const count = Math.max(0, cfg.flowerCount | 0);
    const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.24);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x1a7a3e });
    const petalGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffb86b });

    const stemsIM = new THREE.InstancedMesh(stemGeo, stemMat, count);
    const petalsIM = new THREE.InstancedMesh(petalGeo, petalMat, count);
    const h = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const p = randomPosInBounds();
      const s = 0.9 + Math.random() * 0.6;

      // Stem: original stem positioned at y=0.12; keep bottom at ground after scaling
      h.position.set(p.x, 0.12 * s, p.z);
      h.rotation.set(0, 0, 0);
      h.scale.set(s, s, s);
      h.updateMatrix();
      stemsIM.setMatrixAt(i, h.matrix);

      // Petal: original petal positioned at y=0.28; match scaling
      h.position.set(p.x, 0.28 * s, p.z);
      h.rotation.set(0, 0, 0);
      h.scale.set(s, s, s);
      h.updateMatrix();
      petalsIM.setMatrixAt(i, h.matrix);
    }
    try {
      stemsIM.instanceMatrix.needsUpdate = true;
      petalsIM.instanceMatrix.needsUpdate = true;
    } catch (_) {}
    flowers.add(stemsIM);
    flowers.add(petalsIM);
  }

  root.add(treesTrunkIM, treesFoliageIM, rocks, flowers);

  // Small circular lake with simple reflection (restored)
  (function addWater() {
    if (!cfg.enableWater) return;
    const pos = seededRandomPosInBounds();
    pos.y = 0.015;
    const radius = Math.max(6, Math.min(28, cfg.waterRadius || 18));
    const geo = new THREE.CircleGeometry(radius, 64);

    const fallbackMat = new THREE.MeshStandardMaterial({
      color: 0x3a5f7a,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.95
    });

    try {
      import("https://unpkg.com/three@0.160.0/examples/jsm/objects/Reflector.js").then((mod) => {
        try {
          const Reflector = mod.Reflector || mod.default || null;
          if (Reflector) {
            const mirror = new Reflector(geo, {
              color: 0x335c77,
              textureWidth: 256,
              textureHeight: 256,
              clipBias: 0.003
            });
            mirror.rotation.x = -Math.PI / 2;
            mirror.position.copy(pos);
            root.add(mirror);
            water = mirror;
            return;
          }
        } catch (e) {}
        // Fallback non-reflective water
        const mesh = new THREE.Mesh(geo, fallbackMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        root.add(mesh);
        water = mesh;
      }).catch(() => {
        const mesh = new THREE.Mesh(geo, fallbackMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        root.add(mesh);
        water = mesh;
      });
    } catch (_) {
      const mesh = new THREE.Mesh(geo, fallbackMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(pos);
      root.add(mesh);
      water = mesh;
    }
  })();

  // Add denser forest clusters for richness
  const forest1 = createForest(new THREE.Vector3(-WORLD.groundSize * 0.15, 0, -WORLD.groundSize * 0.12), Math.max(8, Math.floor(cfg.villageRadius*1.2)), Math.floor(cfg.treeCount * 0.25));
  const forest2 = createForest(new THREE.Vector3(WORLD.groundSize * 0.18, 0, WORLD.groundSize * 0.05), Math.max(8, Math.floor(cfg.villageRadius*1.0)), Math.floor(cfg.treeCount * 0.18));
  root.add(forest1, forest2);

  // (removed old straight cross roads; replaced with curved, connected network below)

  // ----------------
  // Village generator (simple clustering of houses)
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

        // Freeze static house hierarchy transforms
        try { house.traverse?.((o) => { if (!o) return; o.matrixAutoUpdate = false; try { o.updateMatrix?.(); } catch (_) {} }); } catch (_) {}
        vgroup.add(house);
      } catch (e) {
        // fallback safety
      }
    }
    root.add(vgroup);
    return vgroup;
  }

  // create villages and collect their centers so structures avoid them
  const villages = [];
  const villageCenters = [];
  for (let i = 0; i < cfg.villageCount; i++) {
    const c = seededRandomPosInBounds();
    villages.push(generateVillage(c, 4 + Math.floor(Math.random() * 6), cfg.villageRadius));
    villageCenters.push(c);
  }

  try {
    placeStructures({
      rng,
      seededRange,
      root,
      villageCenters,
      water,
      cfg,
      __q,
      acquireLight,
      createGreekTemple,
      createVilla,
      createGreekColumn,
      createCypressTree,
      createOliveTree,
      createGreekStatue,
      createObelisk,
      pickPos: (minVillage = 12, minWater = 10, minBetween = 10, maxTries = 60) => {
        let tries = maxTries;
        while (tries-- > 0) {
          const p = seededRandomPosInBounds();
          if (p) return p;
        }
        return seededRandomPosInBounds();
      }
    });
  } catch (e) {
    console.warn("Extra structures generation failed", e);
  }

  // (structures were moved to src/environment/structures.js - handled above)

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
    const mat = new THREE.PointsMaterial({ color: 0xbfdcff, size: 0.08, transparent: true, opacity: 0.8, depthWrite: false });
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

    // Subtle tree/foliage sway: animate on an FPS-adaptive interval (instanced + legacy trees)
    let fps = 60;
    try {
      fps = (window.__perfMetrics && window.__perfMetrics.fps)
        ? window.__perfMetrics.fps
        : (1000 / Math.max(0.001, (window.__perfMetrics && window.__perfMetrics.avgMs) || 16.7));
    } catch (_) {}
    const baseInterval = (__q === "high") ? 0.06 : (__q === "medium" ? 0.12 : 0.16);
    const swayInterval = fps < 24 ? baseInterval * 2.5
                      : fps < 36 ? baseInterval * 1.8
                      : fps < 48 ? baseInterval * 1.3
                      : baseInterval;

    if ((t - __lastSwayT) > swayInterval) {
      __lastSwayT = t;

      // Update instanced trees (lean around Z, pivot at ground)
      try {
        if (typeof treesTrunkIM !== "undefined" && treesTrunkIM && Array.isArray(__treesData)) {
          const m = new THREE.Matrix4();
          const tBase = new THREE.Matrix4();
          const rZ = new THREE.Matrix4();
          const tUp = new THREE.Matrix4();
          const rY = new THREE.Matrix4();
          const s = new THREE.Matrix4();

          for (let i = 0; i < __treesData.length; i++) {
            const d = __treesData[i];
            const theta = Math.sin(t + d.phase) * d.amp;

            // Trunk
            tBase.makeTranslation(d.x, 0, d.z);
            rZ.makeRotationZ(theta);
            tUp.makeTranslation(0, d.trunkHC, 0);
            rY.makeRotationY(d.ry);
            s.makeScale(d.rMul, d.trunkH, d.rMul);
            m.copy(tBase).multiply(rZ).multiply(tUp).multiply(rY).multiply(s);
            treesTrunkIM.setMatrixAt(i, m);

            // Foliage
            tUp.makeTranslation(0, d.foliageY, 0);
            s.makeScale(d.foliageR, d.foliageH, d.foliageR);
            m.copy(tBase).multiply(rZ).multiply(tUp).multiply(rY).multiply(s);
            treesFoliageIM.setMatrixAt(i, m);
          }
          treesTrunkIM.instanceMatrix.needsUpdate = true;
          treesFoliageIM.instanceMatrix.needsUpdate = true;
        }
      } catch (_) {}

      // Update legacy (non-instanced) trees used by forest clusters
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
      const count = rain.velocities.length;

      // Adaptive rain update: under lower FPS, update a fraction per frame
      let fps = 60;
      try {
        fps = (window.__perfMetrics && window.__perfMetrics.fps)
          ? window.__perfMetrics.fps
          : (1000 / Math.max(0.001, (window.__perfMetrics && window.__perfMetrics.avgMs) || 16.7));
      } catch (_) {}

      // Update subset size based on FPS budget
      let step = count; // default: update all
      if (fps < 24) {
        step = Math.max(1, Math.floor(count * 0.25));
      } else if (fps < 36) {
        step = Math.max(1, Math.floor(count * 0.5));
      } else if (fps < 48) {
        step = Math.max(1, Math.floor(count * 0.75));
      }

      if (typeof rain._idx !== "number") rain._idx = 0;
      const start = rain._idx;

      for (let n = 0; n < step; n++) {
        const i = (start + n) % count;
        const base = i * 3;
        pos[base + 1] -= rain.velocities[i] * dt;
        if (pos[base + 1] < 0.2) {
          pos[base + 0] = (Math.random() * 2 - 1) * half;
          pos[base + 1] = 12 + Math.random() * 20;
          pos[base + 2] = (Math.random() * 2 - 1) * half;
        }
      }

      rain._idx = (start + step) % count;
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
