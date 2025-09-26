import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
/**
 * placeStructures(params)
 * - Extracted placement logic for Greek-inspired structures and nature extras from src/environment.js
 *
 * Expected params:
 * {
 *   rng,
 *   seededRange,
 *   root,
 *   villageCenters,   // array of Vector3
 *   water,            // water mesh or null
 *   cfg,              // config object from initEnvironment
 *   __q,              // quality string ("low"|"medium"|"high")
 *   acquireLight,     // function to allocate light budget
 *   createGreekTemple,
 *   createVilla,
 *   createGreekColumn,
 *   createGreekStatue,
 *   createObelisk,
 *   createCypressTree,
 *   createOliveTree,
 *   pickPos           // function to choose a placement Vector3
 * }
 *
 * This module performs placement and side-effects on the provided root group.
 */
export function placeStructures(params = {}) {
  const {
    rng,
    seededRange,
    root,
    villageCenters = [],
    water = null,
    cfg = {},
    __q = "high",
    acquireLight = () => false,
    createGreekTemple,
    createVilla,
    createGreekColumn,
    createGreekStatue,
    createObelisk,
    createCypressTree,
    createOliveTree,
    pickPos,
  } = params;

  if (!root || !rng || !seededRange || !pickPos) return;

  const archGroup = new THREE.Group();
  archGroup.name = "greek-architecture";
  const natureExtraGroup = new THREE.Group();
  natureExtraGroup.name = "nature-extras";

  const placed = [];
  const waterCenter = (cfg.enableWater && water) ? water.position.clone().setY(0) : null;

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

  function pickPosWrapped(minVillage = 12, minWater = 10, minBetween = 10, maxTries = 60) {
    let tries = maxTries;
    while (tries-- > 0) {
      const p = pickPos(minVillage, minWater, minBetween, maxTries) || (typeof rng === "function" ? (function(){ return null; })() : null);
      // pickPos provided by caller should already do seeded/random selection; if it returns a Vector3 we accept it.
      if (!p) break;
      if (farFromVillages(p, minVillage) && farFromWater(p, minWater) && farFromPlaced(p, minBetween)) {
        placed.push(p.clone());
        return p;
      }
    }
    // fallback: ask caller pickPos again and accept it
    const p = pickPos(minVillage, minWater, minBetween, maxTries);
    if (p) placed.push(p.clone());
    return p;
  }

  // Density counts (copied logic from original)
  const __templeCountForDensity = (__q === "low") ? 0 : 1;
  const __villaCountForDensity = (__q === "low") ? 2 : (__q === "medium" ? 4 : 7);
  const __columnCountForDensity = (__q === "low") ? 4 : (__q === "medium" ? 8 : 14);
  const __statueCountForDensity = (__q === "low") ? 3 : (__q === "medium" ? 5 : 8);
  const __obeliskCountForDensity = (__q === "low") ? 2 : (__q === "medium" ? 4 : 6);

  const orders = ["doric", "ionic", "corinthian"];
  let structureTypes = [
    {
      key: "temple",
      place() {
        const pos = pickPosWrapped(16, 14, 24);
        if (!pos) return;
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
        const pos = pickPosWrapped(10, 10, 12);
        if (!pos) return;
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
        const pos = pickPosWrapped(8, 8, 8);
        if (!pos) return;
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
        const pos = pickPosWrapped(8, 8, 10);
        if (!pos) return;
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
        const pos = pickPosWrapped(10, 10, 12);
        if (!pos) return;
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

  const typeByKey = Object.fromEntries(structureTypes.map(t => [t.key, t]));
  const typePool = [];
  const pushNTimes = (key, count) => { for (let i = 0; i < count; i++) typePool.push(key); };
  pushNTimes("temple", __templeCountForDensity);
  pushNTimes("villa", __villaCountForDensity);
  pushNTimes("column", __columnCountForDensity);
  pushNTimes("statue", __statueCountForDensity);
  pushNTimes("obelisk", __obeliskCountForDensity);

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

  // Nature extras unified density
  const __cypressCountForDensity = (__q === "low") ? 24 : (__q === "medium" ? 40 : 60);
  const __oliveCountForDensity = (__q === "low") ? 16 : (__q === "medium" ? 26 : 40);
  const natureTreeSpotCount = __cypressCountForDensity + __oliveCountForDensity;

  const cypressGroup = new THREE.Group();
  cypressGroup.name = "cypress";
  const oliveGroup = new THREE.Group();
  oliveGroup.name = "olive";

  const naturePool = [];
  for (let i = 0; i < __cypressCountForDensity; i++) naturePool.push("cypress");
  for (let i = 0; i < __oliveCountForDensity; i++) naturePool.push("olive");
  // Seeded shuffle
  for (let i = naturePool.length - 1; i > 0; i--) {
    const j = Math.floor(seededRange(rng, 0, i + 1));
    const tmp = naturePool[i]; naturePool[i] = naturePool[j]; naturePool[j] = tmp;
  }
  naturePool.forEach((kind) => {
    const p = pickPosWrapped(4, 6, 2);
    if (!p) return;
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
}
