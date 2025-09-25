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
  spawnHitDecal(center, color = 0xbfe9ff) {
    const ring = createGroundRing(0.2, 0.55, color, 0.5);
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
  
  // Expanding ground ring pulse (scales and fades)
  spawnRingPulse(center, radius = 6, color = COLOR.blue, duration = 0.35, width = 0.6, opacity = 0.55) {
    try {
      const ring = createGroundRing(Math.max(0.05, radius - width * 0.5), radius + width * 0.5, color, opacity);
      ring.position.set(center.x, 0.02, center.z);
      this.indicators.add(ring);
      // Scale out over time; fade handled by update loop
      this.queue.push({ obj: ring, until: now() + duration, fade: true, mat: ring.material, scaleRate: 1.0 });
    } catch (_) {}
  }

  // Cage of vertical bars for "Static Prison" and similar effects
  spawnCage(center, radius = 12, color = COLOR.blue, duration = 0.6, bars = 12, height = 2.2) {
    try {
      const g = new THREE.Group();
      const mats = [];
      const h = Math.max(1.4, height);
      const yMid = h * 0.5;
      const r = Math.max(1, radius);
      for (let i = 0; i < Math.max(6, bars); i++) {
        const ang = (i / Math.max(6, bars)) * Math.PI * 2;
        const x = center.x + Math.cos(ang) * r;
        const z = center.z + Math.sin(ang) * r;
        const geo = new THREE.CylinderGeometry(0.06, 0.06, h, 6);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, yMid, z);
        g.add(m);
        mats.push(mat);
      }
      // Ground ring tying the cage together
      const baseRing = createGroundRing(Math.max(0.2, r - 0.25), r + 0.25, color, 0.4);
      baseRing.position.set(center.x, 0.02, center.z);
      g.add(baseRing);
      mats.push(baseRing.material);

      this.transient.add(g);
      this.queue.push({ obj: g, until: now() + duration, fade: true, mats });
    } catch (_) {}
  }

  // Shield bubble that follows an entity and gently pulses
  spawnShieldBubble(entity, color = COLOR.blue, duration = 6, radius = 1.7) {
    try {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, wireframe: true });
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), mat);
      const p = entity.pos();
      bubble.position.set(p.x, 1.1, p.z);
      this.transient.add(bubble);
      this.queue.push({
        obj: bubble,
        until: now() + duration,
        fade: true,
        mat,
        follow: entity,
        followYOffset: 1.1,
        pulseAmp: 0.06,
        pulseRate: 3.5,
        baseScale: 1
      });
    } catch (_) {}
  }

  // Storm cloud disc hovering over an area (rotates and fades)
  spawnStormCloud(center, radius = 12, color = COLOR.blue, duration = 6, height = 3.6) {
    try {
      const thick = Math.max(0.6, radius * 0.08);
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(2, radius * 0.8), thick * 0.5, 12, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 })
      );
      torus.position.set(center.x, height, center.z);
      torus.rotation.x = Math.PI / 2; // lie flat like a cloud disc
      this.transient.add(torus);
      this.queue.push({ obj: torus, until: now() + duration, fade: true, mat: torus.material, spinRate: 0.6 });
    } catch (_) {}
  }

  // Orbiting energy orbs around an entity for a short duration
  spawnOrbitingOrbs(entity, color = COLOR.blue, opts = {}) {
    try {
      const count = Math.max(1, opts.count ?? 4);
      const r = Math.max(0.4, opts.radius ?? 1.2);
      const duration = Math.max(0.2, opts.duration ?? 1.0);
      const size = Math.max(0.06, opts.size ?? 0.16);
      const rate = Math.max(0.5, opts.rate ?? 4.0);

      const group = new THREE.Group();
      const children = [];
      for (let i = 0; i < count; i++) {
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(size, 10, 10),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
        );
        group.add(orb);
        children.push(orb);
      }
      const p = entity.pos();
      group.position.set(p.x, 0, p.z);
      this.transient.add(group);
      this.queue.push({
        obj: group,
        until: now() + duration,
        fade: true,
        follow: entity,
        followYOffset: 0,
        orbitChildren: children,
        orbitR: r,
        orbitRate: rate,
        orbitYOffset: 1.2
      });
    } catch (_) {}
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

  // Colored variant for skill-tinted flashes
  spawnHandFlashColored(player, color = 0x9fd8ff, left = false) {
    const p = left ? leftHandWorldPos(player) : handWorldPos(player);
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    s.position.copy(p);
    this.transient.add(s);
    this.queue.push({ obj: s, until: now() + 0.14, fade: true, mat: s.material, scaleRate: 2.0 });
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

      // Follow an entity (for bubbles/rings that should stick to a unit)
      if (e.follow && e.obj && typeof e.follow.pos === "function") {
        const p = e.follow.pos();
        try { e.obj.position.set(p.x, (e.followYOffset ?? e.obj.position.y), p.z); } catch (_) {}
      }

      // Pulsing scale (breathing bubble, buff auras)
      if (e.pulseAmp && e.obj && e.obj.scale) {
        const base = e.baseScale || 1;
        const rate = e.pulseRate || 3;
        const amp = e.pulseAmp || 0.05;
        const s2 = base * (1 + Math.sin(t * rate) * amp);
        try { e.obj.scale.set(s2, s2, s2); } catch (_) {}
      }

      // Spin rotation (e.g., storm cloud disc)
      if (e.spinRate && e.obj && e.obj.rotation) {
        try { e.obj.rotation.y += e.spinRate * dt; } catch (_) {}
      }

      // Orbiting orbs around a followed entity
      if (e.orbitChildren && e.obj) {
        const cnt = e.orbitChildren.length || 0;
        e.orbitBase = (e.orbitBase || 0) + (e.orbitRate || 4) * dt;
        const base = e.orbitBase || 0;
        const r = e.orbitR || 1.2;
        const y = e.orbitYOffset ?? 1.2;
        for (let i = 0; i < cnt; i++) {
          const child = e.orbitChildren[i];
          if (!child) continue;
          const ang = base + (i * Math.PI * 2) / Math.max(1, cnt);
          try { child.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r); } catch (_) {}
        }
      }

      if (e.fade) {
        const fadeOne = (m) => {
          if (!m) return;
          m.opacity = m.opacity ?? 1;
          m.transparent = true;
          m.opacity = Math.max(0, m.opacity - dt * 1.8);
        };
        if (e.mat) fadeOne(e.mat);
        if (e.mats && Array.isArray(e.mats)) e.mats.forEach(fadeOne);
      }

      if (t >= e.until) {
        // Remove from either transient or indicators group if present
        this.transient.remove(e.obj);
        this.indicators.remove(e.obj);
        // Dispose recursively
        const disposeMat = (m) => {
          try { if (m && m.map) m.map.dispose?.(); } catch (_) {}
          try { m && m.dispose?.(); } catch (_) {}
        };
        const disposeObj = (o) => {
          try { o.geometry && o.geometry.dispose?.(); } catch (_) {}
          try {
            if (Array.isArray(o.material)) o.material.forEach(disposeMat);
            else disposeMat(o.material);
          } catch (_) {}
        };
        try {
          if (e.obj && typeof e.obj.traverse === "function") {
            e.obj.traverse(disposeObj);
          } else {
            disposeObj(e.obj);
          }
        } catch (_) {}
        this.queue.splice(i, 1);
      }
    }
  }
}
