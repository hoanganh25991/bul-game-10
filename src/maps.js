/**
 * Map Manager
 * - Defines MAP 1..N with unlock requirements and enemy modifiers per map
 * - Persists current map index and unlocked max to localStorage
 * - Provides a simple API to integrate with UI and enemy spawning
 */
export function createMapManager() {
  const LS_CUR = "mapCurrentIndex";
  const LS_MAX = "mapUnlockedMax";

  // Endless tuning beyond the defined Acts
  const ENDLESS = {
    hpGrowthPerDepth: 1.18,
    dmgGrowthPerDepth: 1.16,
    speedGrowthPerDepth: 1.03,
    countGrowthPerDepth: 1.04,
  };

  // Definitions: tune per-map enemy tint and multipliers
  const maps = [
    {
      index: 1,
      name: "Act I — Fields of Awakening",
      requiredLevel: 1,
      enemyTint: 0xff8080,
      enemyHpMul: 1.0,
      enemyDmgMul: 1.0,
      desc: "A storm-stained grove outside the origin village. Fallen scouts and skittering beasts swarm the woods.",
      strongEnemies: ["Ravagers (fast melee)", "Wispcasters (ranged shock)"],
      img: "images/maps/1.png",
      imgHint: "Square art: dark forest clearing under a thundercloud sky; faint ruins; red-tinted foes.",
    },
    {
      index: 2,
      name: "Act II — Stormreach Plains",
      requiredLevel: 5,
      enemyTint: 0xffb060,
      enemyHpMul: 1.35,
      enemyDmgMul: 1.2,
      desc: "Open grasslands where thunder never fades. Raiding packs and lightning-touched archers roam freely.",
      strongEnemies: ["Storm Hounds (pack hunters)", "Ballistarii (armored archers)"],
      img: "images/maps/2.png",
      imgHint: "Square art: windswept plains with distant thunderheads; orange-tinted foes.",
    },
    {
      index: 3,
      name: "Act III — Tempest Peaks",
      requiredLevel: 10,
      enemyTint: 0xffe070,
      enemyHpMul: 1.8,
      enemyDmgMul: 1.45,
      desc: "Knife-edged ridgelines where the wind howls like a beast. Altitude and storm converge to test your mettle.",
      strongEnemies: ["Harpy Matrons (dive assaults)", "Thunder Shamans (support casters)"],
      img: "images/maps/3.png",
      imgHint: "Square art: lightning-struck mountain ridge; golden-tinted foes, dark sky.",
    },
    {
      index: 4,
      name: "Act IV — Sky Citadel",
      requiredLevel: 20,
      enemyTint: 0xa0ffd1,
      enemyHpMul: 2.4,
      enemyDmgMul: 1.8,
      desc: "A floating bastion crackling with bound sigils. Only the resolute can breach its shining walls.",
      strongEnemies: ["Sentinel Constructs (shielded)", "Zealous Templars (coordinated strikes)"],
      img: "images/maps/4.png",
      imgHint: "Square art: floating fortress with crackling runes; teal-tinted foes.",
    },
    {
      index: 5,
      name: "Act V — The Godforge",
      requiredLevel: 35,
      enemyTint: 0x9fd8ff,
      enemyHpMul: 3.2,
      enemyDmgMul: 2.3,
      desc: "An eldritch foundry where power is hammered into being. Sparks of divinity burn those who trespass.",
      strongEnemies: ["Forge Colossus (heavy slam)", "Aether Smiths (channeling blasts)"],
      img: "images/maps/5.png",
      imgHint: "Square art: colossal heavenly forge, molten channels, pale-blue aura; azure-tinted foes.",
    },
  ];

  // Allow endless indices (no upper clamp)
  function clampIndex(i) {
    const idx = Math.max(1, Math.floor(i || 1));
    return idx;
  }

  function depthForIndex(i) {
    const idx = clampIndex(i);
    return idx > maps.length ? (idx - maps.length) : 0;
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
    const cur = maps.find((m) => m.index === currentIndex);
    if (cur) return cur;
    // Synthesize an endless map descriptor
    const depth = depthForIndex(currentIndex);
    const base = maps[maps.length - 1];
    return {
      index: currentIndex,
      name: `Endless +${depth}`,
      requiredLevel: base.requiredLevel + depth * 5,
      enemyTint: base.enemyTint,
      enemyHpMul: base.enemyHpMul,
      enemyDmgMul: base.enemyDmgMul,
      desc: `Endless Depth ${depth}. Enemies grow stronger with each depth.`,
      strongEnemies: base.strongEnemies,
      img: base.img,
      imgHint: base.imgHint,
      _endlessDepth: depth,
    };
  }

  function getModifiers() {
    const cur = getCurrent();
    const depth = cur._endlessDepth ? cur._endlessDepth : 0;
    const pow = (v, p) => Math.pow(v, Math.max(0, p));
    const enemyHpMul = (cur.enemyHpMul || 1) * pow(ENDLESS.hpGrowthPerDepth, depth);
    const enemyDmgMul = (cur.enemyDmgMul || 1) * pow(ENDLESS.dmgGrowthPerDepth, depth);
    const enemySpeedMul = pow(ENDLESS.speedGrowthPerDepth, depth);
    const enemyCountMul = pow(ENDLESS.countGrowthPerDepth, depth);
    return {
      enemyTint: cur.enemyTint,
      enemyHpMul,
      enemyDmgMul,
      enemySpeedMul,
      enemyCountMul,
      depth,
      name: cur.name,
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
    // Unlock all defined maps whose requiredLevel is met
    let maxIdx = unlockedMax;
    for (const m of maps) {
      if (heroLevel >= m.requiredLevel) {
        maxIdx = Math.max(maxIdx, m.index);
      }
    }
    // Additionally unlock endless depths gradually (every 5 hero levels adds +1 depth)
    const extraDepth = Math.max(0, Math.floor((heroLevel - (maps[maps.length - 1]?.requiredLevel || 1)) / 5));
    const endlessMaxIndex = maps.length + extraDepth;
    maxIdx = Math.max(maxIdx, endlessMaxIndex);

    if (maxIdx !== unlockedMax) {
      unlockedMax = maxIdx;
      saveInt(LS_MAX, unlockedMax);
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
