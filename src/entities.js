import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR, WORLD, STATS_BASE, SCALING } from "./constants.js";
import { createGoTMesh, createEnemyMesh, createBillboardHPBar } from "./meshes.js";
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

    // Optional defense reduction (e.g., from shield/buff)
    let dmg = amount;
    try {
      if (this.defenseUntil && now() < this.defenseUntil) {
        const pct = Math.min(0.95, Math.max(0, this.defensePct || 0));
        dmg = Math.max(0, Math.floor(dmg * (1 - pct)));
      }
      // Optional vulnerability amplification (e.g., Lightning Rod / Ionize)
      if (this.vulnUntil && now() < this.vulnUntil) {
        const mul = Math.max(1.05, Math.min(3.0, this.vulnMult || 1.25));
        dmg = Math.max(0, Math.floor(dmg * mul));
      }
    } catch (_) {}

    this.hp -= dmg;
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
    const mesh = createGoTMesh();
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
    this.baseDamage = WORLD.basicAttackDamage;

    this.moveTarget = null;
    this.speed = WORLD.playerSpeed;
    this.baseSpeed = WORLD.playerSpeed;
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

    // Optional transient combat modifiers (set by skills)
    this.speedBoostMul = 1;
    this.speedBoostUntil = 0;
    this.atkSpeedMul = 1;
    this.atkSpeedPerma = 1;
    this.atkSpeedUntil = 0;
    this.defensePct = 0;
    this.defenseUntil = 0;

    // Blue light glow on the character
    const light = new THREE.PointLight(0x66b3ff, 1.2, 45, 2);
    light.position.set(0, 3.5, 0);
    mesh.add(light);
    // Load persisted level (if any) and apply stats
    try { this.loadLevelFromStorage(); } catch (_) {}
  }

  // Persist just the level
  saveLevelToStorage() {
    try { localStorage.setItem("playerLevel", String(this.level)); } catch (_) {}
  }

  // Reset stats back to STATS_BASE (level 1 baseline)
  _recomputeBaseStats() {
    this.level = 1;
    this.xp = 0;
    this.xpToLevel = STATS_BASE.xpToLevel;
    this.maxHP = STATS_BASE.hp;
    this.hp = this.maxHP;
    this.maxMP = STATS_BASE.mp;
    this.mp = this.maxMP;
    this.hpRegen = STATS_BASE.hpRegen;
    this.mpRegen = STATS_BASE.mpRegen;
    this.baseDamage = WORLD.basicAttackDamage;
    this.speed = WORLD.playerSpeed;
    this.atkSpeedPerma = 1;
  }

  // Deterministically set level and recompute stats from base using SCALING
  setLevel(level) {
    const lvl = Math.max(1, Math.floor(level || 1));
    this._recomputeBaseStats();
    if (lvl > 1) {
      for (let i = 2; i <= lvl; i++) {
        this.maxHP = Math.floor(this.maxHP * SCALING.hero.hpGrowth);
        this.maxMP = Math.floor(this.maxMP * SCALING.hero.mpGrowth);
        this.hpRegen *= SCALING.hero.hpRegenGrowth;
        this.mpRegen *= SCALING.hero.mpRegenGrowth;
        this.baseDamage = Math.floor(this.baseDamage * SCALING.hero.baseDamageGrowth);
        this.xpToLevel = Math.floor(this.xpToLevel * SCALING.xpGrowth);
      }
      this.level = lvl;
      this.hp = this.maxHP;
      this.mp = this.maxMP;
      // Apply level-based permanent movement and attack speed growth
      this.speed = WORLD.playerSpeed * Math.pow(SCALING.hero.moveSpeedGrowth, lvl - 1);
      this.atkSpeedPerma = Math.pow(SCALING.hero.atkSpeedGrowth, lvl - 1);
    }
    this.saveLevelToStorage();
  }

  // Load persisted level (simple persistence)
  loadLevelFromStorage() {
    try {
      const raw = localStorage.getItem("playerLevel");
      if (!raw) return;
      const lvl = parseInt(raw, 10);
      if (Number.isFinite(lvl) && lvl > 1) {
        this.setLevel(lvl);
      }
    } catch (_) {}
  }

  gainXP(amount) {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= this.xpToLevel) {
      this.xp -= this.xpToLevel;
      this.level += 1;
      gained += 1;
      // scale stats per level (configurable via SCALING)
      this.maxHP = Math.floor(this.maxHP * SCALING.hero.hpGrowth);
      this.maxMP = Math.floor(this.maxMP * SCALING.hero.mpGrowth);
      this.hp = this.maxHP;
      this.mp = this.maxMP;
      this.hpRegen *= SCALING.hero.hpRegenGrowth;
      this.mpRegen *= SCALING.hero.mpRegenGrowth;
      this.baseDamage = Math.floor(this.baseDamage * SCALING.hero.baseDamageGrowth);
      this.xpToLevel = Math.floor(this.xpToLevel * SCALING.xpGrowth);
      // Increment permanent movement and attack speed multipliers
      this.speed *= SCALING.hero.moveSpeedGrowth;
      this.atkSpeedPerma *= SCALING.hero.atkSpeedGrowth;
    }

    // Persist level if changed
    if (gained > 0) {
      try { this.saveLevelToStorage(); } catch (_) {}
    }

    // Dispatch a level-up event for UI to react (e.g., glow skill buttons)
    if (gained > 0 && typeof window !== "undefined" && window.dispatchEvent) {
      try {
        window.dispatchEvent(
          new CustomEvent("player-levelup", { detail: { level: this.level, gained } })
        );
      } catch (e) {
        // ignore if environment does not support CustomEvent
      }
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
  constructor(position, level = 1) {
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
    const levelHpMul = Math.pow(SCALING.enemy.hpGrowthPerLevel, Math.max(0, (level || 1) - 1));
    this.maxHP = Math.max(8, Math.floor(baseHP * tierMult[tier] * levelHpMul));
    this.hp = this.maxHP;

    this.moveTarget = null;
    this.speed = WORLD.aiSpeed * (tier === "boss" ? 0.9 : tier === "elite" ? 1.05 : 1);
    this.nextAttackReady = 0;

    // Attack damage scales with tier (used in combat)
    const dmgMult = { normal: 1, tough: 1.8, elite: 3.2, boss: 6 };
    const levelDmgMul = Math.pow(SCALING.enemy.dmgGrowthPerLevel, Math.max(0, (level || 1) - 1));
    this.attackDamage = Math.max(1, Math.floor(WORLD.aiAttackDamage * dmgMult[tier] * levelDmgMul));

    // Kind/species: melee or ranged with distinct size/speed/range/effects
    const kr = Math.random();
    let kind = "brute"; // default melee heavy
    if (kr < 0.25) kind = "brute";
    else if (kr < 0.5) kind = "raider";
    else if (kr < 0.75) kind = "archer";
    else kind = "shocker";
    this.kind = kind;

    if (kind === "brute") {
      // Big melee
      this.attackRange = 2.4;
      this.attackCooldown = (WORLD.aiAttackCooldown || 1.6) * 0.95;
      this.attackEffect = "melee";
      this.beamColor = 0xff8844;
      this.speed *= 0.9;
      this.attackDamage = Math.floor(this.attackDamage * 1.2);
      this.mesh.scale.multiplyScalar(1.25);
    } else if (kind === "raider") {
      // Fast melee
      this.attackRange = 2.2;
      this.attackCooldown = (WORLD.aiAttackCooldown || 1.6) * 0.85;
      this.attackEffect = "melee";
      this.beamColor = 0xffaa66;
      this.speed *= 1.15;
      this.attackDamage = Math.floor(this.attackDamage * 0.9);
      this.mesh.scale.multiplyScalar(1.05);
    } else if (kind === "archer") {
      // Ranged physical
      this.attackRange = 18;
      this.attackCooldown = (WORLD.aiAttackCooldown || 1.6) * 1.1;
      this.attackEffect = "beam";
      this.beamColor = 0xffcc88;
      this.speed *= 1.0;
      this.attackDamage = Math.floor(this.attackDamage * 1.0);
      this.mesh.scale.multiplyScalar(0.95);
    } else if (kind === "shocker") {
      // Ranged arcane (no thunder – hero-exclusive). Use non-electric beam.
      this.attackRange = 24;
      this.attackCooldown = (WORLD.aiAttackCooldown || 1.6) * 1.25;
      this.attackEffect = "beam";
      this.beamColor = 0xc070ff; // arcane/magenta
      this.speed *= 0.95;
      this.attackDamage = Math.floor(this.attackDamage * 0.95);
      this.mesh.scale.multiplyScalar(1.1);
    }

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

  respawn(position, level = 1) {
    // Reset core state
    this.alive = true;
    this.mesh.visible = true;
    this.moveTarget = null;
    this.nextAttackReady = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
    if (position) this.mesh.position.copy(position);

    // Recalculate stats based on tier and current hero level
    const tierMult = { normal: 1, tough: 3, elite: 8, boss: 30 };
    const dmgMult = { normal: 1, tough: 1.8, elite: 3.2, boss: 6 };
    const baseHP = randBetween(60, 120);
    const levelHpMul = Math.pow(SCALING.enemy.hpGrowthPerLevel, Math.max(0, (level || 1) - 1));
    const levelDmgMul = Math.pow(SCALING.enemy.dmgGrowthPerLevel, Math.max(0, (level || 1) - 1));
    this.maxHP = Math.max(8, Math.floor(baseHP * tierMult[this.tier] * levelHpMul));
    this.hp = this.maxHP;
    this.attackDamage = Math.max(1, Math.floor(WORLD.aiAttackDamage * dmgMult[this.tier] * levelDmgMul));
    this.xpOnDeath = Math.max(8, Math.floor(this.maxHP / 10));
    this._xpGranted = false;

    // Refresh HP bar visual
    if (this.hpBar && this.hpBar.fill) {
      this.hpBar.fill.scale.x = 1;
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
 * World position of GoT's right hand (thunder hand); fallback to chest height.
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

/**
 * World position of GoT's left hand.
 * @param {Player} player
 * @returns {THREE.Vector3}
 */
export function leftHandWorldPos(player) {
  if (player && player.mesh && player.mesh.userData && player.mesh.userData.leftHandAnchor) {
    const v = new THREE.Vector3();
    player.mesh.userData.leftHandAnchor.getWorldPosition(v);
    return v;
  }
  return player.pos().clone().add(new THREE.Vector3(-0.4, 1.6, 0.25));
}
