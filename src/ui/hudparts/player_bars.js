import { clamp01 } from "../../utils.js";

/**
 * PlayerBarsUI
 * - Manages player HP/MP/XP bars and texts
 * - Center message helper (set/clear)
 * - Level-up animation/feedback
 */
export class PlayerBarsUI {
  constructor() {
    // Bars and labels
    this.elHPFill = document.getElementById("hpFill");
    this.elMPFill = document.getElementById("mpFill");
    this.elXPFill = document.getElementById("xpFill");
    this.elHPText = document.getElementById("hpText");
    this.elMPText = document.getElementById("mpText");
    this.elXPText = document.getElementById("xpText");
    this.elLevelValue = document.getElementById("levelValue");

    // Center message
    this.deathMsgEl = document.getElementById("deathMsg");

    // Listen for level-up events to animate HUD / skill buttons
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("player-levelup", (e) => {
        try {
          this.showLevelUp && this.showLevelUp(e.detail);
        } catch (_) {}
      });
    }
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

  update(player) {
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

  /**
   * Visual feedback when player levels up.
   * - briefly pulses the level number
   * - adds a glow / pulse to skill buttons
   * - shows a short center message
   */
  showLevelUp(detail) {
    const level = detail?.level ?? null;

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
    } catch (_) {
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
    } catch (_) {}
  }
}
