import { getSkillIcon } from "../../skillbar.js";

/**
 * Render the Skills tab (loadout slots + skill pool + assign bar).
 * Expects static DOM containers to exist in HTML:
 *  - #heroSkillsList, #heroSkillsLeft, #heroSkillsRight
 */
export function renderSkillsTab(panelEl, ctx = {}, rerender) {
  const {
    t,
    SKILL_POOL = [],
    DEFAULT_LOADOUT = [],
    currentLoadout = [],
    setLoadoutAndSave,
    updateSkillBarLabels,
  } = ctx;

  // Maintain a live copy of loadout to avoid full screen re-rendering
  let activeLoadout = currentLoadout.slice();

  // Static containers defined in index.html
  const container = document.getElementById("heroSkillsList");
  const leftCol = document.getElementById("heroSkillsLeft");
  const rightCol = document.getElementById("heroSkillsRight");
  if (!container || !leftCol || !rightCol) return;

  // Clear any previous content
  try {
    leftCol.innerHTML = "";
    rightCol.innerHTML = "";
  } catch (_) {}

  // Loadout slots (Q W E R)
  const keys = ["Q", "W", "E", "R"];
  const slotsWrap = document.createElement("div");
  slotsWrap.className = "loadout-slots loadout-slots--compact";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "loadout-slot loadout-slot--compact";
    slot.dataset.slotIndex = String(i);
    const skillId = activeLoadout[i];
    const skillDef = SKILL_POOL.find((s) => s.id === skillId);
    slot.innerHTML = `
      <div class="slot-key">${keys[i]}</div>
      <div class="skill-icon">${getSkillIcon(skillDef ? skillDef.short : null)}</div>
      <div class="slot-short">${skillDef ? (skillDef.short || "—") : "—"}</div>
      <div class="slot-name">${skillDef ? (skillDef.name || "—") : (t ? (t("hero.slot.empty") || "Empty") : "Empty")}</div>
    `;
    slotsWrap.appendChild(slot);
  }
  rightCol.appendChild(slotsWrap);

  // Skill Pool (maps-style list)
  const poolPanel = document.createElement("div");
  poolPanel.className = "maps-panel";
  try {
    poolPanel.style.display = "flex";
    poolPanel.style.flexDirection = "column";
    poolPanel.style.flex = "1 1 auto";
    poolPanel.style.minHeight = "0";
  } catch (_) {}
  const list = document.createElement("div");
  list.className = "maps-list";
  try {
    list.style.flex = "1 1 auto";
    list.style.minHeight = "0";
    list.style.overflow = "auto";
    list.style.maxHeight = "none";
  } catch (_) {}

  SKILL_POOL.forEach((s) => {
    const row = document.createElement("div");
    row.className = "maps-row";
    row.dataset.skillId = s.id;

    const thumb = document.createElement("div");
    thumb.className = "maps-thumb";
    const em = document.createElement("div");
    em.className = "maps-thumb-ph";
    em.textContent = getSkillIcon(s.short);
    try {
      em.style.fontSize = "42px";
      em.style.lineHeight = "1";
    } catch (_) {}
    thumb.appendChild(em);

    const info = document.createElement("div");
    const title = document.createElement("div");
    title.className = "maps-title";
    title.textContent = `${s.name}${s.short ? " • " + s.short : ""}`;
    const desc = document.createElement("div");
    desc.className = "maps-desc";
    desc.textContent = s.type ? s.type : "";
    const req = document.createElement("div");
    req.className = "maps-req";
    const parts = [];
    if (s.cd != null) parts.push(`CD ${s.cd}s`);
    if (s.mana != null) parts.push(`MP ${s.mana}`);
    if (parts.length) req.textContent = parts.join(" • ");

    info.appendChild(title);
    if (desc.textContent) info.appendChild(desc);
    if (req.textContent) info.appendChild(req);

    const actions = document.createElement("div");
    actions.className = "maps-actions";
    const btn = document.createElement("button");
    btn.className = "pill-btn pill-btn--yellow";
    btn.textContent = "➕";
    btn.title = "Assign";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showAssignBar(s.id);
    });
    actions.appendChild(btn);

    row.appendChild(thumb);
    row.appendChild(info);
    row.appendChild(actions);

    row.addEventListener("click", () => showAssignBar(s.id));

    list.appendChild(row);
  });

  poolPanel.appendChild(list);
  leftCol.appendChild(poolPanel);

  // Actions row (Reset)
  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const resetBtn = document.createElement("button");
  resetBtn.className = "pill-btn pill-btn--yellow";
  resetBtn.textContent = "🔄";
  resetBtn.addEventListener("click", () => {
    const next = DEFAULT_LOADOUT.slice();
    applyLoadoutChange(next);
  });
  actions.appendChild(resetBtn);
  rightCol.appendChild(actions);

  // Interaction handling
  let selectedSlotIndex = null;
  let selectedSkillId = null;

  function safeDispatchLoadoutChanged() {
    try {
      window.dispatchEvent(new Event("loadout-changed"));
    } catch (_) {}
  }
  // Update only the slot tiles to avoid full Hero screen re-render and keep scroll positions stable
  function updateSlotsFromLoadout(loadout) {
    try {
      slotsWrap.querySelectorAll(".loadout-slot").forEach((slotEl) => {
        const i = parseInt(slotEl.dataset.slotIndex, 10);
        const skillId = loadout[i];
        const skillDef = SKILL_POOL.find((s) => s.id === skillId);
        slotEl.innerHTML = `
      <div class="slot-key">${keys[i]}</div>
      <div class="skill-icon">${getSkillIcon(skillDef ? skillDef.short : null)}</div>
      <div class="slot-short">${skillDef ? (skillDef.short || "—") : "—"}</div>
      <div class="slot-name">${skillDef ? (skillDef.name || "—") : (t ? (t("hero.slot.empty") || "Empty") : "Empty")}</div>
    `;
      });
    } catch (_) {}
  }
  function applyLoadoutChange(next) {
    try {
      setLoadoutAndSave && setLoadoutAndSave(next);
      activeLoadout = next.slice();
      safeDispatchLoadoutChanged();
      updateSkillBarLabels && updateSkillBarLabels();
      // Update slots UI in place to preserve scroll and avoid remounting other tabs
      updateSlotsFromLoadout(activeLoadout);
    } catch (_) {}
  }
  function assignSkillTo(slotIndex, skillId) {
    const next = activeLoadout.slice();
    next[slotIndex] = skillId;
    applyLoadoutChange(next);
  }

  // Assign bar (appears when a skill is selected; lets user pick Q/W/E/R)
  const assignBar = document.createElement("div");
  assignBar.className = "assign-bar";
  const assignLabel = document.createElement("div");
  assignLabel.className = "assign-label";
  const assignBtns = document.createElement("div");
  assignBtns.className = "assign-btns";
  const keysRow = ["Q", "W", "E", "R"].map((k, i) => {
    const b = document.createElement("button");
    b.className = "pill-btn pill-btn--yellow";
    b.textContent = k;
    b.addEventListener("click", () => {
      if (selectedSkillId != null) assignSkillTo(i, selectedSkillId);
    });
    return b;
  });
  keysRow.forEach((b) => assignBtns.appendChild(b));
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "pill-btn";
  cancelBtn.textContent = "❌";
  cancelBtn.addEventListener("click", () => {
    selectedSkillId = null;
    try {
      list.querySelectorAll(".maps-row").forEach((it) => {
        it.classList.remove("selected");
      });
    } catch (_) {}
    assignBar.classList.remove("active");
  });
  assignBtns.appendChild(cancelBtn);
  assignBar.appendChild(assignLabel);
  assignBar.appendChild(assignBtns);
  rightCol.appendChild(assignBar);

  // Slots selection
  slotsWrap.querySelectorAll(".loadout-slot").forEach((slotEl) => {
    slotEl.addEventListener("click", () => {
      slotsWrap.querySelectorAll(".loadout-slot").forEach((s) => s.classList.remove("selected"));
      slotEl.classList.add("selected");
      selectedSlotIndex = parseInt(slotEl.dataset.slotIndex, 10);
    });
  });

  function showAssignBar(skillId) {
    selectedSkillId = skillId;
    // highlight the selected item
    try {
      list.querySelectorAll(".maps-row").forEach((it) => {
        if (it.dataset.skillId === skillId) {
          it.classList.add("selected");
        } else {
          it.classList.remove("selected");
        }
      });
    } catch (_) {}
    const sd = SKILL_POOL.find((s) => s.id === skillId);
    const icon = getSkillIcon(sd ? sd.short : null);
    assignLabel.textContent = `Assign ${sd ? sd.name : ""} (${sd && sd.short ? sd.short : ""}) ${icon} to slot:`;
    assignBar.classList.add("active");
  }

  // Pool item interactions
  list.querySelectorAll(".maps-row").forEach((itemEl) => {
    const skillId = itemEl.dataset.skillId;
    // Click on row = select and show assign bar (no instant assign)
    itemEl.addEventListener("click", () => {
      showAssignBar(skillId);
    });
  });
}
