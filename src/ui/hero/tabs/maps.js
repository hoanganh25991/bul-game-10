/**
 * Render the Maps tab: pagination/infinite-style list with "Load more".
 * - Creates #maps-panel container that consumes remaining height of heroTabMaps.
 * - Renders initial 20 items (base maps first, then synthesized endless maps).
 * - "Load more" appends next 20 items deterministically; endless generation is stable.
 */
export function renderMapsTab(panelEl, ctx = {}) {
  const { mapManager, enemies, applyMapModifiersToEnemy, setCenterMsg, clearCenterMsg } = ctx;
  if (!panelEl || !mapManager) return;

  // Clear panel content
  try { panelEl.innerHTML = ""; } catch (_) {}

  // Root container
  const wrap = document.createElement("div");
  wrap.className = "maps-panel";
  wrap.id = "maps-panel";
  // Make #maps-panel consume remaining height
  try {
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.flex = "1 1 auto";
    wrap.style.minHeight = "0";
  } catch (_) {}

  // List (scrolling area)
  const list = document.createElement("div");
  list.className = "maps-list";
  try {
    list.style.flex = "1 1 auto";
    list.style.minHeight = "0";
    list.style.overflow = "auto";
    list.style.maxHeight = "none";
  } catch (_) {}
  wrap.appendChild(list);

  // Footer with Load More
  const footer = document.createElement("div");
  footer.className = "maps-footer";
  try {
    footer.style.display = "flex";
    footer.style.justifyContent = "center";
    footer.style.paddingTop = "6px";
  } catch (_) {}
  const loadBtn = document.createElement("button");
  loadBtn.className = "pill-btn pill-btn--yellow";
  loadBtn.textContent = "Load more";
  footer.appendChild(loadBtn);
  wrap.appendChild(footer);

  // Data/state
  const baseList = (mapManager.listMaps?.() || []).slice().sort((a, b) => a.index - b.index);
  const BASE_LEN = baseList.length;
  const lastBase = baseList[BASE_LEN - 1] || {};
  let buffer = [];
  let nextIndex = 1;
  const PAGE = 20;

  // Simple deterministic endless name parts
  const THEMES = [
    "Crackling Outskirts",
    "Thundered Ravine",
    "Ionic Expanse",
    "Maelstrom Verge",
    "Stormglass Flats",
    "Voltspire Causeway",
    "Tempest Barrens",
    "Aetheric Steppe",
    "Gale-Torn Lowlands",
    "Lightning Wastes",
  ];
  const ELITES = [
    "Stormborn Vanguards",
    "Auric Wardens",
    "Tempest Guard",
    "Void Reavers",
    "Thunder Heralds",
  ];

  function synthesizeMap(idx) {
    if (idx <= BASE_LEN) {
      // Shallow copy base item to prevent accidental mutation
      const b = baseList[idx - 1];
      return { ...b };
    }
    const depth = idx - BASE_LEN;
    const theme = THEMES[(depth - 1) % THEMES.length];
    const elite = ELITES[(depth - 1) % ELITES.length];
    const name = `Endless +${depth} — ${theme}`;
    const requiredLevel = Math.max(1, (lastBase.requiredLevel || 1) + depth * 5);
    const desc = `Depth +${depth}. Each step strengthens foes: more HP, damage, speed and density.`;
    return {
      index: idx,
      name,
      requiredLevel,
      enemyTint: lastBase.enemyTint || 0x9fd8ff,
      enemyHpMul: lastBase.enemyHpMul || 1,
      enemyDmgMul: lastBase.enemyDmgMul || 1,
      enemySpeedMul: lastBase.enemySpeedMul || 1,
      enemyCountMul: lastBase.enemyCountMul || 1,
      desc,
      strongEnemies: [`${elite} (empowered)`],
      img: lastBase.img,
      imgHint: lastBase.imgHint || `Endless Depth +${depth}`,
    };
  }

  function ensureBuffer(n) {
    while (buffer.length < n) {
      buffer.push(synthesizeMap(nextIndex++));
    }
  }

  function renderBuffer() {
    const unlockedMax = mapManager.getUnlockedMax?.() ?? 1;
    const currentIdx = mapManager.getCurrentIndex?.() ?? 1;
    list.innerHTML = "";

    buffer.forEach((m) => {
      const unlocked = m.index <= unlockedMax;
      const current = m.index === currentIdx;

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
      title.textContent = `${m.name}${current ? " • Current" : ""}${(!unlocked ? " • Locked" : "")}`;
      const d = document.createElement("div");
      d.className = "maps-desc";
      d.textContent = m.desc || "";
      const req = document.createElement("div");
      req.className = "maps-req";
      req.textContent = `Requires Lv ${m.requiredLevel}`;
      const elites = document.createElement("div");
      elites.className = "maps-elites";
      elites.textContent = (m.strongEnemies && m.strongEnemies.length) ? `Elites: ${m.strongEnemies.join(", ")}` : "";

      info.appendChild(title);
      info.appendChild(d);
      info.appendChild(req);
      if (elites.textContent) info.appendChild(elites);

      const act = document.createElement("div");
      act.className = "maps-actions";
      const btn = document.createElement("button");
      if (current) {
        btn.className = "pill-btn pill-btn--yellow";
        btn.textContent = "✅";
        btn.disabled = true;
      } else if (!unlocked) {
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
              renderBuffer();
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
  }

  function loadMore() {
    ensureBuffer(buffer.length + PAGE);
    renderBuffer();
  }

  // Initialize: fill to 20 items total
  ensureBuffer(20);
  renderBuffer();
  loadBtn.addEventListener("click", loadMore);

  panelEl.appendChild(wrap);
}
