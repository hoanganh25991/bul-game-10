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
  wrap.className = "marks-panel";

  const head = document.createElement("div");
  head.className = "marks-head";

  const cd = document.createElement("span");
  head.appendChild(cd);

  const list = document.createElement("div");
  list.className = "marks-list";

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
          row.className = "marks-row";

          const info = document.createElement("div");
          info.className = "marks-info";
          const nm = (m.name && String(m.name).trim()) ? m.name : `Mark ${m.index + 1}`;
          info.textContent = `${nm} • (${Math.round(m.x)}, ${Math.round(m.z)}) • ${fmtTime(m.createdAt)}`;

          const actions = document.createElement("div");
          actions.className = "marks-actions";

          const rn = document.createElement("button");
          rn.className = "pill-btn";
          rn.textContent = "✏️";
          rn.title = "Rename";
          rn.addEventListener("click", () => {
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
          tp.addEventListener("click", () => {
            try {
              portals.teleportToMark?.(m.index, player);
            } catch (_) {}
          });

          const rm = document.createElement("button");
          rm.className = "pill-btn";
          rm.textContent = "🗑️";
          rm.title = "Remove";
          rm.addEventListener("click", () => {
            try {
              portals.removePersistentMark?.(m.index);
              render();
            } catch (_) {}
          });

          actions.appendChild(rn);
          actions.appendChild(tp);
          actions.appendChild(rm);

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
