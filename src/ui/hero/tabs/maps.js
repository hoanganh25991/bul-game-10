/**
 * Render the Maps tab: pagination/infinite-style list with "Load more".
 * - Creates #items-panel container that consumes remaining height of heroTabMaps.
 * - Renders initial 20 items (base maps first, then synthesized endless maps).
 * - "Load more" appends next 20 items deterministically; endless generation is stable.
 */
export function renderMapsTab(panelEl, ctx = {}) {
  const { mapManager, enemies, applyMapModifiersToEnemy, setCenterMsg, clearCenterMsg, t } = ctx;
  const tt = typeof t === "function" ? t : (x) => x;
  if (!panelEl || !mapManager) return;

  // Clear panel content
  try { panelEl.innerHTML = ""; } catch (_) {}

  // Root container
  const wrap = document.createElement("div");
  wrap.className = "items-panel";
  wrap.id = "items-panel";
  // Make #items-panel consume remaining height
  try {
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.flex = "1 1 auto";
    wrap.style.minHeight = "0";
  } catch (_) {}

  // List (scrolling area)
  const list = document.createElement("div");
  list.className = "items-list";
  try {
    list.style.flex = "1 1 auto";
    list.style.minHeight = "0";
    list.style.overflow = "auto";
    list.style.maxHeight = "none";
  } catch (_) {}
  wrap.appendChild(list);

  // Footer with Load More
  const footer = document.createElement("div");
  footer.className = "items-footer";
  try {
    footer.style.display = "flex";
    footer.style.justifyContent = "center";
    footer.style.paddingTop = "6px";
  } catch (_) {}
  const loadBtn = document.createElement("button");
  loadBtn.className = "pill-btn pill-btn--yellow";
  loadBtn.textContent = tt("maps.loadMore") || "Load more";
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
    const name = `${tt("maps.endless")} +${depth} — ${theme}`;
    const requiredLevel = Math.max(1, (lastBase.requiredLevel || 1) + depth * 5);
    const desc = tt("maps.depthDesc").replace("${depth}", depth) || `Depth +${depth}. Each step strengthens foes: more HP, damage, speed and density.`;
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
      emoji: mapManager.emojiForIndex?.(idx),
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
      row.className = "items-row";

      const thumb = document.createElement("div");
      thumb.className = "items-thumb";
      const emoji = m.emoji || mapManager.emojiForIndex?.(m.index);
      if (emoji) {
        const em = document.createElement("div");
        em.className = "items-thumb-ph";
        em.textContent = emoji;
        try {
          em.style.fontSize = "42px"; /* large to match 64x64 container */
          em.style.lineHeight = "1";
        } catch (_) {}
        thumb.appendChild(em);
        if (m.imgHint) thumb.title = m.imgHint;
      } else if (m.img) {
        // Fallback to image if no emoji available
        thumb.style.backgroundImage = `url(${m.img})`;
        thumb.style.backgroundSize = "cover";
        thumb.style.backgroundPosition = "center";
        if (m.imgHint) thumb.title = m.imgHint;
      } else {
        const ph = document.createElement("div");
        ph.className = "items-thumb-ph";
        ph.textContent = (m.name || "").slice(0, 2).toUpperCase();
        thumb.appendChild(ph);
      }

      const info = document.createElement("div");
      const title = document.createElement("div");
      title.className = "items-title";
      title.textContent = `${m.name}${current ? ` • ${tt("maps.current")}` : ""}${(!unlocked ? ` • ${tt("maps.locked")}` : "")}`;
      const d = document.createElement("div");
      d.className = "items-desc";
      d.textContent = m.desc || "";
      const req = document.createElement("div");
      req.className = "items-req";
      req.textContent = `${tt("maps.requires")} Lv ${m.requiredLevel}`;
      const elites = document.createElement("div");
      elites.className = "items-elites";
      elites.textContent = (m.strongEnemies && m.strongEnemies.length) ? `${tt("maps.elites")} ${m.strongEnemies.join(", ")}` : "";

      info.appendChild(title);
      info.appendChild(d);
      info.appendChild(req);
      if (elites.textContent) info.appendChild(elites);

      const act = document.createElement("div");
      act.className = "items-actions";
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
