import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { WORLD, SKILLS, COLOR } from "./constants.js";
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

    this.cooldowns = { Q: 0, W: 0, E: 0, R: 0 };
    this.cdState = { Q: 0, W: 0, E: 0, R: 0 }; // for ready flash timing
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
    for (const key of ["Q", "W", "E", "R"]) {
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
          const total = SKILLS[key].cd;
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
    const dist = distance2D(attacker.pos(), target.pos());
    if (dist > WORLD.attackRange) return false;

    attacker.nextBasicReady = time + WORLD.basicAttackCooldown;
    const from =
      attacker === this.player && this.player.mesh.userData.handAnchor
        ? handWorldPos(this.player)
        : attacker.pos().clone().add(new THREE.Vector3(0, 1.6, 0));
    const to = target.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
    this.effects.spawnElectricBeamAuto(from, to, COLOR.blue, 0.12);
    if (attacker === this.player) this.player.braceUntil = now() + 0.18;
    target.takeDamage(WORLD.basicAttackDamage);
    return true;
  }

  // ----- Skills -----
  castQ_ChainLightning() {
    if (this.isOnCooldown("Q")) return;

    // Immediate feedback even if no target
    this.effects.spawnHandFlash(this.player);

    // Find nearest enemy in range
    let candidates = this.enemies.filter(
      (e) => e.alive && distance2D(this.player.pos(), e.pos()) <= SKILLS.Q.range
    );
    if (candidates.length === 0) {
      this.effects.showNoTargetHint(this.player, SKILLS.Q.range);
      return;
    }

    if (!this.player.canSpend(SKILLS.Q.mana)) return;
    this.player.spend(SKILLS.Q.mana);
    this.startCooldown("Q", SKILLS.Q.cd);

    // Chain logic
    let current = candidates.sort(
      (a, b) =>
        distance2D(this.player.pos(), a.pos()) - distance2D(this.player.pos(), b.pos())
    )[0];
    let lastPoint = handWorldPos(this.player);
    let jumps = SKILLS.Q.jumps + 1; // include first
    while (current && jumps-- > 0) {
      const hitPoint = current.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
      this.effects.spawnElectricBeamAuto(lastPoint, hitPoint, 0x8fd3ff, 0.12);
      this.effects.spawnArcNoisePath(lastPoint, hitPoint, 0xbfe9ff, 0.08);
      current.takeDamage(SKILLS.Q.dmg);
      // extra impact visual
      this.effects.spawnStrike(current.pos(), 1.2, 0x9fd3ff);
      this.effects.spawnHitDecal(current.pos());
      // Next hop
      lastPoint = hitPoint;
      candidates = this.enemies.filter(
        (e) =>
          e.alive &&
          e !== current &&
          distance2D(current.pos(), e.pos()) <= SKILLS.Q.jumpRange
      );
      current = candidates[0];
    }
  }

  castW_AOE(point) {
    if (!point) return;
    if (this.isOnCooldown("W") || !this.player.canSpend(SKILLS.W.mana)) return;

    this.player.spend(SKILLS.W.mana);
    this.startCooldown("W", SKILLS.W.cd);
    this.effects.spawnHandFlash(this.player);

    // Visual: central strike + radial
    this.effects.spawnStrike(point, SKILLS.W.radius, 0x9fd8ff);

    // Damage enemies in radius and slow
    this.enemies.forEach((en) => {
      if (!en.alive) return;
      if (distance2D(en.pos(), point) <= SKILLS.W.radius) {
        en.takeDamage(SKILLS.W.dmg);
        en.slowUntil = now() + 1.5;
        en.slowFactor = 0.45;
      }
    });
  }

  castE_StaticField() {
    if (this.isOnCooldown("E")) return;
    // Toggle off if active
    if (this.player.staticField.active) {
      this.player.staticField.active = false;
      this.player.staticField.until = 0;
      this.startCooldown("E", 4); // small lockout to prevent spam-toggle
      return;
    }
    if (!this.player.canSpend(SKILLS.E.manaPerTick * 2)) return; // need some mana to start
    this.startCooldown("E", SKILLS.E.cd);
    this.player.staticField.active = true;
    this.player.staticField.until = now() + SKILLS.E.duration;
    this.player.staticField.nextTick = 0;
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
        }
      });
    }
  }

  castR_Thunderstorm() {
    if (this.isOnCooldown("R") || !this.player.canSpend(SKILLS.R.mana)) return;
    this.player.spend(SKILLS.R.mana);
    this.startCooldown("R", SKILLS.R.cd);
    this.effects.spawnHandFlash(this.player);

    const startT = now();
    const endT = startT + SKILLS.R.duration;
    const center = this.player.pos().clone();

    // Queue up strikes over duration
    const strikes = [];
    for (let i = 0; i < SKILLS.R.strikes; i++) {
      const when = startT + Math.random() * SKILLS.R.duration;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * SKILLS.R.radius;
      const pt = center.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      strikes.push({ when, pt });
    }
    this.storms.push({ strikes, end: endT });
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
