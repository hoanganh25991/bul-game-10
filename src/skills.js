import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { WORLD, SKILLS, COLOR, VILLAGE_POS, REST_RADIUS } from "./constants.js";
import { distance2D, now } from "./utils.js";
import { handWorldPos } from "./entities.js";
import { createGroundRing } from "./effects.js";

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
   */
  constructor(player, enemies, effects, cdUI) {
    this.player = player;
    this.enemies = enemies;
    this.effects = effects;
    this.cdUI = cdUI;

    this.cooldowns = { Q: 0, W: 0, E: 0, R: 0, Basic: 0 };
    this.cdState = { Q: 0, W: 0, E: 0, R: 0, Basic: 0 }; // for ready flash timing
    this.storms = []; // queued thunderstorm strikes
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

    // Prevent player from attacking targets outside the village while player is inside the village.
    // This blocks basic attacks from inside the village against outside enemies.
    try {
      if (attacker === this.player) {
        const pd = distance2D(attacker.pos(), VILLAGE_POS);
        const td = distance2D(target.pos(), VILLAGE_POS);
        if (pd <= REST_RADIUS && td > REST_RADIUS) return false;
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
    target.takeDamage(WORLD.basicAttackDamage);
    // show floating damage number on the target
    try { this.effects.spawnDamagePopup(target.pos(), WORLD.basicAttackDamage, 0xffe0e0); } catch (e) {}
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
    current.takeDamage(SK.dmg);
    // popup for chain hit
    try { this.effects.spawnDamagePopup(current.pos(), SK.dmg, 0xbfe9ff); } catch (e) {}
    this.effects.spawnStrike(current.pos(), 1.2, 0x9fd3ff);
    this.effects.spawnHitDecal(current.pos());
      lastPoint = hitPoint;
      candidates = this.enemies.filter(
        (e) =>
          e.alive &&
          e !== current &&
          distance2D(current.pos(), e.pos()) <= (SK.jumpRange || 0)
      );
      current = candidates[0];
    }
  }

  _castAOE(key, point) {
    const SK = SKILLS[key];
    if (!SK || !point) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    // Visual: central strike + radial
    this.effects.spawnStrike(point, SK.radius, 0x9fd8ff);

    // Damage enemies in radius and apply slow if present
    this.enemies.forEach((en) => {
      if (!en.alive) return;
      if (distance2D(en.pos(), point) <= SK.radius) {
        en.takeDamage(SK.dmg);
        try { this.effects.spawnDamagePopup(en.pos(), SK.dmg, 0x9fd8ff); } catch (e) {}
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
      return;
    }
    if (!this.player.canSpend((SK.manaPerTick || 0) * 2)) return; // need some mana to start
    this.startCooldown(key, SK.cd);
    this.player.staticField.active = true;
    this.player.staticField.until = now() + (SK.duration || 10);
    this.player.staticField.nextTick = 0;
  }

  _castBeam(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;

    // Immediate feedback
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
    target.takeDamage(SK.dmg);
    try { this.effects.spawnDamagePopup(target.pos(), SK.dmg, 0x9fd3ff); } catch(e) {}
    this.effects.spawnStrike(target.pos(), 1.0, 0x9fd3ff);
  }

  _castNova(key) {
    const SK = SKILLS[key];
    if (!SK) return;
    if (this.isOnCooldown(key) || !this.player.canSpend(SK.mana)) return;

    this.player.spend(SK.mana);
    this.startCooldown(key, SK.cd);
    this.effects.spawnHandFlash(this.player);
    try {
      this.effects.spawnHandLink(this.player, 0.06);
      this.effects.spawnHandCrackle(this.player, false, 1.0);
      this.effects.spawnHandCrackle(this.player, true, 1.0);
    } catch (e) {}

    // Radial damage around player
    this.effects.spawnStrike(this.player.pos(), SK.radius, 0x9fd8ff);
    this.enemies.forEach((en) => {
      if (en.alive && distance2D(en.pos(), this.player.pos()) <= SK.radius) {
        en.takeDamage(SK.dmg);
        try { this.effects.spawnDamagePopup(en.pos(), SK.dmg, 0x9fd8ff); } catch(e) {}
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
      // Pulse ring for aura tick (color shifts each pulse)
      const phase = Math.sin(now() * 8);
      const col = phase > 0 ? 0xbfe9ff : 0x7fc7ff;
      const pulse = createGroundRing(SKILLS.E.radius - 0.25, SKILLS.E.radius + 0.25, col, 0.32);
      const pl = this.player.pos();
      pulse.position.set(pl.x, 0.02, pl.z);
      this.effects.indicators.add(pulse);
      // queue for fade/scale cleanup
      this.effects.queue.push({ obj: pulse, until: now() + 0.22, fade: true, mat: pulse.material, scaleRate: 0.6 });

      this.enemies.forEach((en) => {
        if (en.alive && distance2D(en.pos(), this.player.pos()) <= SKILLS.E.radius) {
          en.takeDamage(SKILLS.E.dmg);
          try { this.effects.spawnDamagePopup(en.pos(), SKILLS.E.dmg, 0x7fc7ff); } catch(e) {}
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
          // camera shake on big strikes
          if (cameraShake) {
            cameraShake.mag = Math.max(cameraShake.mag, 0.4);
            cameraShake.until = now() + 0.18;
          }
          this.enemies.forEach((en) => {
            if (en.alive && distance2D(en.pos(), st.pt) <= 3.2) {
              en.takeDamage(SKILLS.R.dmg);
              try { this.effects.spawnDamagePopup(en.pos(), SKILLS.R.dmg, 0xbfe2ff); } catch(e) {}
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

  // ----- Per-frame update -----
  update(t, dt, cameraShake) {
    // Static Field tick
    this.runStaticField(dt, now());
    // Thunderstorm processing
    this.runStorms(cameraShake);
    // Cooldown UI every frame
    this.updateCooldownUI();
  }
}

// Local small helper
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
