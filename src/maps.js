/**
 * Map Manager
 * - Defines MAP 1..N with unlock requirements and enemy modifiers per map
 * - Persists current map index and unlocked max to localStorage
 * - Provides a simple API to integrate with UI and enemy spawning
 */
export function createMapManager() {
  const LS_CUR = "mapCurrentIndex";
  const LS_MAX = "mapUnlockedMax";

  // Definitions: tune per-map enemy tint and multipliers
  const maps = [
    {
      index: 1,
      name: "MAP 1 — Awakening Grove",
      requiredLevel: 1,
      enemyTint: 0xff8080,
      enemyHpMul: 1.0,
      enemyDmgMul: 1.0,
      desc: "Dark woods where Zeus awakens. Enemies are weak and numerous.",
    },
    {
      index: 2,
      name: "MAP 2 — Storm Plains",
      requiredLevel: 5,
      enemyTint: 0xffb060,
      enemyHpMul: 1.35,
      enemyDmgMul: 1.2,
      desc: "Open plains amidst thunder. Enemies gain vigor and hit harder.",
    },
    {
      index: 3,
      name: "MAP 3 — Tempest Peaks",
      requiredLevel: 10,
      enemyTint: 0xffe070,
      enemyHpMul: 1.8,
      enemyDmgMul: 1.45,
      desc: "Highlands of roaring winds. Stronger foes challenge your growth.",
    },
    {
      index: 4,
      name: "MAP 4 — Sky Citadel",
      requiredLevel: 20,
      enemyTint: 0xa0ffd1,
      enemyHpMul: 2.4,
      enemyDmgMul: 1.8,
      desc: "A floating bastion crackling with energy. Elite adversaries abound.",
    },
    {
      index: 5,
      name: "MAP 5 — Godforge",
      requiredLevel: 35,
      enemyTint: 0x9fd8ff,
      enemyHpMul: 3.2,
      enemyDmgMul: 2.3,
      desc: "Where gods temper power. Only the worthy can endure the onslaught.",
    },
  ];

  function clampIndex(i) {
    const idx = Math.max(1, Math.min(maps.length, Math.floor(i || 1)));
    return idx;
  }

  function loadInt(key, def = 1) {
    try {
      const v = parseInt(localStorage.getItem(key) || "", 10);
      return Number.isFinite(v) ? v : def;
    } catch {
      return def;
    }
  }

  function saveInt(key, v) {
    try {
      localStorage.setItem(key, String(Math.floor(v)));
    } catch {}
  }

  let currentIndex = clampIndex(loadInt(LS_CUR, 1));
  let unlockedMax = clampIndex(loadInt(LS_MAX, 1));

  function getCurrentIndex() {
    return currentIndex;
  }

  function getUnlockedMax() {
    return unlockedMax;
  }

  function listMaps() {
    return maps.map((m) => ({
      ...m,
      unlocked: m.index <= unlockedMax,
      current: m.index === currentIndex,
    }));
  }

  function getCurrent() {
    return maps.find((m) => m.index === currentIndex) || maps[0];
  }

  function getModifiers() {
    const m = getCurrent();
    return {
      enemyTint: m.enemyTint,
      enemyHpMul: m.enemyHpMul,
      enemyDmgMul: m.enemyDmgMul,
    };
  }

  function canSelect(index) {
    const idx = clampIndex(index);
    return idx <= unlockedMax;
  }

  function setCurrent(index) {
    const idx = clampIndex(index);
    if (!canSelect(idx)) return false;
    currentIndex = idx;
    saveInt(LS_CUR, currentIndex);
    return true;
  }

  function unlockByLevel(heroLevel) {
    let maxIdx = unlockedMax;
    for (const m of maps) {
      if (heroLevel >= m.requiredLevel) {
        maxIdx = Math.max(maxIdx, m.index);
      }
    }
    if (maxIdx !== unlockedMax) {
      unlockedMax = maxIdx;
      saveInt(LS_MAX, unlockedMax);
      // if current > unlocked, clamp back (shouldn't happen in normal flow)
      if (currentIndex > unlockedMax) {
        currentIndex = unlockedMax;
        saveInt(LS_CUR, currentIndex);
      }
      return true;
    }
    return false;
  }

  return {
    listMaps,
    getCurrent,
    getCurrentIndex,
    getUnlockedMax,
    getModifiers,
    canSelect,
    setCurrent,
    unlockByLevel,
  };
}
