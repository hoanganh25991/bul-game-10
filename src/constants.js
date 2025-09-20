import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

export const COLOR = {
  blue: 0x1e90ff,
  darkBlue: 0x0b1a2b,
  midBlue: 0x123a6b,
  white: 0xe6f4ff,
  hp: 0x4ec3ff,
  mp: 0x1a73e8,
  xp: 0x9ad1ff,
  enemy: 0xff5050,
  enemyDark: 0x7a1c1c,
  portal: 0x7c4dff,
  village: 0x5aff8b,
};

export const WORLD = {
  groundSize: 500,     // local visual grid chunk size
  gridStep: 2,
  enemyCount: 12,
  enemySpawnRadius: 150,
  playerSpeed: 14,
  playerTurnSpeed: 8,
  attackRange: 14,
  basicAttackCooldown: 0.8,
  basicAttackDamage: 12,
  aiAggroRadius: 40,
  aiForgetRadius: 60,
  aiWanderRadius: 30,
  aiSpeed: 9,
  aiAttackRange: 8,
  aiAttackCooldown: 1.4,
  aiAttackDamage: 8,
};

export const STATS_BASE = {
  hp: 120,
  mp: 120,
  hpRegen: 1.2,
  mpRegen: 1.6,
  xpToLevel: 100,
};

export const SKILLS = {
  Q: { name: "Chain Lightning", cd: 5, mana: 22, range: 45, jumps: 5, jumpRange: 24, dmg: 24 },
  W: { name: "Lightning Bolt (AOE)", cd: 8, mana: 34, radius: 16, dmg: 35 },
  E: { name: "Static Field (Aura)", cd: 15, mana: 0, radius: 14, tick: 0.7, dmg: 8, duration: 10, manaPerTick: 2 },
  R: { name: "Thunderstorm", cd: 22, mana: 55, radius: 30, strikes: 22, dmg: 20, duration: 7 },
};

// Village and recall/portals
export const VILLAGE_POS = new THREE.Vector3(0, 0, 0);
export const REST_RADIUS = 20;
