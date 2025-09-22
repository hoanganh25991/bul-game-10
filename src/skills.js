import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { WORLD, SKILLS, COLOR, VILLAGE_POS, REST_RADIUS, SCALING } from "./constants.js";
import { distance2D, now } from "./utils.js";
import { handWorldPos } from "./entities.js";
import { createGroundRing } from "./effects.js";
import { audio } from "./audio.js";

/**
 * SkillsSystem centralizes cooldowns, basic attack, Q/W/E/R skills,
 * Static Field ticking, Thunderstorm scheduling, and cooldown UI updates.
 *
 * Usage:
 *  const skills = new SkillsSystem(player, enemies, effectsManager, {
 *    Q: document.getElementById("cdQ"),
 *    W: document.getElementById("cdW"),
 *    E: document.getElementById("cdE"),
 *    R: document.getElementById("cdR"),
 *  });
 *
 *  // on key/mouse:
 *  skills.castQ();
 *  skills.castW_AOE(point);
 *  skills.castE_StaticField();
 *  skills.castR_Thunderstorm();
 *
 *  // per-frame:
 *  skills.update(t, dt);
 */
export class SkillsSystem {
  /**
   * @param {import("./entities.js").Player} player
   * @param {import("./entities.js").Enemy[]} enemies
   * @param {import("./effects.js").EffectsManager} effects
   * @param {{Q: HTMLElement, W: HTMLElement, E: HTMLElement, R: HTMLElement}} cdUI
   * @param {any} villages optional villages system to enforce village safety rules
   */
  constructor(player, enemies, effects, cdUI, villages = null) {
    this.player = player;
    this.enemies = enemies;
    this.effects = effects;
    this.cdUI = cdUI;
    this.villages = villages;

    this.cooldowns = { Q: 0, W: 0, E: 0, R: 0, Basic: 0 };
    this.cdState = { Q: 0, W: 0, E: 0, R: 0, Basic: 0 }; // for ready flash timing
    this.storms = []; // queued thunderstorm strikes
    // Temporary damage buff (applies to basic + skills)
    this.damageBuffUntil = 0;
    this.damageBuffMult = 1;
    // Clone-like scheduled strikes (thunder image)
    this.clones = [];
  }

  // ----- Damage scaling helpers -----
  getBasicDamage(attacker) {
    let base = WORLD.basicAttackDamage;
    if (attacker && typeof attacker.baseDamage === "number") {
      base = Math.max(1, Math.floor(attacker.baseDamage));
    }
    const activeBuff = this.damageBuffUntil && now() < this.damageBuffUntil ? this.damageBuffMult || 1 : 1;
    return Math.max(1, Math.floor(base * activeBuff));
  }

  scaleSkillDamage(base) {
    const lvl = Math.max(1, (this.player && this.player.level) || 1);
    const levelMult = Math.pow(SCALING.hero.skillDamageGrowth, lvl - 1);
    const buffMult = this.damageBuffUntil && now() < this.damageBuffUntil ? this.damageBuffMult || 1 : 1;
    return Math.max(1, Math.floor((base || 0) * levelMult * buffMult));
  }

  // ----- Cooldowns -----
  startCooldown(key, seconds) {
    this.cooldowns[key] = now() + seconds;
  }
  isOnCooldown(key) {
    return now() < this.cooldowns[key];
  }

  // ----- UI (cooldowns) -----
  updateCooldownUI() {
    const t = now();
    for (const key of ["Q", "W", "E", "R", "Basic"]) {
      const end = this.cooldowns[key];
      const el = this.cdUI?.[key];
      if (!el) continue;

      let remain = 0;
      if (!end || end <= 0) {
        el.style.background = "none";
        el.textContent = "";
      } else {
        remain = Math.max(0, end - t);
        // Hide "0.0" at the end of cooldown: clear text/background when very close to ready
        if (remain <= 0.05) {
          el.style.background = "none";
          el.textContent = "";
        } else {
          const total = key === "Basic" ? WORLD.basicAttackCooldown : (SKILLS[key]?.cd || 0);
          const pct = clamp01(remain / total);
          const deg = Math.floor(pct * 360);
          const wedge =
            pct > 0.5
              ? "rgba(70,100,150,0.55)"
              : pct > 0.2
              ? "rgba(90,150,220,0.55)"
              : "rgba(150,220,255,0.65)";
          el.style.background = `conic-gradient(${wedge} ${deg}deg, rgba(0,0,0,0) 0deg)`;
          el.textContent = remain < 3 ? remain.toFixed(1) : `${Math.ceil(remain)}`;
        }
      }
      // flash on ready transition
      const prev = this.cdState[key] || 0;
      if (prev > 0 && remain === 0) {
        el.classList.add("flash");
        el.dataset.flashUntil = String(t + 0.25);
      }
      if (el.dataset.flashUntil && t > parseFloat(el.dataset.flashUntil)) {
        el.classList.remove("flash");
        delete el.dataset.flashUntil;
      }
      this.cdState[key] = remain;
    }
  }

