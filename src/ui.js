import { worldToMinimap, clamp01 } from "./utils.js";
import { VILLAGE_POS, REST_RADIUS } from "./constants.js";

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

    // Cooldown UI containers (pass to SkillsSystem)
    this.cdUI = {
      Q: document.getElementById("cdQ"),
      W: document.getElementById("cdW"),
      E: document.getElementById("cdE"),
      R: document.getElementById("cdR"),
    };

    // Minimap
    this.minimap = document.getElementById("minimap");
    this.miniCtx = this.minimap?.getContext("2d");

    // Center message
    this.deathMsgEl = document.getElementById("deathMsg");
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

  updateMinimap(player, enemies, portals) {
    const ctx = this.miniCtx;
    if (!ctx || !this.minimap || !player) return;

    ctx.clearRect(0, 0, 200, 200);
    // background
    ctx.fillStyle = "rgba(10,20,40,0.6)";
    ctx.fillRect(0, 0, 200, 200);
    ctx.strokeStyle = "rgba(124,196,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 199, 199);

    const center = player.pos();
    const scale = 0.8;

    // village area ring
    ctx.strokeStyle = "rgba(90,255,139,0.6)";
    ctx.beginPath();
    ctx.arc(
      100 + (VILLAGE_POS.x - center.x) * scale,
      100 + (VILLAGE_POS.z - center.z) * scale,
      REST_RADIUS * scale,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // portals
    const villagePortal = portals?.getVillagePortal?.();
    const returnPortal = portals?.getReturnPortal?.();
    if (villagePortal) {
      const p = worldToMinimap(
        villagePortal.group.position.x,
        villagePortal.group.position.z,
        center.x,
        center.z,
        scale
      );
      ctx.fillStyle = "rgba(124,77,255,0.9)";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    if (returnPortal) {
      const p = worldToMinimap(
        returnPortal.group.position.x,
        returnPortal.group.position.z,
        center.x,
        center.z,
        scale
      );
      ctx.fillStyle = "rgba(180,120,255,0.9)";
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }

    // enemies
    if (enemies) {
      enemies.forEach((en) => {
        if (!en.alive) return;
        const p = worldToMinimap(en.pos().x, en.pos().z, center.x, center.z, scale);
        ctx.fillStyle = "rgba(255,80,80,0.95)";
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });
    }

    // player
    const pp = worldToMinimap(center.x, center.z, center.x, center.z, scale);
    ctx.fillStyle = "rgba(126,204,255,1)";
    ctx.beginPath();
    ctx.arc(pp.x, pp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
