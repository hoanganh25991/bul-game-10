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
    const level = player?.level ?? 1;
    const hp = `${Math.floor(player?.hp ?? 0)}/${player?.maxHP ?? 0}`;
    const mp = `${Math.floor(player?.mp ?? 0)}/${player?.maxMP ?? 0}`;
    const tt = typeof t === "function" ? t : (x) => x;

    info.innerHTML = `
      <div>${tt("hero.info.level") || "Level"}: ${level}</div>
      <div>${tt("hero.info.hp") || "HP"}: ${hp}</div>
      <div>${tt("hero.info.mp") || "MP"}: ${mp}</div>
    `;
  } catch (_) {
    info.textContent = "—";
  }

  panelEl.appendChild(info);
}