  // ----- Combat -----
  /**
   * Attempt a basic electric attack if in range and off cooldown.
   * Returns true on success, false otherwise.
   * @param {import("./entities.js").Entity} attacker
   * @param {import("./entities.js").Entity} target
   * @returns {boolean}
   */
  tryBasicAttack(attacker, target) {
    const time = now();
    if (time < (attacker.nextBasicReady || 0)) return false;
    if (!target || !target.alive) return false;

    // Prevent player from attacking targets outside while inside any village (origin or dynamic).
    // Falls back to origin-only rule if villages API is not provided.
    try {
      if (attacker === this.player) {
        if (this.villages && typeof this.villages.isInsideAnyVillage === "function") {
          const pin = this.villages.isInsideAnyVillage(attacker.pos());
          const tin = this.villages.isInsideAnyVillage(target.pos());
          if (pin && pin.inside) {
            const sameVillage = tin && tin.inside && tin.key === pin.key;
            if (!sameVillage) return false;
          }
        } else {
          // Fallback: origin-only protection
          const pd = distance2D(attacker.pos(), VILLAGE_POS);
          const td = distance2D(target.pos(), VILLAGE_POS);
          if (pd <= REST_RADIUS && td > REST_RADIUS) return false;
        }
      }
    } catch (e) {
      // ignore errors in defensive check
    }

    const dist = distance2D(attacker.pos(), target.pos());
    if (dist > WORLD.attackRange * (WORLD.attackRangeMult || 1)) return false;

    attacker.nextBasicReady = time + WORLD.basicAttackCooldown;
    if (attacker === this.player) {
      // Mirror basic attack cooldown into UI like other skills
      this.startCooldown("Basic", WORLD.basicAttackCooldown);
    }
    const from =
      attacker === this.player && this.player.mesh.userData.handAnchor
        ? handWorldPos(this.player)
        : attacker.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
    const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(from, to, COLOR.blue, 0.12);
    audio.sfx("basic");
    // FP hand VFX for basic attack
    try {
      this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}
      this.effects.spawnHandFlash(this.player, true);
      this.effects.spawnHandLink(this.player, 0.08);
      this.effects.spawnHandCrackle(this.player, false, 1.2);
      this.effects.spawnHandCrackle(this.player, true, 1.2);
    } catch (e) {}
    if (attacker === this.player) this.player.braceUntil = now() + 0.18;
    const dmg = this.getBasicDamage(attacker);
    target.takeDamage(dmg);
    // show floating damage number on the target
    try { this.effects.spawnDamagePopup(target.pos(), dmg, 0xffe0e0); } catch (e) {}
    return true;
  }

  // ----- Skills -----
  /**
   * Generic skill dispatcher. Use castSkill('Q'|'W'|'E'|'R', point?)
   * point is used for ground-targeted 'aoe' skills.
   */
  castSkill(key, point = null) {
    if (!key) return;
    if (this.isOnCooldown(key)) return;
    const SK = SKILLS[key];
    if (!SK) {
      console.warn("castSkill: unknown SKILLS key", key);
      return;
    }

    switch (SK.type) {
      case "chain":
        return this._castChain(key);
      case "aoe":
        return this._castAOE(key, point);
      case "aura":
        return this._castAura(key);
      case "storm":
        return this._castStorm(key);
      case "beam":
        return this._castBeam(key);
      case "nova":
        return this._castNova(key);
      case "heal":
        return this._castHeal(key);
      case "mana":
        return this._castMana(key);
      case "buff":
        return this._castBuff(key);
      case "blink":
        return this._castBlink(key, point);
      case "dash":
        return this._castDash(key);
      case "clone":
        return this._castClone(key);
      default:
        // If skill definitions don't include a type (legacy), fall back to original key handlers
        if (key === "Q") return this.castQ_ChainLightning();
        if (key === "W") return this.castW_AOE(point);
        if (key === "E") return this.castE_StaticField();
        if (key === "R") return this.castR_Thunderstorm();
    }
  }

  // ---- Typed implementations ----
  _castChain(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key)) return;

    audio.sfx("cast_chain");
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    const effRange = Math.max(SK.range || 0, WORLD.attackRange * (WORLD.attackRangeMult || 1));
    let candidates = this.enemies.filter(
      (e) => e.alive && distance2D(this.player.pos(), e.pos()) <= effRange
    );
    if (candidates.length === 0) {
      this.effects.showNoTargetHint(this.player, effRange);
      return;
    }

    if (!this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);

    let current = candidates.sort(
      (a, b) =>
        distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
    )[0];
    let lastPoint = handWorldPos(this.player);
    let jumps = (SK.jumps || 0) + 1;
    while (current && jumps-- > 0) {
      const hitPoint = current.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(lastPoint, hitPoint, 0x8fd3ff, 0.12);
    this.effects.spawnArcNoisePath(lastPoint, hitPoint, 0xbfe9ff, 0.08);
    const dmgHit = this.scaleSkillDamage(SK.dmg || 0);
    current.takeDamage(dmgHit);
    audio.sfx("chain_hit");
    // popup for chain hit
    try { this.effects.spawnDamagePopup(current.pos(), dmgHit, 0xbfe9ff); } catch (e) {}
    this.effects.spawnStrike(current.pos(), 1.2, 0x9fd3ff);
    this.effects.spawnHitDecal(current.pos());
      lastPoint = hitPoint;
      candidates = this.enemies.filter(
        (e) =>
          e.alive &&
          e !== current &&
          distance2D(current.pos(), e.pos()) <= ((SK.jumpRange || 0) + 2.5)
      );
      current = candidates[0];
    }
  }

  _castAOE(key, point) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key)) return;

    // Auto-select point if none provided: choose nearest enemy within effective cast range
    if (!point) {
      const effRange = Math.max(WORLD.attackRange * (WORLD.attackRangeMult || 1), (SK.radius || 0) + 10);
      let candidates = this.enemies.filter(
        (e) => e.alive && distance2D(this.player.pos(), e.pos()) <= effRange + (SK.radius || 0)
      );
      if (candidates.length === 0) {
        // No nearby enemies; do not cast
        try { this.effects.showNoTargetHint?.(this.player, effRange); } catch (_) {}
        return;
      }
      candidates.sort(
        (a, b) => distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
      );
      point = candidates[0].pos().clone();
    }

    if (!this.player.canSpend(SK.mana)) return;

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    audio.sfx("cast_aoe");
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    // Visual: central strike + radial
    this.effects.spawnStrike(point, SK.radius, 0x9fd8ff);
    audio.sfx("boom");

    // Damage enemies in radius and apply slow if present
    this.enemies.forEach((en) => {
      if (!en.alive) return;
      if (distance2D(en.pos(), point) <= (SK.radius + 2.5)) {
        const dmg = this.scaleSkillDamage(SK.dmg || 0);
        en.takeDamage(dmg);
        try { this.effects.spawnDamagePopup(en.pos(), dmg, 0x9fd3ff); } catch (e) {}
        if (SK.slowFactor) {
          en.slowUntil = now() + (SK.slowDuration || 1.5);
          en.slowFactor = SK.slowFactor;
        }
      }
    });
  }

  _castAura(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key)) return;
    // Toggle off if active
    if (this.player.staticField.active) {
      this.player.staticField.active = false;
      this.player.staticField.until = 0;
      this.startCooldown(key, 4); // small lockout to prevent spam-toggle
      audio.sfx("aura_off");
      return;
    }
    if (!this.player.canSpend((SK.manaPerTick || 0) * 2)) return; // need some mana to start
    this.startCooldown(key, SK.cd);
    audio.sfx("aura_on");
    this.player.staticField.active = true;
    this.player.staticField.until = now() + (SK.duration || 10);
    this.player.staticField.nextTick = 0;
  }

  _castBeam(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;

    // Immediate feedback
    audio.sfx("cast_beam");
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    const effRange = Math.max(SK.range || 0, WORLD.attackRange * (WORLD.attackRangeMult || 1));
    let candidates = this.enemies.filter(
      (e) => e.alive && distance2D(this.player.pos(), e.pos()) <= effRange
    );
    if (candidates.length === 0) {
      this.effects.showNoTargetHint(this.player, effRange);
      return;
    }

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);

    const target = candidates.sort(
      (a, b) =>
        distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
    )[0];

    const from =
      this.player === this.player && this.player.mesh.userData.handAnchor
        ? handWorldPos(this.player)
        : this.player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
    const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(from, to, 0x8fd3ff, 0.12);
    audio.sfx("beam");
    const dmg = this.scaleSkillDamage(SK.dmg || 0);
    target.takeDamage(dmg);
    try { this.effects.spawnDamagePopup(target.pos(), dmg, 0x9fd3ff); } catch(e) {}
    this.effects.spawnStrike(target.pos(), 1.0, 0x9fd3ff);
  }

  _castNova(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    audio.sfx("cast_nova");
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    // Radial damage around player
    this.effects.spawnStrike(this.player.pos(), SK.radius, 0x9fd8ff);
    audio.sfx("boom");
    this.enemies.forEach((en) => {
      if (en.alive && distance2D(en.pos(), this.player.pos()) <= (SK.radius + 2.5)) {
        const dmg = this.scaleSkillDamage(SK.dmg || 0);
        en.takeDamage(dmg);
        try { this.effects.spawnDamagePopup(en.pos(), dmg, 0x9fd3ff); } catch(e) {}
      }
    });
  }

  _castStorm(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    this.effects.spawnHandFlash(this.player);
    audio.sfx("storm_start");

    const startT = now();
    const endT = startT + (SK.duration || 7);
    const center = this.player.pos().clone();

    // Queue up strikes over duration
    const strikes = [];
    for (let i = 0; i < (SK.strikes || 8); i++) {
      const when = startT + Math.random() * (SK.duration || 7);
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * (SK.radius || 12);
      const pt = center.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      strikes.push({ when, pt });
    }
    this.storms.push({ strikes, end: endT });
  }

  // ----- Utility new skill types -----
  _castHeal(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    const amt = Math.max(1, SK.heal || SK.amount || 30);
    this.player.hp = Math.min(this.player.maxHP, this.player.hp + amt);
    try { this.effects.spawnHandFlash(this.player); audio.sfx("aura_on"); } catch (e) {}
    try { this.effects.spawnStrike(this.player.pos(), 5, 0x9fd8ff); } catch (_) {}
  }

  _castMana(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key)) return; // mana restore often no cost
    // Spend if defined (some designs use 0)
    if (typeof SK.mana === "number" && SK.mana > 0) {
      if (!this.player.canSpend(SK.mana)) return;
      this.player.spend(SK.mana);
    }
    this.startCooldown(key, SK.cd);
    const amt = Math.max(1, SK.restore || SK.manaRestore || 25);
    this.player.mp = Math.min(this.player.maxMP, this.player.mp + amt);
    try { this.effects.spawnHandFlash(this.player, true); audio.sfx("cast_chain"); } catch (e) {}
    try { this.effects.spawnStrike(this.player.pos(), 4, 0xbfe9ff); } catch (_) {}
  }

  _castBuff(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    // Damage buff (applies to basic + skills via getBasicDamage/scaleSkillDamage)
    const mult = Math.max(1.05, SK.buffMult || 1.3);
    const dur = Math.max(1, SK.buffDuration || 8);
    this.damageBuffMult = mult;
    this.damageBuffUntil = now() + dur;
    // Optional speed boost stored on player for movement system
    if (SK.speedMult) {
      this.player.speedBoostMul = Math.max(1.0, SK.speedMult);
      this.player.speedBoostUntil = now() + dur;
    }
    try {
      this.effects.spawnHandFlash(this.player);
      this.effects.spawnStrike(this.player.pos(), 6, 0x9fd8ff);
      audio.sfx("cast_nova");
    } catch (e) {}
  }

  _castBlink(key, point = null) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    const dist = Math.max(4, SK.range || SK.distance || 20);
    // Determine direction
    let dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    if (point && point.x !== undefined) {
      dir = point.clone().sub(this.player.pos()).setY(0).normalize();
      if (!isFinite(dir.lengthSq()) || dir.lengthSq() === 0) dir.set(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    }
    const to = this.player.pos().clone().add(dir.multiplyScalar(dist));
    if (!this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    try { this.effects.spawnStrike(this.player.pos(), 3, 0x9fd8ff); audio.sfx("storm_start"); } catch (e) {}
    this.player.mesh.position.set(to.x, this.player.mesh.position.y, to.z);
    try { this.effects.spawnStrike(this.player.pos(), 3, 0x9fd8ff); } catch (e) {}
    this.player.moveTarget = null; this.player.target = null;
  }

  _castDash(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    const dist = Math.max(4, SK.distance || 14);
    let dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    const to = this.player.pos().clone().add(dir.multiplyScalar(dist));
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    try { this.effects.spawnHandLink(this.player, 0.06); audio.sfx("cast_beam"); } catch (e) {}
    this.player.mesh.position.set(to.x, this.player.mesh.position.y, to.z);
    this.player.moveTarget = null; this.player.target = null;
  }

  _castClone(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    const duration = Math.max(3, SK.duration || 7);
    const rate = Math.max(0.2, SK.rate || 0.5);
    const radius = Math.max(10, SK.radius || 26);
    const dmg = this.scaleSkillDamage(SK.dmg || 16);
    // schedule a thunder image that periodically zaps nearby enemies
    this.clones.push({ until: now() + duration, next: 0, rate, radius, dmg });
    try { this.effects.spawnHandFlash(this.player); audio.sfx("aura_on"); } catch(e) {}
    try { this.effects.spawnStrike(this.player.pos(), 5, 0xbfe9ff); } catch(e) {}
  }

  // Backwards-compatible wrappers (preserve existing API)
  castQ_ChainLightning() {
    return this.castSkill("Q");
  }

  castW_AOE(point) {
    return this.castSkill("W", point);
  }

  castE_StaticField() {
    return this.castSkill("E");
  }

  castR_Thunderstorm() {
    return this.castSkill("R");
  }

  runStaticField(dt, t) {
    if (!this.player.staticField.active) return;
    if (t > this.player.staticField.until) {
      this.player.staticField.active = false;
      return;
    }
    if (t >= this.player.staticField.nextTick) {
      if (!this.player.canSpend(SKILLS.E.manaPerTick)) {
        this.player.staticField.active = false;
        return;
      }
      this.player.spend(SKILLS.E.manaPerTick);
      this.player.staticField.nextTick = t + SKILLS.E.tick;

      // Visual ring and zap
      this.effects.spawnStrike(this.player.pos(), SKILLS.E.radius, 0x7fc7ff);
      audio.sfx("aura_tick");
      // Pulse ring for aura tick (color shifts each pulse)
      const phase = Math.sin(now() * 8);
      const col = phase > 0 ? 0xbfe9ff : 0x7fc7ff;
      const pulse = createGroundRing(SKILLS.E.radius - 0.25, SKILLS.E.radius + 0.25, col, 0.32);
      const pl = this.player.pos();
      pulse.position.set(pl.x, 0.02, pl.z);
      this.effects.indicators.add(pulse);
      // queue for fade/scale cleanup
      this.effects.queue.push({ obj: pulse, until: now() + 0.22, fade: true, mat: pulse.material, scaleRate: 0.6 });

      const dmg = this.scaleSkillDamage(SKILLS.E.dmg || 0);
      this.enemies.forEach((en) => {
        if (en.alive && distance2D(en.pos(), this.player.pos()) <= (SKILLS.E.radius + 2.5)) {
          en.takeDamage(dmg);
          try { this.effects.spawnDamagePopup(en.pos(), dmg, 0x7fc7ff); } catch(e) {}
        }
      });
    }
  }

  runStorms(cameraShake) {
    const t = now();
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i];
      // Execute strikes due
      for (let j = s.strikes.length - 1; j >= 0; j--) {
        const st = s.strikes[j];
        if (t >= st.when) {
          this.effects.spawnStrike(st.pt, 3, 0xb5e2ff);
          audio.sfx("strike");
          // camera shake on big strikes
          if (cameraShake) {
            cameraShake.mag = Math.max(cameraShake.mag, 0.4);
            cameraShake.until = now() + 0.18;
          }
          const dmg = this.scaleSkillDamage(SKILLS.R.dmg || 0);
          this.enemies.forEach((en) => {
            if (en.alive && distance2D(en.pos(), st.pt) <= 5.0) {
              en.takeDamage(dmg);
              try { this.effects.spawnDamagePopup(en.pos(), dmg, 0xbfe2ff); } catch(e) {}
            }
          });
          s.strikes.splice(j, 1);
        }
      }
      if (t >= s.end && s.strikes.length === 0) {
        this.storms.splice(i, 1);
      }
    }
  }

  // Shadow clone processing (periodic zaps near player while active)
  runClones() {
    const t = now();
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const c = this.clones[i];
      if (t >= c.until) { this.clones.splice(i, 1); continue; }
      if (!c.next || t >= c.next) {
        // find a nearby enemy
        const near = this.enemies.filter(e => e.alive && distance2D(this.player.pos(), e.pos()) <= c.radius);
        if (near.length) {
          const target = near[Math.floor(Math.random() * near.length)];
          // fake clone position (offset from player)
          const ang = Math.random() * Math.PI * 2;
          const off = new THREE.Vector3(Math.cos(ang) * 1.6, 1.4, Math.sin(ang) * 1.6);
          const from = this.player.pos().clone().add(off);
          const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
          try {
            this.effects.spawnElectricBeamAuto(from, to, 0x8fd3ff, 0.12);
            this.effects.spawnArcNoisePath(from, to, 0xbfe9ff, 0.08);
            audio.sfx("chain_hit");
            this.effects.spawnStrike(target.pos(), 0.9, 0x9fd3ff);
          } catch (e) {}
          target.takeDamage(c.dmg);
        }
        c.next = t + c.rate;
      }
    }
  }
  
  // Preview-only visualization for a skill definition (no cost, no cooldown, no damage)
  previewSkill(def) {
    if (!def) return;
    try {
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion).normalize();
      const ahead = this.player.pos().clone().add(forward.multiplyScalar(10));
      const from = this.player.mesh.userData?.handAnchor ? handWorldPos(this.player) : this.player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
      const mkRing = (center, r, col = 0x9fd8ff, a = 0.22) => {
        try {
          const ring = createGroundRing(Math.max(0.1, r - 0.35), r + 0.35, col, a);
          ring.position.set(center.x, 0.02, center.z);
          this.effects.indicators.add(ring);
          this.effects.queue.push({ obj: ring, until: now() + 0.4, fade: true, mat: ring.material, scaleRate: 0.4 });
        } catch (_) {}
      };
      switch (def.type) {
        case "aoe": {
          const r = def.radius || 12;
          this.effects.spawnStrike(ahead, r, 0x9fd8ff);
          mkRing(ahead, r);
          break;
        }
        case "nova": {
          const r = def.radius || 12;
          this.effects.spawnStrike(this.player.pos(), r, 0x9fd8ff);
          mkRing(this.player.pos(), r);
          break;
        }
        case "aura": {
          const r = def.radius || 12;
          this.effects.spawnStrike(this.player.pos(), r, 0x7fc7ff);
          mkRing(this.player.pos(), r, 0x7fc7ff, 0.28);
          break;
        }
        case "storm": {
          const r = def.radius || 12;
          const n = Math.min(8, def.strikes || 6);
          for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            const rr = Math.random() * r;
            const pt = this.player.pos().clone().add(new THREE.Vector3(Math.cos(ang) * rr, 0, Math.sin(ang) * rr));
            this.effects.spawnStrike(pt, 3, 0xb5e2ff);
          }
          mkRing(this.player.pos(), r, 0xb5e2ff, 0.18);
          break;
        }
        case "chain":
        case "beam": {
          const to = ahead.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnElectricBeamAuto(from, to, 0x8fd3ff, 0.12);
          this.effects.spawnStrike(ahead, 1.0, 0x9fd3ff);
          break;
        }
        default: {
          // Generic preview: hand flash and a small strike in front
          this.effects.spawnHandFlash(this.player);
          this.effects.spawnStrike(ahead, 2.5, 0x9fd8ff);
          break;
        }
      }
      // subtle hand crackle for feedback
      try {
        this.effects.spawnHandCrackle(this.player, false, 0.8);
        this.effects.spawnHandCrackle(this.player, true, 0.8);
      } catch (_) {}
    } catch (_) {}
  }
  
  // ----- Per-frame update -----
  update(t, dt, cameraShake) {
    // Static Field tick
    this.runStaticField(dt, now());
    // Thunderstorm processing
    this.runStorms(cameraShake);
    // Shadow clone processing
    this.runClones();
    // Cooldown UI every frame
    this.updateCooldownUI();

  }
}

// Local small helper
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
