import { VILLAGE_POS, REST_RADIUS } from "../../constants.js";

/**
 * MinimapUI
 * - Fixed CSS width: 208px
 * - Dynamic CSS height: 208 * screenAspect (window.innerHeight / window.innerWidth)
 * - DPR-aware rendering for crisp lines
 * - Throttling based on render quality preference (low/medium/high)
 */
export class MinimapUI {
  constructor() {
    this.canvas = document.getElementById("minimap");
    this.ctx = this.canvas?.getContext("2d") || null;

    // Sizing
    this._cssW = 208;
    this._cssH = 0; // computed
    this._dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    this._sizeDirty = true;

    // Throttling based on quality
    try {
      const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
      this._quality = prefs && typeof prefs.quality === "string" ? prefs.quality : "high";
    } catch (_) {
      this._quality = "high";
    }
    this._intervalMs = this._quality === "low" ? 150 : (this._quality === "medium" ? 90 : 0);
    this._lastT = 0;

    // Bind resize/orientation to recompute size lazily on next update
    try {
      window.addEventListener("resize", () => { this._sizeDirty = true; });
      window.addEventListener("orientationchange", () => { this._sizeDirty = true; });
    } catch (_) {}
  }

  _ensureSize() {
    if (!this.canvas || !this.ctx) return;

    const aspect = (typeof window !== "undefined" && window.innerWidth > 0)
      ? (window.innerHeight / window.innerWidth)
      : 1;

    const cssW = this._cssW;
    const cssH = Math.max(32, Math.round(cssW * aspect));
    this._cssH = cssH;

    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    this._dpr = dpr;

    try {
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";
      this.canvas.width = Math.max(1, Math.round(cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(cssH * dpr));
      // Draw using CSS pixel units
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } catch (_) {}

    this._sizeDirty = false;
  }

  update(player, enemies, portals, villages) {
    const ctx = this.ctx;
    if (!ctx || !this.canvas || !player) return;

    // Ensure size
    try {
      if (this._sizeDirty) this._ensureSize();
    } catch (_) {}
    const cssW = this._cssW || 208;
    const cssH = this._cssH || (208 * ((typeof window !== "undefined" && window.innerWidth) ? (window.innerHeight / window.innerWidth) : 1));

    // Throttle
    const nowT = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (this._intervalMs > 0) {
      if (nowT - (this._lastT || 0) < this._intervalMs) return;
      this._lastT = nowT;
    }

    // Clear and background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "rgba(10,20,40,0.6)";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "rgba(124,196,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, Math.max(0, cssW - 1), Math.max(0, cssH - 1));

    const center = player.pos();
    const scale = 0.8;
    const cx = cssW / 2;
    const cy = cssH / 2;
    const w2p = (wx, wz) => ({ x: cx + (wx - center.x) * scale, y: cy + (wz - center.z) * scale });

    // Roads (draw behind markers)
    try {
      const segs = villages?.listRoadSegments?.() || [];
      if (segs.length) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Underlay (lighter edge)
        ctx.strokeStyle = "rgba(210, 200, 190, 0.15)";
        ctx.lineWidth = 4;
        for (const s of segs) {
          const a = w2p(s.a.x, s.a.z);
          const b = w2p(s.b.x, s.b.z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        // Main road line (dark)
        ctx.strokeStyle = "rgba(43, 36, 32, 0.9)"; // ~0x2b2420
        ctx.lineWidth = 2;
        for (const s of segs) {
          const a = w2p(s.a.x, s.a.z);
          const b = w2p(s.b.x, s.b.z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    } catch (_) {}

    // Origin village ring
    ctx.strokeStyle = "rgba(90,255,139,0.6)";
    ctx.beginPath();
    ctx.arc(
      cx + (VILLAGE_POS.x - center.x) * scale,
      cy + (VILLAGE_POS.z - center.z) * scale,
      REST_RADIUS * scale,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // Dynamic villages (discovered)
    try {
      const list = villages?.listVillages?.() || [];
      ctx.strokeStyle = "rgba(90,255,139,0.35)";
      for (const v of list) {
        const p = w2p(v.center.x, v.center.z);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (v.radius || 0) * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    } catch (_) {}

    // Portals
    const villagePortal = portals?.getVillagePortal?.();
    const returnPortal = portals?.getReturnPortal?.();
    if (villagePortal) {
      const pos = villagePortal.group.position;
      const p = w2p(pos.x, pos.z);
      ctx.fillStyle = "rgba(124,77,255,0.9)";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    if (returnPortal) {
      const pos = returnPortal.group.position;
      const p = w2p(pos.x, pos.z);
      ctx.fillStyle = "rgba(180,120,255,0.9)";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }

    // Enemies
    if (enemies) {
      enemies.forEach((en) => {
        if (!en.alive) return;
        const ep = en.pos();
        const p = w2p(ep.x, ep.z);
        ctx.fillStyle = "rgba(255,80,80,0.95)";
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });
    }

    // Player
    const pp = w2p(center.x, center.z);
    ctx.fillStyle = "rgba(126,204,255,1)";
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
