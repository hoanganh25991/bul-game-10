import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR, WORLD, STATS_BASE } from "./constants.js";
import { createZeusMesh, createEnemyMesh, createBillboardHPBar } from "./meshes.js";
import { distance2D, now } from "./utils.js";

export class Entity {
  constructor(mesh, radius = 1) {
    this.mesh = mesh;
    this.radius = radius;
    this.alive = true;
    this.maxHP = 100;
    this.hp = 100;
    this.team = "neutral";
  }
  pos() {
    return this.mesh.position;
  }
  takeDamage(amount) {
    if (!this.alive) return;
    if (this.invulnUntil && now() < this.invulnUntil) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.onDeath && this.onDeath();
      this.mesh.visible = false;
    }
  }
}

export class Player extends Entity {
  constructor() {
    const mesh = createZeusMesh();
    super(mesh, 1.2);
    this.team = "player";
    this.level = 1;
    this.xp = 0;
    this.xpToLevel = STATS_BASE.xpToLevel;
    this.maxHP = STATS_BASE.hp;
    this.hp = this.maxHP;
    this.maxMP = STATS_BASE.mp;
    this.mp = this.maxMP;
    this.hpRegen = STATS_BASE.hpRegen;
    this.mpRegen = STATS_BASE.mpRegen;

    this.moveTarget = null;
    this.speed = WORLD.playerSpeed;
    this.turnSpeed = WORLD.playerTurnSpeed;
    this.target = null; // enemy to attack
    this.nextBasicReady = 0;

    this.attackMove = false;
    this.frozen = false;
    this.deadUntil = 0;
    this.holdUntil = 0;
    this.idlePhase = 0;
    this.lastFacingYaw = 0;
    this.lastFacingUntil = 0;
    this.braceUntil = 0;

    this.aimMode = false; // aim mode while placing targeted skills
    this.aimModeSkill = null; // which skill initiated aim mode (e.g., 'W')
    this.staticField = { active: false, until: 0, nextTick: 0 };

    // Blue light glow on the character
    const light = new THREE.PointLight(0x66b3ff, 1.2, 45, 2);
    light.position.set(0, 3.5, 0);
    mesh.add(light);
  }

  gainXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToLevel) {
      this.xp -= this.xpToLevel;
      this.level += 1;
      // scale stats per level
      this.maxHP = Math.floor(this.maxHP * 1.12);
      this.maxMP = Math.floor(this.maxMP * 1.1);
      this.hp = this.maxHP;
      this.mp = this.maxMP;
      this.hpRegen *= 1.08;
      this.mpRegen *= 1.06;
      this.xpToLevel = Math.floor(this.xpToLevel * 1.2);
    }
  }

  canSpend(mana) {
    return this.mp >= mana;
  }
  spend(mana) {
    this.mp = Math.max(0, this.mp - mana);
  }
}

export class Enemy extends Entity {
  constructor(position) {
    // Determine tier for visual variety and scaling (normal, tough, elite, boss)
    const r = Math.random();
    let tier = "normal";
    if (r < 0.005) tier = "boss";
    else if (r < 0.04) tier = "elite";
    else if (r < 0.22) tier = "tough";

    const TIER_COLOR = {
      normal: COLOR.enemyDark,
      tough: 0xff8a50,
      elite: 0xffd86a,
      boss: 0xffeb99,
    };
    const TIER_EYE = {
      normal: 0x550000,
      tough: 0xff5500,
      elite: 0xffaa00,
      boss: 0xffee88,
    };

    const mesh = createEnemyMesh({ color: TIER_COLOR[tier], eyeEmissive: TIER_EYE[tier] });
    super(mesh, 1.1);
    this.team = "enemy";
    this.tier = tier;

    // HP scaled by tier so stronger tiers are noticeably tougher
    const tierMult = { normal: 1, tough: 3, elite: 8, boss: 30 };
    const baseHP = randBetween(60, 120);
    this.maxHP = Math.max(8, Math.floor(baseHP * tierMult[tier]));
    this.hp = this.maxHP;

    this.moveTarget = null;
    this.speed = WORLD.aiSpeed * (tier === "boss" ? 0.9 : tier === "elite" ? 1.05 : 1);
    this.nextAttackReady = 0;

    // Attack damage scales with tier (used in combat)
    const dmgMult = { normal: 1, tough: 1.8, elite: 3.2, boss: 6 };
    this.attackDamage = Math.max(1, Math.floor(WORLD.aiAttackDamage * dmgMult[tier]));

    // XP reward scales with HP so killing stronger enemies is rewarding
    this.xpOnDeath = Math.max(8, Math.floor(this.maxHP / 10));

    mesh.position.copy(position);

    // small billboard hp bar (scaled by tier for readability)
    this.hpBar = createBillboardHPBar();
    const barScale = tier === "boss" ? 2.2 : tier === "elite" ? 1.5 : tier === "tough" ? 1.15 : 1;
    this.hpBar.container.scale.set(barScale, barScale, barScale);
    mesh.add(this.hpBar.container);

    // color HP fill per tier
    const BAR_COLOR = {
      normal: COLOR.enemy,
      tough: 0xffa65a,
      elite: 0xffe085,
      boss: 0xfff0b3,
    };
    if (this.hpBar && this.hpBar.fill && this.hpBar.fill.material) {
      this.hpBar.fill.material.color.setHex(BAR_COLOR[tier]);
    }
  }

  updateHPBar() {
    const ratio = clamp01(this.hp / this.maxHP);
    this.hpBar.fill.scale.x = Math.max(0.001, ratio);
  }
}

// Utility small helpers local to this module (avoid cross-import to keep entities lean)
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Find the nearest alive enemy to a given origin within maxDist.
 * Returns null if none are within range.
 * @param {THREE.Vector3} origin
 * @param {number} maxDist
 * @param {Enemy[]} enemies
 * @returns {Enemy|null}
 */
export function getNearestEnemy(origin, maxDist, enemies) {
  let nearest = null;
  let best = Infinity;
  for (const en of enemies) {
    if (!en.alive) continue;
    const d = distance2D(origin, en.pos());
    if (d <= maxDist && d < best) {
      best = d;
      nearest = en;
    }
  }
  return nearest;
}

/**
 * World position of Zeus's right hand (thunder hand); fallback to chest height.
 * @param {Player} player
 * @returns {THREE.Vector3}
 */
export function handWorldPos(player) {
  if (player && player.mesh && player.mesh.userData && player.mesh.userData.handAnchor) {
    const v = new THREE.Vector3();
    player.mesh.userData.handAnchor.getWorldPosition(v);
    return v;
  }
  return player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
}
