import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { COLOR } from "./constants.js";
import { now } from "./utils.js";
import { handWorldPos, leftHandWorldPos } from "./entities.js";

// Standalone ring factory (used by UI modules and effects)
export function createGroundRing(innerR, outerR, color, opacity = 0.6) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(innerR, outerR, 48),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
}

// Manages transient effects (lines, flashes) and indicator meshes (rings, pings)
export class EffectsManager {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.quality =
      (opts && opts.quality) ||
      (typeof localStorage !== "undefined"
        ? (JSON.parse(localStorage.getItem("renderPrefs") || "{}").quality || "high")
        : "high");

    this.transient = new THREE.Group();
    scene.add(this.transient);

    this.indicators = new THREE.Group();
    scene.add(this.indicators);

    // Internal timed queue for cleanup and animations
    this.queue = []; // items: { obj, until, fade?, mat?, scaleRate? }
  }

  // ----- Indicator helpers -----
  spawnMovePing(point, color = COLOR.blue) {
    const ring = createGroundRing(0.6, 0.85, color, 0.8);
    ring.position.set(point.x, 0.02, point.z);
    this.indicators.add(ring);
    this.queue.push({ obj: ring, until: now() + 0.8, fade: true, mat: ring.material, scaleRate: 1.6 });
  }

  spawnTargetPing(entity, color = 0xff6060) {
    if (!entity || !entity.alive) return;
    const p = entity.pos();
    const ring = createGroundRing(0.65, 0.9, color, 0.85);
    ring.position.set(p.x, 0.02, p.z);
    this.indicators.add(ring);
    this.queue.push({ obj: ring, until: now() + 0.7, fade: true, mat: ring.material, scaleRate: 1.4 });
  }

  showNoTargetHint(player, radius) {
    const ring = createGroundRing(Math.max(0.1, radius - 0.2), radius + 0.2, 0x8fd3ff, 0.35);
    const p = player.pos();
    ring.position.set(p.x, 0.02, p.z);
    this.indicators.add(ring);
    this.queue.push({ obj: ring, until: now() + 0.8, fade: true, mat: ring.material });
    // subtle spark at player for feedback
    this.spawnStrike(player.pos(), 1.2, 0x8fd3ff);
  }

  // ----- Beam helpers -----
  spawnBeam(from, to, color = COLOR.blue, life = 0.12) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    this.transient.add(line);
    const lifeMul = this.quality === "low" ? 0.7 : (this.quality === "medium" ? 0.85 : 1);
    this.queue.push({ obj: line, until: now() + life * lifeMul, fade: true, mat: material });
  }

  // Jagged electric beam with small fork
  spawnElectricBeam(from, to, color = COLOR.blue, life = 0.12, segments = 10, amplitude = 0.6) {
    const dir = to.clone().sub(from);
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const points = [];
    const seg = Math.max(4, Math.round(segments * (this.quality === "low" ? 0.5 : (this.quality === "medium" ? 0.75 : 1))));
    for (let i = 0; i <= seg; i++) {
      const t = i / segments;
      const p = from.clone().lerp(to, t);
      const amp = Math.sin(Math.PI * t) * amplitude;
      const jitter = normal.clone().multiplyScalar((Math.random() * 2 - 1) * amp)
        .add(up.clone().multiplyScalar((Math.random() * 2 - 1) * amp * 0.4));
      p.add(jitter);
      points.push(p);
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);
    this.transient.add(line);
    const lifeMul = this.quality === "low" ? 0.7 : (this.quality === "medium" ? 0.85 : 1);
    this.queue.push({ obj: line, until: now() + life * lifeMul, fade: true, mat: material });

    // occasional fork flicker
    const length = dir.length() || 1;
    if (length > 6) {
      const mid = from.clone().lerp(to, 0.6);
      const forkEnd = mid.clone().add(normal.clone().multiplyScalar(1.2 + Math.random() * 1.2));
      const g2 = new THREE.BufferGeometry().setFromPoints([mid, forkEnd]);
      const m2 = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const l2 = new THREE.Line(g2, m2);
      this.transient.add(l2);
      const lifeMul = this.quality === "low" ? 0.7 : (this.quality === "medium" ? 0.85 : 1);
      this.queue.push({ obj: l2, until: now() + life * lifeMul * 0.7, fade: true, mat: m2 });
    }
  }

  // Auto-scaling multi-pass beam for thickness by distance
  spawnElectricBeamAuto(from, to, color = COLOR.blue, life = 0.12) {
    const dir = to.clone().sub(from);
    const length = dir.length() || 1;
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const segments = Math.max(8, Math.min(18, Math.round(8 + length * 0.5)));
    const seg = Math.max(6, Math.round(segments * (this.quality === "low" ? 0.5 : (this.quality === "medium" ? 0.75 : 1))));
    const amplitude = Math.min(1.2, 0.35 + length * 0.03);
    const count = length < 12 ? 1 : (length < 28 ? 2 : 3);

    const countCap = this.quality === "low" ? 1 : (this.quality === "medium" ? 2 : 3);
    const passes = Math.min(count, countCap);

    for (let n = 0; n < passes; n++) {
      const pts = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / segments;
        const p = from.clone().lerp(to, t);
        const amp = Math.sin(Math.PI * t) * amplitude;
        const jitter = normal.clone().multiplyScalar((Math.random() * 2 - 1) * amp * (0.8 + n * 0.15))
          .add(up.clone().multiplyScalar((Math.random() * 2 - 1) * amp * 0.35));
        p.add(jitter);
        pts.push(p);
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const opacity = Math.max(0.35, (0.7 + Math.min(0.3, length * 0.01) - n * 0.15));
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
      const l = new THREE.Line(g, m);
      this.transient.add(l);
      const lifeMul = this.quality === "low" ? 0.7 : (this.quality === "medium" ? 0.85 : 1);
      this.queue.push({ obj: l, until: now() + life * lifeMul, fade: true, mat: m });
    }

    if (length > 6) {
      const mid = from.clone().lerp(to, 0.6);
      const forkEnd = mid.clone().add(normal.clone().multiplyScalar(1.2 + Math.random() * 1.2));
      const g2 = new THREE.BufferGeometry().setFromPoints([mid, forkEnd]);
      const m2 = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
      const l2 = new THREE.Line(g2, m2);
      this.transient.add(l2);
      const lifeMul = this.quality === "low" ? 0.7 : (this.quality === "medium" ? 0.85 : 1);
      this.queue.push({ obj: l2, until: now() + life * lifeMul * 0.7, fade: true, mat: m2 });
    }
  }

  spawnArcNoisePath(from, to, color = 0xbfe9ff, life = 0.08, passes = 2) {
    for (let i = 0; i < passes; i++) {
      this.spawnElectricBeam(from, to, color, life, 6, 0.2);
    }
  }

  // ----- Impact helpers -----
  spawnHitDecal(center) {
    const ring = createGroundRing(0.2, 0.55, 0xbfe9ff, 0.5);
    ring.position.set(center.x, 0.02, center.z);
    this.indicators.add(ring);
    this.queue.push({ obj: ring, until: now() + 0.22, fade: true, mat: ring.material, scaleRate: 1.3 });
  }

  spawnStrike(point, radius = 2, color = COLOR.blue) {
    // Vertical strike
    const from = point.clone().add(new THREE.Vector3(0, 14, 0));
    const to = point.clone().add(new THREE.Vector3(0, 0.2, 0));
    this.spawnBeam(from, to, color, 0.12);

    // Radial sparks
    for (let i = 0; i < (this.quality === "low" ? 1 : (this.quality === "medium" ? 2 : 4)); i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const p2 = point.clone().add(new THREE.Vector3(Math.cos(ang) * r, 0.2 + Math.random() * 1.2, Math.sin(ang) * r));
      this.spawnBeam(point.clone().add(new THREE.Vector3(0, 0.4, 0)), p2, color, 0.08);
    }
  }

  spawnHandFlash(player, left = false) {
    const p = left ? leftHandWorldPos(player) : handWorldPos(player);
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9 })
    );
    s.position.copy(p);
    this.transient.add(s);
    this.queue.push({ obj: s, until: now() + 0.12, fade: true, mat: s.material, scaleRate: 1.8 });
  }

  /**
   * Spawn a small floating damage text at world position.
   * amount may be a number or string. Color is a hex number.
   */
  spawnDamagePopup(worldPos, amount, color = 0xffe1e1) {
    // Throttle popups on lower qualities to reduce CanvasTexture churn
    const q = this.quality || "high";
    if (q === "low" && Math.random() > 0.3) return;
    if (q === "medium" && Math.random() > 0.6) return;
    if (!worldPos) return;
    const text = String(Math.floor(Number(amount) || amount));
    const w = 160;
    const h = 64;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    // Background transparent
    ctx.clearRect(0, 0, w, h);
    // Shadow / stroke for readability
    ctx.font = "bold 36px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const hex = (color >>> 0).toString(16).padStart(6, "0");
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = `#${hex}`;
    ctx.fillText(text, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const spr = new THREE.Sprite(mat);

    // Scale sprite so it's readable in world units
    const scaleBase = 0.8;
    const scale = scaleBase + Math.min(2.0, text.length * 0.08);
    spr.scale.set(scale * (w / 128), scale * (h / 64), 1);
    spr.position.set(worldPos.x, worldPos.y + 2.4, worldPos.z);

    this.transient.add(spr);
    this.queue.push({
      obj: spr,
      until: now() + 1.0,
      fade: true,
      mat: mat,
      velY: 0.9,
      map: tex,
    });
  }

  // Hand crackle sparks around hand anchor
  spawnHandCrackle(player, left = false, strength = 1) {
    if (!player) return;
    const origin = left ? leftHandWorldPos(player) : handWorldPos(player);
    const qMul = this.quality === "low" ? 0.4 : (this.quality === "medium" ? 0.6 : 1);
    const count = Math.max(1, Math.round((2 + Math.random() * 2 * strength) * qMul));
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.2), (Math.random() - 0.5)).normalize();
      const len = 0.35 + Math.random() * 0.5 * strength;
      const to = origin.clone().add(dir.multiplyScalar(len));
      this.spawnElectricBeam(origin.clone(), to, 0x9fd8ff, 0.06);
    }
  }

  // Short arc connecting both hands
  spawnHandLink(player, life = 0.08) {
    if (!player) return;
    const a = handWorldPos(player);
    const b = leftHandWorldPos(player);
    this.spawnElectricBeamAuto(a, b, 0x9fd8ff, life);
  }

  // ----- Frame update -----
  update(t, dt) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const e = this.queue[i];

      // Vertical motion for popups
      if (e.velY && e.obj && e.obj.position) {
        e.obj.position.y += e.velY * dt;
      }

      // Optional animated scaling (for pings)
      if (e.scaleRate && e.obj && e.obj.scale) {
        const s = 1 + e.scaleRate * dt;
        e.obj.scale.multiplyScalar(s);
      }

      if (e.fade && e.mat) {
        e.mat.opacity = e.mat.opacity ?? 1;
        e.mat.transparent = true;
        e.mat.opacity = Math.max(0, e.mat.opacity - dt * 1.8);
      }

      if (t >= e.until) {
        // Remove from either transient or indicators group if present
        this.transient.remove(e.obj);
        this.indicators.remove(e.obj);
        // Dispose geometry (if any)
        if (e.obj.geometry) e.obj.geometry.dispose?.();
        // Dispose material and texture if present
        if (e.obj.material) {
          try {
            if (e.obj.material.map) e.obj.material.map.dispose?.();
          } catch (e2) {}
          try {
            e.obj.material.dispose?.();
          } catch (e3) {}
        }
        this.queue.splice(i, 1);
      }
    }
  }
}
