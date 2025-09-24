import { getUpliftSummary } from "../../../uplift.js";
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

    info.innerHTML = `
      <div><strong>${tt("hero.info.level") || "Level"}:</strong> ${level}</div>
      <div><strong>${tt("hero.info.hp") || "HP"}:</strong> ${hp}</div>
      <div><strong>${tt("hero.info.mp") || "MP"}:</strong> ${mp}</div>
      <div style="margin-top:6px;"><strong>Base Damage:</strong> ${baseDmg}</div>
      <div><strong>Move Speed:</strong> ${moveSpd}</div>
      <div><strong>Attack Speed:</strong> ${atkSpdMul.toFixed(2)}x (${atkSpdPct >= 0 ? "+" : ""}${atkSpdPct}%)</div>
      ${mapName ? `<div style="margin-top:6px;"><strong>Map:</strong> ${mapName}${mapDepth ? ` &nbsp; <em>(Depth +${mapDepth})</em>` : ""}</div>` : ""}
      <div style="margin-top:8px;"><strong>Uplifts:</strong></div>
      ${upliftsHtml}
    `;
  } catch (_) {
    info.textContent = "—";
  }

  panelEl.appendChild(info);
}
