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
    const mesh = createEnemyMesh();
    super(mesh, 1.1);
    this.team = "enemy";
    this.maxHP = randBetween(60, 120);
    this.hp = this.maxHP;
    this.moveTarget = null;
    this.speed = WORLD.aiSpeed;
    this.nextAttackReady = 0;

    mesh.position.copy(position);

    // small billboard hp bar
    this.hpBar = createBillboardHPBar();
    mesh.add(this.hpBar.container);
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
