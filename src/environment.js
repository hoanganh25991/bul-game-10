import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { makeNoiseTexture } from "./utils.js";
import { WORLD } from "./constants.js";
import { createHouse } from "./meshes.js";

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
      enableRain: false,
      rainCount: 800,
      seed: Date.now(),
    },
    options
  );

  const root = new THREE.Group();
  root.name = "environment";
  scene.add(root);

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

  // ----------------
  // Primitive props
  // ----------------
  function createTree() {
    const g = new THREE.Group();

    const h = 1.6 + Math.random() * 1.2;
    const trunkGeo = new THREE.CylinderGeometry(0.12 * (0.85 + Math.random() * 0.6), 0.12 * (0.85 + Math.random() * 0.6), h * 0.45, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x332a22, roughness: 0.92, metalness: 0.0 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h * 0.225;
    trunk.castShadow = true;
    g.add(trunk);

    const foliageGeo = new THREE.ConeGeometry(h * 0.6, h * 0.9, 8);
    // shift foliage color slightly toward cyan/teal to match thunder theme
    const hueBase = 0.52 + (Math.random() - 0.5) * 0.04;
    const foliageMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hueBase, 0.45 + Math.random() * 0.12, 0.18 + Math.random() * 0.06),
      roughness: 0.72,
      metalness: 0.0,
    });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.y = h * 0.9;
    foliage.castShadow = true;
    g.add(foliage);

    // small sway params used by update() to animate subtle motion
    g.userData.swayPhase = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.004 + Math.random() * 0.01;

    g.scale.setScalar(0.9 + Math.random() * 0.8);
    return g;
  }

  function createRock() {
    const s = 0.6 + Math.random() * 1.4;
    const geo = new THREE.DodecahedronGeometry(s, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.95, metalness: 0.05 });
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
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({ color: 0xffcc66, emissive: 0xffb86b, roughness: 0.9 }));
    petal.position.y = 0.28;
    g.add(petal);
    g.scale.setScalar(0.9 + Math.random() * 0.6);
    return g;
  }

  // Road helper - simple textured strip/plane to represent a path/road
  function createRoad(center = new THREE.Vector3(0,0,0), angle = 0, length = WORLD.groundSize * 0.8, width = 6) {
    const geo = new THREE.PlaneGeometry(length, width, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: 0.95, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.y = angle;
    mesh.position.copy(center);
    mesh.position.y = 0.015;
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

  // Add simple cross roads near center (X and Z axes) to create paths between villages
  const roadX = createRoad(new THREE.Vector3(0, 0, 0), 0, WORLD.groundSize * 0.9, 6);
  const roadZ = createRoad(new THREE.Vector3(0, 0, 0), Math.PI / 2, WORLD.groundSize * 0.9, 6);
  root.add(roadX, roadZ);

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
        const lanternLight = new THREE.PointLight(0xffd8a8, 0.9, 6, 2);
        lanternLight.position.set(0.6, 0.8, 0.6);
        lanternLight.castShadow = false;
        house.add(lanternLight);

        const lanternBulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 8, 8),
          new THREE.MeshStandardMaterial({ emissive: 0xffd8a8, emissiveIntensity: 1.2, color: 0x663300, roughness: 0.7 })
        );
        lanternBulb.position.copy(lanternLight.position);
        house.add(lanternBulb);

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

  // Fireflies: small glowing points around village centers for ambiance
  const fireflies = new THREE.Group();
  villageCenters.forEach((center, idx) => {
    const count = 24 + Math.floor(Math.random() * 16);
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

    // subtle tree/foliage sway: animate any object with userData.swayPhase
    root.traverse((obj) => {
      if (obj.userData && typeof obj.userData.swayPhase !== "undefined") {
        const phase = obj.userData.swayPhase || 0;
        const amp = obj.userData.swayAmp || 0.006;
        obj.rotation.z = Math.sin(t + phase) * amp;
      }
    });

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

  // Expose a small API and return
  return {
    root,
    update,
    toggleRain,
    addVillage: (center, n, r) => generateVillage(center, n, r),
  };
}
