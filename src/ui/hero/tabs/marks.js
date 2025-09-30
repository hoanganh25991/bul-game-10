/**
 * Render the Marks tab: list persistent marks with actions (rename, teleport, remove) and cooldown status.
 * Expects panelEl to be #heroTabMarks (container is static in HTML).
 */
export function renderMarksTab(panelEl, ctx = {}) {
  const { portals, player } = ctx;
  if (!panelEl || !portals) return;

  // Clear panel content
  try {
    panelEl.innerHTML = "";
  } catch (_) {}

  const wrap = document.createElement("div");
  wrap.className = "items-panel";
  try {
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.flex = "1 1 auto";
    wrap.style.minHeight = "0";
  } catch (_) {}

  const head = document.createElement("div");
  head.className = "marks-head";

  const cd = document.createElement("span");
  head.appendChild(cd);

  const list = document.createElement("div");
  list.className = "items-list";
  try {
    list.style.flex = "1 1 auto";
    list.style.minHeight = "0";
    list.style.overflow = "auto";
    list.style.maxHeight = "none";
  } catch (_) {}

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch (_) {
      return String(ts);
    }
  }

  function render() {
    list.innerHTML = "";
    try {
      const arr = portals.listPersistentMarks?.() || [];
      if (!arr.length) {
        const empty = document.createElement("div");
        empty.className = "marks-empty";
        empty.textContent = "No marks yet. Use the 🚩 Mark button to place a flag.";
        list.appendChild(empty);
      } else {
        arr.forEach((m) => {
          const row = document.createElement("div");
          row.className = "items-row";

          const thumb = document.createElement("div");
          thumb.className = "items-thumb";
          const em = document.createElement("div");
          em.className = "items-thumb-ph";
          em.textContent = "🚩";
          try {
            em.style.fontSize = "42px";
            em.style.lineHeight = "1";
          } catch (_) {}
          thumb.appendChild(em);

          const info = document.createElement("div");
          const nm = (m.name && String(m.name).trim()) ? m.name : `Mark ${m.index + 1}`;
          const title = document.createElement("div");
          title.className = "items-title";
          title.textContent = nm;
          const desc = document.createElement("div");
          desc.className = "items-desc";
          desc.textContent = `Created: ${fmtTime(m.createdAt)}`;
          const req = document.createElement("div");
          req.className = "items-req";
          req.textContent = `(${Math.round(m.x)}, ${Math.round(m.z)})`;

          info.appendChild(title);
          info.appendChild(desc);
          info.appendChild(req);

          const actions = document.createElement("div");
          actions.className = "items-actions";

          const rn = document.createElement("button");
          rn.className = "pill-btn pill-btn--yellow";
          rn.textContent = "✏️";
          rn.title = "Rename";
          rn.addEventListener("click", (e) => {
            e.stopPropagation();
            try {
              const newName = prompt("Enter mark name", nm);
              if (newName != null) {
                portals.renamePersistentMark?.(m.index, newName);
                render();
              }
            } catch (_) {}
          });

          const tp = document.createElement("button");
          tp.className = "pill-btn pill-btn--yellow";
          tp.textContent = "🌀";
          tp.title = "Teleport";
          tp.addEventListener("click", (e) => {
            e.stopPropagation();
            try {
              portals.teleportToMark?.(m.index, player);
            } catch (_) {}
          });

          const rm = document.createElement("button");
          rm.className = "pill-btn pill-btn--yellow";
          rm.textContent = "🗑️";
          rm.title = "Remove";
          rm.addEventListener("click", (e) => {
            e.stopPropagation();
            try {
              portals.removePersistentMark?.(m.index);
              render();
            } catch (_) {}
          });

          actions.appendChild(rn);
          actions.appendChild(tp);
          actions.appendChild(rm);

          row.appendChild(thumb);
          row.appendChild(info);
          row.appendChild(actions);
          list.appendChild(row);
        });
      }
    } catch (_) {}
  }

  function tickCooldown() {
    try {
      const ms = portals.getMarkCooldownMs?.() || 0;
      if (ms <= 0) {
        cd.textContent = "Ready";
      } else {
        const s = Math.ceil(ms / 1000);
        const m = Math.floor(s / 60);
        const r = s % 60;
        cd.textContent = `Cooldown: ${m > 0 ? m + "m " : ""}${r}s`;
      }
    } catch (_) {}
  }

  // Avoid multiple intervals stacking by reusing a single global handle
  try {
    clearInterval(window.__marksPanelTick);
  } catch (_) {}
  window.__marksPanelTick = setInterval(tickCooldown, 500);
  tickCooldown();
  render();

  wrap.appendChild(head);
  wrap.appendChild(list);
  panelEl.appendChild(wrap);
}
