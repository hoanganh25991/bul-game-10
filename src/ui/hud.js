import { clamp01 } from "../utils.js";
import { VILLAGE_POS, REST_RADIUS } from "../constants.js";

export class UIManager {
  constructor() {
    // HUD elements
    this.elHPFill = document.getElementById("hpFill");
    this.elMPFill = document.getElementById("mpFill");
    this.elXPFill = document.getElementById("xpFill");
    this.elHPText = document.getElementById("hpText");
    this.elMPText = document.getElementById("mpText");
    this.elXPText = document.getElementById("xpText");
    this.elLevelValue = document.getElementById("levelValue");
    // Listen for level-up events to animate HUD / skill buttons
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("player-levelup", (e) => {
        try {
          this.showLevelUp && this.showLevelUp(e.detail);
        } catch (err) {
          // ignore
        }
      });
    }

    // Cooldown UI containers (pass to SkillsSystem)
    this.cdUI = {
      Q: document.getElementById("cdQ"),
      W: document.getElementById("cdW"),
      E: document.getElementById("cdE"),
      R: document.getElementById("cdR"),
      Basic: document.getElementById("cdBasic"),
    };

    // Minimap
    this.minimap = document.getElementById("minimap");
    this.miniCtx = this.minimap?.getContext("2d");
    // Minimap size: fixed width 208px, height follows screen aspect (h/w)
    this._miniCssW = 208;
    this._miniCssH = 0; // computed
    this._miniDPR = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    this._miniSizeDirty = true;
    this._ensureMinimapSize = () => {
      if (!this.minimap || !this.miniCtx) return;
      const aspect = (typeof window !== "undefined" && window.innerWidth > 0)
        ? (window.innerHeight / window.innerWidth)
        : 1;
      const cssW = this._miniCssW;
      const cssH = Math.max(32, Math.round(cssW * aspect));
      this._miniCssH = cssH;
      const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      this._miniDPR = dpr;
      try {
        this.minimap.style.width = cssW + "px";
        this.minimap.style.height = cssH + "px";
        this.minimap.width = Math.max(1, Math.round(cssW * dpr));
        this.minimap.height = Math.max(1, Math.round(cssH * dpr));
        // Draw using CSS pixel units
        this.miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } catch (_) {}
      this._miniSizeDirty = false;
    };
    try {
      window.addEventListener("resize", () => { this._miniSizeDirty = true; });
      window.addEventListener("orientationchange", () => { this._miniSizeDirty = true; });
    } catch (_) {}

    // Center message
    this.deathMsgEl = document.getElementById("deathMsg");

    // Quality-aware minimap throttling to reduce CPU on medium/low devices
    try {
      const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
      this._quality = prefs && typeof prefs.quality === "string" ? prefs.quality : "high";
    } catch (_) {
      this._quality = "high";
    }
    this._miniIntervalMs = this._quality === "low" ? 150 : (this._quality === "medium" ? 90 : 0); // ~6-11 FPS
    this._miniLastT = 0;
  }

  getCooldownElements() {
    return this.cdUI;
  }

  setCenterMsg(text) {
    if (!this.deathMsgEl) return;
    this.deathMsgEl.textContent = text;
    this.deathMsgEl.style.display = "block";
  }

  clearCenterMsg() {
    if (!this.deathMsgEl) return;
    this.deathMsgEl.style.display = "none";
  }

  updateHUD(player) {
    if (!player) return;
    const hpRatio = clamp01(player.hp / player.maxHP);
    const mpRatio = clamp01(player.mp / player.maxMP);
    const xpRatio = clamp01(player.xp / player.xpToLevel);
    if (this.elHPFill) this.elHPFill.style.width = `${hpRatio * 100}%`;
    if (this.elMPFill) this.elMPFill.style.width = `${mpRatio * 100}%`;
    if (this.elXPFill) this.elXPFill.style.width = `${xpRatio * 100}%`;
    if (this.elHPText) this.elHPText.textContent = `${Math.floor(player.hp)}/${player.maxHP}`;
    if (this.elMPText) this.elMPText.textContent = `${Math.floor(player.mp)}/${player.maxMP}`;
    if (this.elXPText) this.elXPText.textContent = `${Math.floor(player.xp)}/${player.xpToLevel}`;
    if (this.elLevelValue) this.elLevelValue.textContent = `${player.level}`;
  }

  updateMinimap(player, enemies, portals, villages) {
    const ctx = this.miniCtx;
    if (!ctx || !this.minimap || !player) return;

    // Ensure canvas size follows screen aspect (width fixed at 208px)
    try {
      if (this._miniSizeDirty) this._ensureMinimapSize && this._ensureMinimapSize();
    } catch (_) {}
    const cssW = this._miniCssW || 208;
    const cssH = this._miniCssH || (208 * ((typeof window !== "undefined" && window.innerWidth) ? (window.innerHeight / window.innerWidth) : 1));

    // Throttle minimap updates on medium/low to reduce CPU cost
    const nowT = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    if (this._miniIntervalMs > 0) {
      if (nowT - (this._miniLastT || 0) < this._miniIntervalMs) return;
      this._miniLastT = nowT;
    }

    // Clear and draw background/border using CSS-pixel units (ctx scaled by DPR)
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

    // village area ring
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

    // dynamic villages (draw rings for discovered villages)
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

    // portals
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

    // enemies
    if (enemies) {
      enemies.forEach((en) => {
        if (!en.alive) return;
        const ep = en.pos();
        const p = w2p(ep.x, ep.z);
        ctx.fillStyle = "rgba(255,80,80,0.95)";
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });
    }

    // player
    const pp = w2p(center.x, center.z);
    ctx.fillStyle = "rgba(126,204,255,1)";
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  /**
   * Visual feedback when player levels up.
   * - briefly pulses the level number
   * - adds a glow / pulse to skill buttons
   * - shows a short center message
   */
  showLevelUp(detail) {
    const level = detail?.level ?? null;
    const gained = detail?.gained ?? 1;

    // Pulse level number
    if (this.elLevelValue) {
      const el = this.elLevelValue;
      const prevTrans = el.style.transition || "";
      const prevColor = el.style.color || "";
      el.style.transition = "transform 260ms ease, color 260ms ease";
      el.style.transform = "scale(1.35)";
      el.style.color = "#ffd86a";
      setTimeout(() => {
        el.style.transform = "";
        el.style.color = prevColor;
        el.style.transition = prevTrans;
      }, 600);
    }

    // Glow skill buttons briefly
    try {
      const btns = document.querySelectorAll(".skill-btn");
      btns.forEach((b) => {
        const prevTransform = b.style.transform || "";
        const prevBox = b.style.boxShadow || "";
        b.style.transition = "transform 260ms ease, box-shadow 260ms ease";
        b.style.transform = "scale(1.08)";
        b.style.boxShadow = "0 0 18px 8px rgba(255,215,90,0.95)";
        setTimeout(() => {
          b.style.transform = prevTransform;
          b.style.boxShadow = prevBox;
        }, 900);
      });
    } catch (e) {
      // ignore DOM errors
    }

    // Short center message
    try {
      if (this.deathMsgEl) {
        this.setCenterMsg(`Level Up! Lv ${level}`);
        setTimeout(() => {
          this.clearCenterMsg();
        }, 1200);
      }
    } catch (e) {}
  }
}
