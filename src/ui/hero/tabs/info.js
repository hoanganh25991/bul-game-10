import { getUpliftSummary } from "../../../uplift.js";
import { now } from "../../../utils.js";
/**
 * Render the Info tab: basic hero info (level, HP/MP).
 * Expects the panel element to be #heroTabInfo.
 */
export function renderInfoTab(panelEl, ctx = {}) {
  const { t, player } = ctx;
  if (!panelEl) return;

  // Clear panel content
  try {
    panelEl.innerHTML = "";
  } catch (_) {}

  const info = document.createElement("div");
  info.className = "hero-info";
  try {
    const tt = typeof t === "function" ? t : (x) => x;
    const level = Math.max(1, player?.level ?? 1);
    const hp = `${Math.floor(player?.hp ?? 0)}/${Math.floor(player?.maxHP ?? 0)}`;
    const mp = `${Math.floor(player?.mp ?? 0)}/${Math.floor(player?.maxMP ?? 0)}`;
    const baseDmg = Math.floor(player?.baseDamage ?? 0);
    const moveSpd = (player?.speed ?? 0).toFixed(1);
    const atkSpdMul = (player?.atkSpeedPerma ?? 1);
    const atkSpdPct = Math.round((atkSpdMul - 1) * 100);
    // Map info (name/depth) if available
    let mapName = "";
    let mapDepth = 0;
    try {
      const mods = ctx?.mapManager?.getModifiers?.() || {};
      mapName = mods.name || "";
      mapDepth = mods.depth || 0;
    } catch (_) {}
    // Uplifts summary
    let upliftLines = [];
    try { upliftLines = getUpliftSummary?.() || []; } catch (_) {}
    const upliftsHtml = upliftLines.length
      ? `<ul style="margin:6px 0 0 16px; padding:0;">${upliftLines.map(s => `<li>${s}</li>`).join("")}</ul>`
      : `<div style="opacity:0.8">No uplifts chosen yet</div>`;

    // Defense stat and status lists
    const defPct = Math.round((player?.defensePct ?? 0) * 100);
    const defActive = !!(player?.defenseUntil && now() < player.defenseUntil);
    const defRem = defActive ? Math.ceil(player.defenseUntil - now()) : 0;

    const buffs = [];
    const debuffs = [];

    if (defActive) {
      buffs.push(`Defense ${defPct}% (${defRem}s)`);
    }

    if (player?.speedBoostUntil && now() < player.speedBoostUntil && (player.speedBoostMul || 1) > 1) {
      const pmul = Math.round(((player.speedBoostMul || 1) - 1) * 100);
      const rem = Math.ceil(player.speedBoostUntil - now());
      buffs.push(`Move Speed +${pmul}% (${rem}s)`);
    }

    if (player?.atkSpeedUntil && now() < player.atkSpeedUntil && (player.atkSpeedMul || 1) !== 1) {
      const mul = player.atkSpeedMul || 1;
      const pct = Math.round((mul - 1) * 100);
      const rem = Math.ceil(player.atkSpeedUntil - now());
      buffs.push(`Attack Speed ${pct >= 0 ? "+" : ""}${pct}% (${rem}s)`);
    }

    if (player?.invulnUntil && now() < player.invulnUntil) {
      const rem = Math.ceil(player.invulnUntil - now());
      buffs.push(`Invulnerable (${rem}s)`);
    }

    if (player?.slowUntil && now() < player.slowUntil) {
      const slowF = player.slowFactor ?? 1;
      const red = Math.max(0, Math.round((1 - slowF) * 100));
      const rem = Math.ceil(player.slowUntil - now());
      debuffs.push(`Slowed ${red > 0 ? "-" + red : "?"}% (${rem}s)`);
    }

    if (player?.vulnUntil && now() < player.vulnUntil) {
      const vm = player.vulnMult || 1.25;
      const pct = Math.round((vm - 1) * 100);
      const rem = Math.ceil(player.vulnUntil - now());
      debuffs.push(`Vulnerable +${pct}% dmg taken (${rem}s)`);
    }

    const buffsHtml = buffs.length
      ? `<ul class="status-list">${buffs.map(s => `<li class="tag-buff">${s}</li>`).join("")}</ul>`
      : `<div style="opacity:0.8">—</div>`;

    const debuffsHtml = debuffs.length
      ? `<ul class="status-list">${debuffs.map(s => `<li class="tag-debuff">${s}</li>`).join("")}</ul>`
      : `<div style="opacity:0.8">—</div>`;

    info.innerHTML = `
      <div class="stats">
        <div><span class="label"><strong>${tt("hero.info.level") || "Level"}</strong></span><span class="value">${level}</span></div>
        <div><span class="label"><strong>${tt("hero.info.hp") || "HP"}</strong></span><span class="value">${hp}</span></div>
        <div><span class="label"><strong>${tt("hero.info.mp") || "MP"}</strong></span><span class="value">${mp}</span></div>
        <div><span class="label"><strong>Base Damage</strong></span><span class="value">${baseDmg}</span></div>
        <div><span class="label"><strong>Move Speed</strong></span><span class="value">${moveSpd}</span></div>
        <div><span class="label"><strong>Attack Speed</strong></span><span class="value">${atkSpdMul.toFixed(2)}x (${atkSpdPct >= 0 ? "+" : ""}${atkSpdPct}%)</span></div>
        <div><span class="label"><strong>Defense</strong></span><span class="value">${defPct}% ${defActive ? `<span class="tag-buff">(${defRem}s)</span>` : `<span class="muted">(inactive)</span>`}</span></div>
        ${mapName ? `<div><span class="label"><strong>Map</strong></span><span class="value">${mapName}${mapDepth ? ` &nbsp; <em>(Depth +${mapDepth})</em>` : ""}</span></div>` : ""}
      </div>

      <div class="section">
        <div class="section-title">Buffs</div>
        ${buffsHtml}
      </div>

      <div class="section">
        <div class="section-title">Debuffs</div>
        ${debuffsHtml}
      </div>

      <div class="section">
        <div class="section-title">Uplifts</div>
        ${upliftsHtml}
      </div>
    `;
  } catch (_) {
    info.textContent = "—";
  }

  panelEl.appendChild(info);
}
