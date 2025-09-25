import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { WORLD, SKILLS, COLOR, VILLAGE_POS, REST_RADIUS, SCALING } from "./constants.js";
import { distance2D, now } from "./utils.js";
import { handWorldPos } from "./entities.js";
import { createGroundRing } from "./effects.js";
import { audio } from "./audio.js";
import { getBasicUplift } from "./uplift.js";

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
    this.totems = [];
    this._pendingShake = 0;
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
  
  // VFX helpers driven by skill.effects configuration
  _fx(def) {
    const e = (def && def.effects) || {};
    return {
      beam: e.beamColor ?? e.beam ?? 0x8fd3ff,
      impact: e.impactColor ?? e.impact ?? 0x9fd3ff,
      ring: e.ringColor ?? e.ring ?? 0x9fd8ff,
      arc: e.arcColor ?? e.arc ?? 0xbfe9ff,
      hand: e.handColor ?? e.hand ?? 0x9fd8ff,
      shake: e.shake ?? 0
    };
  }

  _vfxCastFlash(def) {
    const fx = this._fx(def);
    try {
      if (this.effects.spawnHandFlashColored) {
        this.effects.spawnHandFlashColored(this.player, fx.hand);
      } else {
        this.effects.spawnHandFlash(this.player);
      }
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (_) {}
  }

  _requestShake(v) {
    this._pendingShake = Math.max(this._pendingShake || 0, v || 0);
  }

  // Burst arcs around a center point to enrich visuals (color-tinted)
  _burstArcs(center, radius, def, count = 3) {
    try {
      const fx = this._fx(def);
      const base = center.clone().add(new THREE.Vector3(0, 0.8, 0));
      for (let i = 0; i < Math.max(1, count); i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * Math.max(4, radius);
        const to = center.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0.4 + Math.random() * 0.8, Math.sin(ang) * r));
        this.effects.spawnArcNoisePath(base, to, fx.arc, 0.08, 2);
      }
    } catch (_) {}
  }

  // Prefer enemies in front of player within a small aim cone
  _pickTargetInAim(range = 36, halfAngleDeg = 12) {
    try {
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.player.mesh.quaternion).setY(0).normalize();
      const cosT = Math.cos((Math.max(1, halfAngleDeg) * Math.PI) / 180);
      const pos = this.player.pos();
      let best = null;
      let bestScore = -Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = distance2D(pos, e.pos());
        if (d > range) continue;
        const v = e.pos().clone().sub(pos).setY(0);
        const len = v.length() || 1;
        const dir = v.clone().multiplyScalar(1 / len);
        const dot = dir.dot(fwd);
        if (dot <= cosT || dot <= 0) continue;
        // score: prefer higher alignment and closer distance along forward
        const proj = len * dot;
        const score = dot * 2 - proj * 0.01;
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      return best;
    } catch (_) {
      return null;
    }
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

    const buffMul = (attacker.atkSpeedUntil && now() < attacker.atkSpeedUntil) ? (attacker.atkSpeedMul || 1) : 1;
    const permaMul = attacker.atkSpeedPerma || 1;
    const effMul = Math.max(0.5, buffMul * permaMul);
    const basicCd = WORLD.basicAttackCooldown / effMul;
    attacker.nextBasicReady = time + basicCd;
    if (attacker === this.player) {
      // Mirror basic attack cooldown into UI like other skills
      this.startCooldown("Basic", basicCd);
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
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
      this.effects.spawnHandFlash(this.player, true);
      this.effects.spawnHandLink(this.player, 0.08);
      this.effects.spawnHandCrackle(this.player, false, 1.2);
      this.effects.spawnHandCrackle(this.player, true, 1.2);
    } catch (e) {}
    if (attacker === this.player) this.player.braceUntil = now() + 0.18;
    const baseDmg = this.getBasicDamage(attacker);
    const up = getBasicUplift ? getBasicUplift() : { aoeRadius: 0, chainJumps: 0, dmgMul: 1 };
    const dmg = Math.max(1, Math.floor(baseDmg * (up.dmgMul || 1)));
    target.takeDamage(dmg);
    try { this.effects.spawnDamagePopup(target.pos(), dmg, 0xffe0e0); } catch (e) {}

    // Uplift: AOE explosion around the hit target
    try {
      if (up.aoeRadius && up.aoeRadius > 0) {
        this.effects.spawnStrike(target.pos(), up.aoeRadius, 0xffee88);
        const r = up.aoeRadius + 2.5;
        this.enemies.forEach((en) => {
          if (!en.alive || en === target) return;
          if (distance2D(en.pos(), target.pos()) <= r) en.takeDamage(Math.max(1, Math.floor(dmg * 0.8)));
        });
      }
    } catch (_) {}

    // Uplift: Chain to nearby enemies
    try {
      let jumps = Math.max(0, up.chainJumps || 0);
      let current = target;
      const hitSet = new Set([current]);
      while (jumps-- > 0) {
        const candidates = this.enemies
          .filter(e => e.alive && !hitSet.has(e) && distance2D(current.pos(), e.pos()) <= 22)
          .sort((a,b) => distance2D(current.pos(), a.pos()) - distance2D(current.pos(), b.pos()));
        const nxt = candidates[0];
        if (!nxt) break;
        hitSet.add(nxt);
        const from = current.pos().clone().add(new THREE.Vector3(0,1.2,0));
        const to = nxt.pos().clone().add(new THREE.Vector3(0,1.2,0));
        try { this.effects.spawnElectricBeamAuto(from, to, 0xffee88, 0.08); } catch(_) {}
        nxt.takeDamage(Math.max(1, Math.floor(dmg * 0.85)));
        current = nxt;
      }
    } catch (_) {}
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
    this._vfxCastFlash(SK);

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
      case "shield":
        return this._castShield(key);
      case "totem":
        return this._castTotem(key);
      case "mark":
        return this._castMark(key);
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
    this._vfxCastFlash(SK);

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
      // Miss fallback: fire forward beam to max range and consume cost
      const fx = this._fx(SK);
      const from =
        this.player === this.player && this.player.mesh.userData.handAnchor
          ? handWorldPos(this.player)
          : this.player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
      const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
      const to = from.clone().add(dir.multiplyScalar(effRange));
      try {
        this.effects.spawnElectricBeamAuto(from, to, fx.beam, 0.1);
        this.effects.spawnStrike(to.clone().setY(0), 1.0, fx.impact);
        this._requestShake(fx.shake || 0);
        audio.sfx("beam");
      } catch (_) {}
      this.player.spend(SK.mana);
      this.startCooldown(key, SK.cd);
      return;
    }

    if (!this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);

    let current = this._pickTargetInAim(effRange, 12) || candidates.sort(
      (a, b) =>
        distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
    )[0];
    let lastPoint = handWorldPos(this.player);
    let jumps = (SK.jumps || 0) + 1;
    let first = true;
    while (current && jumps-- > 0) {
      const hitPoint = current.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(lastPoint, hitPoint, this._fx(SK).beam, 0.12);
    this.effects.spawnArcNoisePath(lastPoint, hitPoint, this._fx(SK).arc, 0.08);
    if (first) { this._requestShake(this._fx(SK).shake || 0); first = false; }
    const dmgHit = this.scaleSkillDamage(SK.dmg || 0);
    current.takeDamage(dmgHit);
    if (SK.slowFactor) { current.slowUntil = now() + (SK.slowDuration || 1.2); current.slowFactor = SK.slowFactor; }
    audio.sfx("chain_hit");
    // popup for chain hit
    try { this.effects.spawnDamagePopup(current.pos(), dmgHit, this._fx(SK).impact); } catch (e) {}
    this.effects.spawnStrike(current.pos(), 1.2, this._fx(SK).impact);
    this.effects.spawnHitDecal(current.pos(), this._fx(SK).impact);
    try { this.effects.spawnRingPulse(current.pos(), 1.2, this._fx(SK).ring, 0.3, 0.5, 0.45); } catch (_) {}
      lastPoint = hitPoint;
      candidates = this.enemies
        .filter(
          (e) =>
            e.alive &&
            e !== current &&
            distance2D(current.pos(), e.pos()) <= ((SK.jumpRange || 0) + 2.5)
        )
        .sort((a, b) => distance2D(current.pos(), a.pos()) - distance2D(current.pos(), b.pos()));
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

    // Visual: central strike + radial + pulse
    const fx = this._fx(SK);
    this.effects.spawnStrike(point, SK.radius, fx.ring); this._requestShake(fx.shake);
    this._burstArcs(point, SK.radius, SK);
    try {
      this.effects.spawnRingPulse(point, Math.max(3, (SK.radius || 0) * 0.8), fx.ring, 0.45, 0.9, 0.45);
      if (SK.id === "static_prison") {
        this.effects.spawnCage(point, Math.max(4, (SK.radius || 0) * 0.9), fx.ring, 0.6, 14, 2.6);
      }
    } catch (_) {}
    audio.sfx("boom");

    // Damage enemies in radius and apply slow if present
    this.enemies.forEach((en) => {
      if (!en.alive) return;
      if (distance2D(en.pos(), point) <= (SK.radius + 2.5)) {
        const dmg = this.scaleSkillDamage(SK.dmg || 0);
        en.takeDamage(dmg);
        try { this.effects.spawnDamagePopup(en.pos(), dmg, this._fx(SK).impact); } catch (e) {}
        try {
          this.effects.spawnStrike(en.pos(), 1.0, this._fx(SK).impact);
          this.effects.spawnHitDecal(en.pos(), this._fx(SK).impact);
        } catch (_) {}
        // Visual arcs from the center to each enemy hit
        try {
          const cfrom = point.clone().add(new THREE.Vector3(0, 0.8, 0));
          const cto = en.pos().clone().add(new THREE.Vector3(0, 1.0, 0));
          this.effects.spawnArcNoisePath(cfrom, cto, this._fx(SK).arc, 0.08, 2);
        } catch (_) {}
        if (SK.slowFactor) {
          en.slowUntil = now() + (SK.slowDuration || 1.5);
          en.slowFactor = SK.slowFactor;
        }
        if (SK.stunDuration) {
          en.nextAttackReady = Math.max(en.nextAttackReady || 0, now() + SK.stunDuration);
          en.slowUntil = Math.max(en.slowUntil || 0, now() + SK.stunDuration);
          en.slowFactor = 0.0;
        }
        if (SK.knockback) {
          const dir = en.pos().clone().sub(point).setY(0);
          const len = dir.length() || 1;
          dir.multiplyScalar((SK.knockback || 2) / len);
          en.mesh.position.add(dir);
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
      // Kill persistent aura ring if present
      try {
        const ring = this.player.staticField.vfxRing;
        if (ring) {
          const q = this.effects.queue;
          for (let i = 0; i < q.length; i++) {
            if (q[i].obj === ring) { q[i].until = now(); break; }
          }
          this.player.staticField.vfxRing = null;
        }
      } catch (_) {}
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
    // Persistent faint aura ring following the caster
    try {
      const fx = this._fx(SK);
      const r = Math.max(2, (SK.radius || 12));
      const ring = createGroundRing(Math.max(0.2, r - 0.35), r + 0.35, fx.ring, 0.22);
      const p = this.player.pos();
      ring.position.set(p.x, 0.02, p.z);
      this.effects.indicators.add(ring);
      this.effects.queue.push({ obj: ring, until: now() + (SK.duration || 10), mat: ring.material, follow: this.player, followYOffset: 0.02, pulseAmp: 0.03, pulseRate: 2.6, baseScale: 1 });
      this.player.staticField.vfxRing = ring;
    } catch (_) {}
  }

  _castBeam(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);

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
      const fx = this._fx(SK);
      const from =
        this.player === this.player && this.player.mesh.userData.handAnchor
          ? handWorldPos(this.player)
          : this.player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
      const dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
      const to = from.clone().add(dir.multiplyScalar(effRange));
      try {
        this.effects.spawnElectricBeamAuto(from, to, fx.beam, 0.1);
        this.effects.spawnStrike(to.clone().setY(0), 1.0, fx.impact);
        this._requestShake(fx.shake || 0);
        audio.sfx("beam");
      } catch (_) {}
      this.player.spend(SK.mana);
      this.startCooldown(key, SK.cd);
      return;
    }

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);

    let target = this._pickTargetInAim(effRange, 12) || candidates.sort(
      (a, b) =>
        distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
    )[0];

    const from =
      this.player === this.player && this.player.mesh.userData.handAnchor
        ? handWorldPos(this.player)
        : this.player.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
    const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(from, to, this._fx(SK).beam, 0.12); this._requestShake(this._fx(SK).shake);
    this.effects.spawnArcNoisePath(from, to, this._fx(SK).arc, 0.08, 2);
    audio.sfx("beam");
    const dmg = this.scaleSkillDamage(SK.dmg || 0);
    target.takeDamage(dmg);
    try { this.effects.spawnDamagePopup(target.pos(), dmg, this._fx(SK).impact); } catch(e) {}
    this.effects.spawnStrike(target.pos(), 1.0, this._fx(SK).impact);
    try { this.effects.spawnHitDecal(target.pos(), this._fx(SK).impact); } catch(e) {}
  }

  _castNova(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd); this._requestShake(this._fx(SK).shake);
    audio.sfx("cast_nova");
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    // Radial damage around player
    const fx = this._fx(SK);
    this.effects.spawnStrike(this.player.pos(), SK.radius, fx.ring); this._requestShake(fx.shake);
    this._burstArcs(this.player.pos(), SK.radius, SK);
    try {
      this.effects.spawnRingPulse(this.player.pos(), Math.max(4, (SK.radius || 0) * 0.85), fx.ring, 0.5, 1.1, 0.5);
      if (SK.id === "got_judgement") {
        // Secondary heavier pulse for ultimate
        this.effects.spawnRingPulse(this.player.pos(), Math.max(6, (SK.radius || 0) * 0.6), fx.impact, 0.6, 1.4, 0.6);
      }
    } catch (_) {}
    audio.sfx("boom");
    this.enemies.forEach((en) => {
      if (en.alive && distance2D(en.pos(), this.player.pos()) <= (SK.radius + 2.5)) {
        const dmg = this.scaleSkillDamage(SK.dmg || 0);
        en.takeDamage(dmg);
        try { this.effects.spawnDamagePopup(en.pos(), dmg, this._fx(SK).impact); } catch(e) {}
        try {
          this.effects.spawnStrike(en.pos(), 1.0, this._fx(SK).impact);
          this.effects.spawnHitDecal(en.pos(), this._fx(SK).impact);
        } catch (e2) {}
        // Visual arcs from caster to each enemy hit
        try {
          const cfrom = this.player.pos().clone().add(new THREE.Vector3(0, 0.8, 0));
          const cto = en.pos().clone().add(new THREE.Vector3(0, 1.0, 0));
          this.effects.spawnArcNoisePath(cfrom, cto, this._fx(SK).arc, 0.08, 2);
        } catch (_) {}
      }
    });
  }

  _castStorm(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    this.effects.spawnHandFlash(this.player);
    audio.sfx("storm_start");

    const startT = now();
    const endT = startT + (SK.duration || 7);
    const center = this.player.pos().clone();
    const fx = this._fx(SK);

    // Mark the storm area with a brief ground ring
    try {
      const ring = createGroundRing(Math.max(0.1, (SK.radius || 12) - 0.35), (SK.radius || 12) + 0.35, fx.ring, 0.22);
      ring.position.set(center.x, 0.02, center.z);
      this.effects.indicators.add(ring);
      this.effects.queue.push({ obj: ring, until: now() + 0.6, fade: true, mat: ring.material, scaleRate: 0.4 });
    } catch (_) {}
    try { this.effects.spawnStormCloud(center, SK.radius || 12, fx.ring, SK.duration || 7, 3.6); } catch (_) {}
    try { this.effects.spawnRingPulse(center, Math.max(6, (SK.radius || 12) * 0.85), fx.ring, 0.6, 1.4, 0.5); } catch (_) {}

    const rate = Math.max(0, (SK.strikes || 8) / Math.max(0.1, (SK.duration || 7)));
    const strikeRadius = SK.strikeRadius || ((SK.id === "thunderdome" || SK.id === "maelstrom") ? 3.0 : 2.5);
    const dmg = this.scaleSkillDamage(SK.dmg || 0);

    // Accumulator-based scheduling
    this.storms.push({
      center,
      radius: SK.radius || 12,
      end: endT,
      rate,
      acc: 0,
      last: startT,
      fx,
      dmg,
      strikeRadius,
    });
  }

  // ----- Utility new skill types -----
  _castHeal(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    const amt = Math.max(1, SK.heal || SK.amount || 30);
    this.player.hp = Math.min(this.player.maxHP, this.player.hp + amt);
    try { this.effects.spawnHandFlash(this.player); audio.sfx("aura_on"); } catch (e) {}
    try {
      const fx = this._fx(SK);
      this.effects.spawnStrike(this.player.pos(), 5, fx.impact);
      this.effects.spawnRingPulse(this.player.pos(), 3, fx.ring, 0.5, 1.0, 0.55);
      const opts = SK.id === "divine_mend" ? { count: 6, radius: 1.4, duration: 1.2, size: 0.2, rate: 5.0 } : { count: 4, radius: 1.2, duration: 0.9, size: 0.16, rate: 4.2 };
      this.effects.spawnOrbitingOrbs(this.player, fx.ring, opts);
    } catch (_) {}
  }

  _castMana(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key)) return; // mana restore often no cost
    this._vfxCastFlash(SK);
    // Spend if defined (some designs use 0)
    if (typeof SK.mana === "number" && SK.mana > 0) {
      if (!this.player.canSpend(SK.mana)) return;
      this.player.spend(SK.mana);
    }
    this.startCooldown(key, SK.cd);
    const amt = Math.max(1, SK.restore || SK.manaRestore || 25);
    this.player.mp = Math.min(this.player.maxMP, this.player.mp + amt);
    try { this.effects.spawnHandFlash(this.player, true); audio.sfx("cast_chain"); } catch (e) {}
    try {
      const fx = this._fx(SK);
      this.effects.spawnStrike(this.player.pos(), 4, fx.impact);
      this.effects.spawnRingPulse(this.player.pos(), 3, fx.ring, 0.45, 0.9, 0.5);
      const heavy = SK.id === "mana_well";
      this.effects.spawnOrbitingOrbs(this.player, fx.ring, { count: heavy ? 6 : 3, radius: heavy ? 1.4 : 1.0, duration: heavy ? 1.2 : 0.8, size: heavy ? 0.18 : 0.14, rate: 4.0 });
      if (heavy) {
        this.effects.spawnRingPulse(this.player.pos(), 4, fx.ring, 0.55, 1.2, 0.45);
      }
    } catch (_) {}
  }

  _castBuff(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    // Damage buff (applies to basic + skills via getBasicDamage/scaleSkillDamage)
    const mult = Math.max(1.05, SK.buffMult || 1.3);
    const dur = Math.max(1, SK.buffDuration || 8);
    this.damageBuffMult = mult;
    this.damageBuffUntil = now() + dur;
    // Optional movement speed boost
    if (SK.speedMult) {
      this.player.speedBoostMul = Math.max(1.0, SK.speedMult);
      this.player.speedBoostUntil = now() + dur;
    }
    // Optional attack speed boost (affects basic attack cooldown)
    if (SK.atkSpeedMult) {
      this.player.atkSpeedMul = Math.max(0.5, SK.atkSpeedMult);
      this.player.atkSpeedUntil = now() + dur;
    }
    // Optional temporary damage reduction (defense)
    if (SK.defensePct) {
      this.player.defensePct = Math.min(0.95, Math.max(0.05, SK.defensePct));
      this.player.defenseUntil = now() + dur;
    }
    try {
      this.effects.spawnHandFlash(this.player);
      this.effects.spawnStrike(this.player.pos(), 6, this._fx(SK).impact);
      try { this.effects.spawnShieldBubble(this.player, this._fx(SK).ring, dur, 1.8); } catch (_) {}
      try { this.effects.spawnRingPulse(this.player.pos(), 3, this._fx(SK).ring, 0.5, 0.9, 0.5); } catch (_) {}
      audio.sfx("cast_nova");
    } catch (e) {}
  }

  _castShield(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    const dur = Math.max(1, SK.duration || 6);
    const pct = Math.min(0.95, Math.max(0.05, SK.shieldPct || SK.defensePct || 0.4));
    this.player.defensePct = pct;
    this.player.defenseUntil = now() + dur;
    // Optional brief invulnerability window on cast
    if (SK.invulnDuration) {
      this.player.invulnUntil = Math.max(this.player.invulnUntil || 0, now() + Math.max(0, SK.invulnDuration));
    }
    try {
      this.effects.spawnHandFlash(this.player);
      this.effects.spawnStrike(this.player.pos(), 5, this._fx(SK).impact);
      try { this.effects.spawnShieldBubble(this.player, this._fx(SK).ring, dur, 1.8); } catch (_) {}
      try { this.effects.spawnRingPulse(this.player.pos(), 3, this._fx(SK).ring, 0.5, 0.9, 0.5); } catch (_) {}
      audio.sfx("aura_on");
    } catch (e) {}
  }

  _castTotem(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    this._vfxCastFlash(SK);
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    const pos = this.player.pos().clone();
    const duration = Math.max(3, SK.duration || 8);
    const tick = Math.max(0.4, SK.tick || 0.8);
    const radius = Math.max(6, SK.radius || 18);
    const dmg = this.scaleSkillDamage(SK.dmg || 12);
    this.totems.push({ pos, until: now() + duration, next: 0, tick, radius, dmg, fx: this._fx(SK) });
    try { this.effects.spawnStrike(pos, 2.5, this._fx(SK).impact); } catch (_) {}
  }

  _castMark(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || (SK.mana && !this.player.canSpend(SK.mana))) return;
    const effRange = Math.max(40, SK.range || 40);
    const near = this.enemies.filter(e => e.alive && distance2D(this.player.pos(), e.pos()) <= effRange);
    if (!near.length) { try { this.effects.showNoTargetHint(this.player, effRange); } catch(_) {} return; }
    const target = near.sort((a,b)=>distance2D(this.player.pos(),a.pos())-distance2D(this.player.pos(),b.pos()))[0];
    if (SK.mana) this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    target.vulnMult = Math.max(1.1, SK.vulnMult || 1.35);
    target.vulnUntil = now() + Math.max(2, SK.duration || 6);
    try {
      const to = target.pos().clone().add(new THREE.Vector3(0,1.2,0));
      const from = this.player.pos().clone().add(new THREE.Vector3(0,1.6,0));
      this.effects.spawnElectricBeamAuto(from, to, this._fx(SK).beam, 0.12);
      this.effects.spawnStrike(target.pos(), 1.2, this._fx(SK).impact);
      try { this.effects.spawnHitDecal(target.pos(), this._fx(SK).impact); } catch (_) {}
      audio.sfx("cast_beam");
    } catch (_) {}
  }

  _castBlink(key, point = null) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    const fx = this._fx(SK);
    const dist = Math.max(4, SK.range || SK.distance || 20);
    // Determine direction
    let dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    if (point && point.x !== undefined) {
      dir = point.clone().sub(this.player.pos()).setY(0).normalize();
      if (!isFinite(dir.lengthSq()) || dir.lengthSq() === 0) dir.set(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    }
    const to = this.player.pos().clone().add(dir.multiplyScalar(dist));
    const fromPos = this.player.pos().clone();
    if (!this.player.canSpend(SK.mana)) return;
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    try {
      this.effects.spawnStrike(this.player.pos(), 3, fx.ring);
      this.effects.spawnRingPulse(this.player.pos(), 2.5, fx.ring, 0.4, 0.7, 0.4);
      audio.sfx("storm_start");
    } catch (e) {}
    this.player.mesh.position.set(to.x, this.player.mesh.position.y, to.z);
    try {
      this.effects.spawnStrike(this.player.pos(), 3, fx.impact);
      this.effects.spawnHitDecal(this.player.pos(), fx.impact);
      this.effects.spawnRingPulse(this.player.pos(), 2.5, fx.ring, 0.45, 0.7, 0.4);
      const a = fromPos.clone().add(new THREE.Vector3(0, 0.8, 0));
      const b = this.player.pos().clone().add(new THREE.Vector3(0, 0.8, 0));
      this.effects.spawnArcNoisePath(a, b, fx.arc, 0.12, 3);
    } catch (e) {}
    if (SK.explosionRadius) {
      const r = Math.max(4, SK.explosionRadius);
      this.effects.spawnStrike(this.player.pos(), r, this._fx(SK).ring);
      const boomDmg = this.scaleSkillDamage(SK.explosionDmg || (SK.dmg || 12));
      this.enemies.forEach(en => {
        if (!en.alive) return;
        if (distance2D(en.pos(), this.player.pos()) <= (r + 2.5)) en.takeDamage(boomDmg);
      });
      this._requestShake(this._fx(SK).shake || 0.3);
    }
    this.player.moveTarget = null; this.player.target = null;
  }

  _castDash(key) {
    const SK = SKILLS[key]; if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;
    const dist = Math.max(4, SK.distance || 14);
    let dir = new THREE.Vector3(0,0,1).applyQuaternion(this.player.mesh.quaternion).normalize();
    const to = this.player.pos().clone().add(dir.multiplyScalar(dist));
    const fromPos = this.player.pos().clone();
    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    try { this.effects.spawnRingPulse(fromPos, 2.2, this._fx(SK).ring, 0.35, 0.7, 0.4); } catch (_) {}
    try { this.effects.spawnHandLink(this.player, 0.06); audio.sfx("cast_beam"); } catch (e) {}
    this.player.mesh.position.set(to.x, this.player.mesh.position.y, to.z);
    // Trail arcs and damage along path
    try {
      const steps = 6;
      const fx = this._fx(SK);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = fromPos.clone().lerp(to, t);
        const from = p.clone().add(new THREE.Vector3(0, 0.6, 0));
        const off = new THREE.Vector3((Math.random()-0.5)*2, 0.3 + Math.random()*0.6, (Math.random()-0.5)*2);
        this.effects.spawnArcNoisePath(from, from.clone().add(off), fx.arc, 0.08, 2);
        try { this.effects.spawnRingPulse(p, 1.6, fx.ring, 0.25, 0.5, 0.35); } catch (_) {}
        const rad = SK.trailRadius || 4;
        const tickDmg = this.scaleSkillDamage(SK.trailDmg || 6);
        this.enemies.forEach(en => {
          if (!en.alive) return;
          if (distance2D(en.pos(), p) <= rad) en.takeDamage(tickDmg);
        });
      }
    } catch (_) {}
    try { this.effects.spawnRingPulse(this.player.pos(), 2.2, this._fx(SK).ring, 0.35, 0.7, 0.4); } catch (_) {}
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
    const anchor = this.player.pos().clone();
    // schedule a thunder image that periodically zaps nearby enemies
    this.clones.push({ until: now() + duration, next: 0, rate, radius, dmg, pos: anchor, shook: false });
    try { this.effects.spawnHandFlash(this.player); audio.sfx("aura_on"); } catch(e) {}
    try {
      const fx = this._fx(SK);
      this.effects.spawnStrike(anchor, 5, fx.impact);
      const ring = createGroundRing(Math.max(0.4, radius * 0.25), Math.max(0.6, radius * 0.25 + 0.3), fx.ring, 0.25);
      ring.position.set(anchor.x, 0.02, anchor.z);
      this.effects.indicators.add(ring);
      this.effects.queue.push({ obj: ring, until: now() + duration, mat: ring.material, pulseAmp: 0.05, pulseRate: 2.8, baseScale: 1 });
    } catch(e) {}
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
      try {
        const ring = this.player.staticField.vfxRing;
        if (ring) {
          const q = this.effects.queue;
          for (let i = 0; i < q.length; i++) {
            if (q[i].obj === ring) { q[i].until = now(); break; }
          }
          this.player.staticField.vfxRing = null;
        }
      } catch (_) {}
      return;
    }
    if (t >= this.player.staticField.nextTick) {
      if (!this.player.canSpend(SKILLS.E.manaPerTick)) {
        this.player.staticField.active = false;
        try {
          const ring = this.player.staticField.vfxRing;
          if (ring) {
            const q = this.effects.queue;
            for (let i = 0; i < q.length; i++) {
              if (q[i].obj === ring) { q[i].until = now(); break; }
            }
            this.player.staticField.vfxRing = null;
          }
        } catch (_) {}
        return;
      }
      this.player.spend(SKILLS.E.manaPerTick);
      this.player.staticField.nextTick = t + SKILLS.E.tick;

      // Visual ring and zap
      const fx = this._fx(SKILLS.E);
      this.effects.spawnStrike(this.player.pos(), SKILLS.E.radius, fx.ring);
      audio.sfx("aura_tick");
      // Pulse ring for aura tick
      const pulse = createGroundRing(SKILLS.E.radius - 0.25, SKILLS.E.radius + 0.25, fx.ring, 0.32);
      const pl = this.player.pos();
      pulse.position.set(pl.x, 0.02, pl.z);
      this.effects.indicators.add(pulse);
      // queue for fade/scale cleanup
      this.effects.queue.push({ obj: pulse, until: now() + 0.22, fade: true, mat: pulse.material, scaleRate: 0.6 });

      // Crackle arcs around the ring for visual richness
      try {
        const base = this.player.pos().clone().add(new THREE.Vector3(0, 0.6, 0));
        for (let i = 0; i < 2; i++) {
          const ang = Math.random() * Math.PI * 2;
          const rr = (SKILLS.E.radius || 12) * (0.6 + Math.random() * 0.4);
          const to = this.player.pos().clone().add(new THREE.Vector3(Math.cos(ang) * rr, 0.6 + Math.random() * 0.6, Math.sin(ang) * rr));
          this.effects.spawnArcNoisePath(base, to, fx.ring, 0.08, 2);
        }
      } catch (_) {}

      const dmg = this.scaleSkillDamage(SKILLS.E.dmg || 0);
      this.enemies.forEach((en) => {
        if (en.alive && distance2D(en.pos(), this.player.pos()) <= (SKILLS.E.radius + 2.5)) {
          en.takeDamage(dmg);
          try { this.effects.spawnDamagePopup(en.pos(), dmg, fx.impact); } catch(e) {}
          try {
            this.effects.spawnStrike(en.pos(), 0.9, fx.impact);
            this.effects.spawnHitDecal(en.pos(), fx.impact);
          } catch (_) {}
        }
      });
    }
  }

  runStorms(cameraShake) {
    const t = now();
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i];
      const dt = Math.max(0, t - (s.last || t));
      s.last = t;
      s.acc = (s.acc || 0) + dt * (s.rate || 0);

      while (s.acc >= 1) {
        s.acc -= 1;

        // Prefer striking a random enemy inside the area; fallback to ground point
        let impact = null;
        const inArea = this.enemies.filter(en => en.alive && distance2D(en.pos(), s.center) <= (s.radius || 0));
        if (inArea.length > 0) {
          const target = inArea[Math.floor(Math.random() * inArea.length)];
          impact = target.pos().clone();
        } else {
          const ang = Math.random() * Math.PI * 2;
          const r = Math.random() * (s.radius || 12);
          impact = s.center.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
        }

        try {
          this.effects.spawnStrike(impact, 3, s.fx?.impact || 0xb5e2ff);
          audio.sfx("strike");
        } catch (_) {}

        // Damage around impact
        const hitR = Math.max(0.5, s.strikeRadius || 2.5);
        try { this.effects.spawnRingPulse(impact, Math.max(1.4, hitR), (s.fx?.ring || s.fx?.impact || 0xbfe2ff), 0.3, 0.6, 0.4); } catch (_) {}
        this.enemies.forEach((en) => {
          if (!en.alive) return;
          if (distance2D(en.pos(), impact) <= hitR) {
            en.takeDamage(s.dmg || 0);
            try { this.effects.spawnDamagePopup(en.pos(), s.dmg || 0, s.fx?.impact || 0xbfe2ff); } catch(e) {}
          }
        });

        // Distance-attenuated camera shake
        if (cameraShake) {
          const d = distance2D(this.player.pos(), impact);
          const att = Math.max(0.1, 1 - d / Math.max(1, s.radius || 30));
          const mag = Math.max(0, (s.fx?.shake || 0.3) * att);
          cameraShake.mag = Math.max(cameraShake.mag || 0, mag);
          cameraShake.until = now() + 0.18;
        }
      }

      if (t >= s.end) {
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
        const near = this.enemies.filter(e => e.alive && distance2D(c.pos, e.pos()) <= c.radius);
        if (near.length) {
          const target = near[Math.floor(Math.random() * near.length)];
          // stationary clone position (around anchor)
          const ang = Math.random() * Math.PI * 2;
          const off = new THREE.Vector3(Math.cos(ang) * 1.6, 1.4, Math.sin(ang) * 1.6);
          const from = c.pos.clone().add(off);
          const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
          try {
            this.effects.spawnElectricBeamAuto(from, to, 0x8fd3ff, 0.12);
            this.effects.spawnArcNoisePath(from, to, 0xbfe9ff, 0.08);
            audio.sfx("chain_hit");
            this.effects.spawnStrike(target.pos(), 0.9, 0x9fd3ff);
          } catch (e) {}
          target.takeDamage(c.dmg);
          if (!c.shook) { this._requestShake(0.2); c.shook = true; }
        }
        // schedule next zap
        c.next = t + (c.rate || 0.5);
      }
    }
  }

  // Totems: periodic strikes around placed anchor
  runTotems() {
    const t = now();
    for (let i = this.totems.length - 1; i >= 0; i--) {
      const tot = this.totems[i];
      if (t >= tot.until) { this.totems.splice(i, 1); continue; }
      if (!tot.next || t >= tot.next) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * (tot.radius || 12);
        const pt = tot.pos.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
        try {
          const col = (tot.fx && (tot.fx.impact || tot.fx.ring)) || 0x9fd3ff;
          this.effects.spawnStrike(pt, 2.4, col);
          this.effects.spawnRingPulse(pt, 1.8, col, 0.25, 0.45, 0.4);
        } catch (_) {}
        const dmg = tot.dmg || 10;
        this.enemies.forEach(en => {
          if (!en.alive) return;
          if (distance2D(en.pos(), pt) <= 4.0) en.takeDamage(dmg);
        });
        tot.next = t + (tot.tick || 1.0);
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
          const fx = this._fx(def);
          this.effects.spawnStrike(ahead, r, fx.ring);
          mkRing(ahead, r, fx.ring);
          break;
        }
        case "nova": {
          const r = def.radius || 12;
          const fx = this._fx(def);
          this.effects.spawnStrike(this.player.pos(), r, fx.ring);
          mkRing(this.player.pos(), r, fx.ring);
          break;
        }
        case "aura": {
          const r = def.radius || 12;
          const fx = this._fx(def);
          this.effects.spawnStrike(this.player.pos(), r, fx.ring);
          mkRing(this.player.pos(), r, fx.ring, 0.28);
          break;
        }
        case "storm": {
          const r = def.radius || 12;
          const n = Math.min(8, def.strikes || 6);
          const fx = this._fx(def);
          for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            const rr = Math.random() * r;
            const pt = this.player.pos().clone().add(new THREE.Vector3(Math.cos(ang) * rr, 0, Math.sin(ang) * rr));
            this.effects.spawnStrike(pt, 3, fx.impact);
          }
          mkRing(this.player.pos(), r, fx.ring, 0.18);
          break;
        }
        case "chain":
        case "beam": {
          const fx = this._fx(def);
          const to = ahead.clone().add(new THREE.Vector3(0, 1.2, 0));
          this.effects.spawnElectricBeamAuto(from, to, fx.beam, 0.12);
          this.effects.spawnStrike(ahead, 1.0, fx.impact);
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
    // Totems processing
    this.runTotems();
    // Cooldown UI every frame
    this.updateCooldownUI();

    if (cameraShake && (this._pendingShake || 0) > 0) {
      cameraShake.mag = Math.max(cameraShake.mag || 0, this._pendingShake);
      cameraShake.until = now() + 0.22;
      this._pendingShake = 0;
    }

  }
}

// Local small helper
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
