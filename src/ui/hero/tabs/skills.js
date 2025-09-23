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
    const skillId = currentLoadout[i];
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

  // Skill Pool (list)
  const poolWrap = document.createElement("div");
  poolWrap.className = "skill-pool skill-pool--list";
  SKILL_POOL.forEach((s) => {
    const el = document.createElement("div");
    el.className = "skill-pool-item";
    el.dataset.skillId = s.id;
    el.innerHTML = `
      <div class="skill-icon">${getSkillIcon(s.short)}</div>
      <div class="skill-text">
        <div class="skill-name">${s.name}</div>
        <div class="skill-short">${s.short || ""}</div>
      </div>
    `;
    poolWrap.appendChild(el);
  });
  leftCol.appendChild(poolWrap);

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
  function applyLoadoutChange(next) {
    try {
      setLoadoutAndSave && setLoadoutAndSave(next);
      safeDispatchLoadoutChanged();
      updateSkillBarLabels && updateSkillBarLabels();
      if (typeof rerender === "function") rerender("skills", { currentLoadout: next });
    } catch (_) {}
  }
  function assignSkillTo(slotIndex, skillId) {
    const next = currentLoadout.slice();
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
      poolWrap.querySelectorAll(".skill-pool-item").forEach((it) => {
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
      poolWrap.querySelectorAll(".skill-pool-item").forEach((it) => {
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
  poolWrap.querySelectorAll(".skill-pool-item").forEach((itemEl) => {
    const skillId = itemEl.dataset.skillId;
    // Click on row = select and show assign bar (no instant assign)
    itemEl.addEventListener("click", () => {
      showAssignBar(skillId);
    });
  });
}
