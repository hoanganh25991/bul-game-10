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
  // Increased enemy density for "hunter" playstyle:
  enemyCount: 200,
  enemySpawnRadius: 220,
  // Make the player slightly faster and more responsive
  playerSpeed: 16,
  playerTurnSpeed: 10,
  // Slightly longer attack range and faster basic attack
  attackRange: 32,
  attackRangeMult: 1,
  basicAttackCooldown: 0.2,
  basicAttackDamage: 24 * 3,
  // Enemies are more aggressive and a bit tougher
  aiAggroRadius: 60,
  aiForgetRadius: 100,
  aiWanderRadius: 40,
  aiSpeed: 10,
  aiAttackRange: 10,
  aiAttackCooldown: 1.2,
  aiAttackDamage: 14,
};

export const STATS_BASE = {
  // Hero as a "god" baseline: much higher HP/MP and regen so the player can clear many enemies
  hp: 800,
  mp: 400,
  hpRegen: 8,
  mpRegen: 4,
  // Increase XP required to level to give longer progression window
  xpToLevel: 200,
};

export const SKILLS = {
  // Significantly boosted skills for mass-clear gameplay.
  Q: { name: "Chain Lightning", cd: 4, mana: 20, range: 60, jumps: 8, jumpRange: 30, dmg: 120 },
  W: { name: "Lightning Bolt (AOE)", cd: 6, mana: 40, radius: 18, dmg: 220 },
  E: { name: "Static Field (Aura)", cd: 12, mana: 0, radius: 18, tick: 0.6, dmg: 18, duration: 12, manaPerTick: 3 },
  R: { name: "Thunderstorm", cd: 18, mana: 70, radius: 36, strikes: 40, dmg: 90, duration: 8 },
};

// Village and recall/portals
export const VILLAGE_POS = new THREE.Vector3(0, 0, 0);
export const REST_RADIUS = 20;
