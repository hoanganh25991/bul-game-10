/**
 * Render the Maps tab: list available maps with switch action.
 * Expects panelEl to be #heroTabMaps (container is static in HTML).
 */
export function renderMapsTab(panelEl, ctx = {}) {
  const { mapManager, enemies, applyMapModifiersToEnemy, setCenterMsg, clearCenterMsg } = ctx;
  if (!panelEl || !mapManager) return;

  // Clear panel content
  try {
    panelEl.innerHTML = "";
  } catch (_) {}

  const wrap = document.createElement("div");
  wrap.className = "maps-panel";

  const list = document.createElement("div");
  list.className = "maps-list";
  wrap.appendChild(list);

  function renderMaps() {
    list.innerHTML = "";
    try {
      const items = mapManager.listMaps?.() || [];
      items.forEach((m) => {
        const row = document.createElement("div");
        row.className = "maps-row";

        const thumb = document.createElement("div");
        thumb.className = "maps-thumb";
        if (m.img) {
          thumb.style.backgroundImage = `url(${m.img})`;
          thumb.style.backgroundSize = "cover";
          thumb.style.backgroundPosition = "center";
          if (m.imgHint) thumb.title = m.imgHint;
        } else {
          const ph = document.createElement("div");
          ph.className = "maps-thumb-ph";
          ph.textContent = (m.name || "").slice(0, 2).toUpperCase();
          thumb.appendChild(ph);
        }

        const info = document.createElement("div");
        const title = document.createElement("div");
        title.className = "maps-title";
        title.textContent = `${m.name}${m.current ? " • Current" : ""}${(!m.unlocked ? " • Locked" : "")}`;
        const desc = document.createElement("div");
        desc.className = "maps-desc";
        desc.textContent = m.desc || "";
        const req = document.createElement("div");
        req.className = "maps-req";
        req.textContent = `Requires Lv ${m.requiredLevel}`;
        const elites = document.createElement("div");
        elites.className = "maps-elites";
        elites.textContent = (m.strongEnemies && m.strongEnemies.length) ? `Elites: ${m.strongEnemies.join(", ")}` : "";

        info.appendChild(title);
        info.appendChild(desc);
        info.appendChild(req);
        if (elites.textContent) info.appendChild(elites);

        const act = document.createElement("div");
        act.className = "maps-actions";
        const btn = document.createElement("button");
        if (m.current) {
          btn.className = "pill-btn pill-btn--yellow";
          btn.textContent = "✅";
          btn.disabled = true;
        } else if (!m.unlocked) {
          btn.className = "pill-btn";
          btn.textContent = "🔒";
          btn.disabled = true;
        } else {
          btn.className = "pill-btn pill-btn--yellow";
          btn.textContent = "📍";
          btn.addEventListener("click", () => {
            try {
              if (mapManager.setCurrent?.(m.index)) {
                enemies?.forEach?.((en) => applyMapModifiersToEnemy && applyMapModifiersToEnemy(en));
                // Adjust enemy density to match current map modifiers
                try { ctx.adjustEnemyCountForMap && ctx.adjustEnemyCountForMap(); } catch (_) {}
                setCenterMsg && setCenterMsg(`Switched to ${m.name}`);
                setTimeout(() => clearCenterMsg && clearCenterMsg(), 1100);
                renderMaps();
              }
            } catch (_) {}
          });
        }
        act.appendChild(btn);

        row.appendChild(thumb);
        row.appendChild(info);
        row.appendChild(act);
        list.appendChild(row);
      });
    } catch (_) {}
  }

  renderMaps();
  panelEl.appendChild(wrap);
}
