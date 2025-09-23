/* Hero Screen UI (Skills/Info/Skillbook/Maps/Marks)
   Extracted from main.js into a reusable module.
   Usage:
     import { renderHeroScreen } from "./ui/hero/index.js";
     renderHeroScreen("skills", { ...ctx });
*/
import { SCALING } from "../../constants.js";

function getSkillIcon(short) {
  if (!short) return "—";
  const k = String(short).slice(0, 3).toLowerCase();
  const map = {
    chn: "⚡",
    bol: "⚡",
    stc: "🔌",
    str: "⛈️",
    bam: "🔋",
    nov: "✴️",
    aoe: "💥",
    "n/a": "⚡",
    atk: "⚡",
  };
  return map[k] || "⚡";
}

export function renderHeroScreen(initialTab = "skills", ctx = {}) {
  const {
    t,
    player,
    SKILL_POOL,
    DEFAULT_LOADOUT,
    currentLoadout,
    setLoadoutAndSave,
    updateSkillBarLabels,
    mapManager,
    portals,
    enemies,
    effects,
    WORLD,
    setCenterMsg,
    clearCenterMsg,
    applyMapModifiersToEnemy,
  } = ctx;

  // Ensure tab structure with unified screen layout (header/content/footer)
  const content = document.querySelector("#heroScreen .panel-content");
  if (!content) return;
  content.innerHTML = "";
  try { content.style.display = "flex"; content.style.flexDirection = "column"; } catch (_) {}

  // Tab bar (Skills / Info / Skillbook / Maps / Marks)
  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";

  const infoBtn = document.createElement("button");
  infoBtn.className = "tab-btn" + (initialTab === "info" ? " active" : "");
  infoBtn.setAttribute("data-i18n", "hero.tabs.info");
  infoBtn.textContent = (t && t("hero.tabs.info")) || "Info";

  const skillsBtn = document.createElement("button");
  skillsBtn.className = "tab-btn" + ((initialTab !== "info" && initialTab !== "book" && initialTab !== "maps" && initialTab !== "marks") ? " active" : "");
  skillsBtn.setAttribute("data-i18n", "hero.tabs.skills");
  skillsBtn.textContent = (t && t("hero.tabs.skills")) || "Skills";

  const bookBtn = document.createElement("button");
  bookBtn.className = "tab-btn" + (initialTab === "book" ? " active" : "");
  bookBtn.setAttribute("data-i18n", "hero.tabs.skillbook");
  bookBtn.textContent = (t && t("hero.tabs.skillbook")) || "Skillbook";

  const mapsBtn = document.createElement("button");
  mapsBtn.className = "tab-btn" + (initialTab === "maps" ? " active" : "");
  mapsBtn.setAttribute("data-i18n", "hero.tabs.maps");
  mapsBtn.textContent = (t && t("hero.tabs.maps")) || "Maps";

  const marksBtn = document.createElement("button");
  marksBtn.className = "tab-btn" + (initialTab === "marks" ? " active" : "");
  marksBtn.setAttribute("data-i18n", "hero.tabs.marks");
  marksBtn.textContent = (t && t("hero.tabs.marks")) || "Marks";

  tabBar.appendChild(infoBtn);
  tabBar.appendChild(skillsBtn);
  tabBar.appendChild(bookBtn);
  tabBar.appendChild(mapsBtn);
  tabBar.appendChild(marksBtn);
  content.appendChild(tabBar);

  // Panels
  const infoPanel = document.createElement("div");
  infoPanel.className = "tab-panel" + (initialTab === "info" ? " active" : "");
  const skillsPanel = document.createElement("div");
  skillsPanel.className = "tab-panel" + ((initialTab !== "info" && initialTab !== "book" && initialTab !== "maps" && initialTab !== "marks") ? " active" : "");
  const bookPanel = document.createElement("div");
  bookPanel.className = "tab-panel" + (initialTab === "book" ? " active" : "");
  const mapsPanel = document.createElement("div");
  mapsPanel.className = "tab-panel" + (initialTab === "maps" ? " active" : "");
  const marksPanel = document.createElement("div");
  marksPanel.className = "tab-panel" + (initialTab === "marks" ? " active" : "");
  // Initialize visibility based on initialTab
  infoPanel.style.display = (initialTab === "info") ? "block" : "none";
  skillsPanel.style.display = ((initialTab !== "info" && initialTab !== "book" && initialTab !== "maps" && initialTab !== "marks") ? "block" : "none");
  bookPanel.style.display = (initialTab === "book") ? "block" : "none";
  mapsPanel.style.display = (initialTab === "maps") ? "block" : "none";
  marksPanel.style.display = (initialTab === "marks") ? "block" : "none";

  // Info content
  const info = document.createElement("div");
  info.className = "hero-info";
  try {
    info.innerHTML = `<div>${t ? t("hero.info.level") : "Level"}: ${player.level || 1}</div><div>${t ? t("hero.info.hp") : "HP"}: ${Math.floor(player.hp)}/${player.maxHP}</div><div>${t ? t("hero.info.mp") : "MP"}: ${Math.floor(player.mp)}/${player.maxMP}</div>`;
  } catch (_) {
    info.textContent = "—";
  }
  infoPanel.appendChild(info);

  // Skills content
  const container = document.createElement("div");
  container.id = "heroSkillsList";
  skillsPanel.appendChild(container);
  // Two-column layout wrapper
  const twoCol = document.createElement("div");
  twoCol.className = "hero-skills-grid";
  try {
    twoCol.style.display = "grid";
    twoCol.style.gridTemplateColumns = "1fr 1fr";
    twoCol.style.gap = "12px";
    twoCol.style.alignItems = "start";
  } catch (_) {}
  const leftCol = document.createElement("div");
  const rightCol = document.createElement("div");
  container.appendChild(twoCol);
  twoCol.appendChild(leftCol);
  twoCol.appendChild(rightCol);

  // Loadout slots (Q W E R)
  const keys = ["Q", "W", "E", "R"];
  const slotsWrap = document.createElement("div");
  slotsWrap.className = "loadout-slots";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "loadout-slot";
    slot.dataset.slotIndex = String(i);
    const skillId = currentLoadout[i];
    const skillDef = SKILL_POOL.find((s) => s.id === skillId);
    slot.innerHTML = `<div class="slot-key">${keys[i]}</div>
                      <div class="skill-icon">${getSkillIcon(skillDef ? skillDef.short : null)}</div>
                      <div class="slot-short">${skillDef ? skillDef.short : "—"}</div>
                      <div class="slot-name">${skillDef ? skillDef.name : (t ? t("hero.slot.empty") : "Empty")}</div>`;
    slotsWrap.appendChild(slot);
  }
  rightCol.appendChild(slotsWrap);
  try {
    slotsWrap.style.display = "flex";
    slotsWrap.style.flexDirection = "column";
    slotsWrap.style.justifyContent = "center";
    slotsWrap.style.alignItems = "center";
    slotsWrap.style.gap = "10px";
    slotsWrap.style.marginBottom = "8px";
    slotsWrap.style.flexWrap = "nowrap";
  } catch (_) {}
  try {
    Array.from(slotsWrap.children).forEach((slot) => {
      slot.style.width = "64px";
      slot.style.height = "64px";
      slot.style.minWidth = "64px";
      slot.style.padding = "0";
      slot.style.border = "1px solid rgba(255,255,255,0.12)";
      slot.style.borderRadius = "8px";
      slot.style.display = "flex";
      slot.style.flexDirection = "column";
      slot.style.alignItems = "center";
      slot.style.justifyContent = "center";
      slot.style.position = "relative";
      const nm = slot.querySelector(".slot-name");
      if (nm) nm.style.display = "none";
      const ic = slot.querySelector(".skill-icon");
      if (ic) ic.style.fontSize = "22px";
      const sh = slot.querySelector(".slot-short");
      if (sh) {
        sh.style.display = "block";
        sh.style.position = "absolute";
        sh.style.bottom = "4px";
        sh.style.left = "50%";
        sh.style.transform = "translateX(-50%)";
        sh.style.fontSize = "10px";
        sh.style.opacity = "0.9";
      }
      const ky = slot.querySelector(".slot-key");
      if (ky) {
        ky.style.position = "absolute";
        ky.style.top = "2px";
        ky.style.left = "4px";
        ky.style.fontSize = "10px";
        ky.style.opacity = "0.8";
      }
    });
  } catch (_) {}


  const poolWrap = document.createElement("div");
  poolWrap.className = "skill-pool";
  // Force list layout (not grid)
  try {
    poolWrap.style.display = "flex";
    poolWrap.style.flexDirection = "column";
    poolWrap.style.gap = "6px";
  } catch (_) {}
  SKILL_POOL.forEach((s) => {
    const el = document.createElement("div");
    el.className = "skill-pool-item";
    el.dataset.skillId = s.id;
    // More informative list item: icon, name, short
    el.style.display = "grid";
    el.style.gridTemplateColumns = "28px 1fr";
    el.style.alignItems = "center";
    el.style.gap = "8px";
    el.style.padding = "6px 8px";
    el.style.border = "1px solid rgba(255,255,255,0.1)";
    el.style.borderRadius = "6px";
    el.style.cursor = "pointer";
    el.innerHTML = `<div class="skill-icon" style="font-size:18px;">${getSkillIcon(s.short)}</div>
                    <div class="skill-text">
                      <div class="skill-name" style="font-weight:600;">${s.name}</div>
                      <div class="skill-short" style="opacity:0.8;font-size:12px;">${s.short || ""}</div>
                    </div>`;
    poolWrap.appendChild(el);
  });
  leftCol.appendChild(poolWrap);

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const resetBtn = document.createElement("button");
  resetBtn.className = "pill-btn pill-btn--yellow";
  resetBtn.textContent = "🔄";
  resetBtn.addEventListener("click", () => {
    const next = DEFAULT_LOADOUT.slice();
    try {
      setLoadoutAndSave(next);
      try { window.dispatchEvent(new Event("loadout-changed")); } catch (_) {}
      renderHeroScreen("skills", Object.assign({}, ctx, { currentLoadout: next }));
      updateSkillBarLabels && updateSkillBarLabels();
    } catch (_) {}
  });
  actions.appendChild(resetBtn);
  rightCol.appendChild(actions);
  try { actions.style.display = "flex"; actions.style.justifyContent = "center"; actions.style.marginTop = "8px"; } catch (_) {}

  // Interaction handling + improved UX for assignment
  let selectedSlotIndex = null;
  let selectedSkillId = null;

  // Helper to apply loadout changes and refresh UI
  function applyLoadoutChange(next) {
    try {
      setLoadoutAndSave(next);
      try { window.dispatchEvent(new Event("loadout-changed")); } catch (_) {}
      renderHeroScreen("skills", Object.assign({}, ctx, { currentLoadout: next }));
      updateSkillBarLabels && updateSkillBarLabels();
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
  Object.assign(assignBar.style, {
    display: "none",
    margin: "8px 0",
    padding: "8px",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    textAlign: "center",
    background: "linear-gradient(135deg, rgba(124,196,255,0.10), rgba(255,255,255,0.04))",
  });
  const assignLabel = document.createElement("div");
  assignLabel.style.marginBottom = "6px";
  const assignBtns = document.createElement("div");
  assignBtns.style.display = "flex";
  assignBtns.style.gap = "8px";
  assignBtns.style.justifyContent = "center";
  const keysRow = ["Q","W","E","R"].map((k, i) => {
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
        it.style.background = "";
      });
    } catch (_) {}
    assignBar.style.display = "none";
  });
  assignBtns.appendChild(cancelBtn);
  assignBar.appendChild(assignLabel);
  assignBar.appendChild(assignBtns);

  // Insert assign bar on the right column under the slots
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
          it.style.background = "rgba(124,196,255,0.10)";
        } else {
          it.classList.remove("selected");
          it.style.background = "";
        }
      });
    } catch (_) {}
    const sd = SKILL_POOL.find((s) => s.id === skillId);
    const icon = getSkillIcon(sd ? sd.short : null);
    assignLabel.textContent = `Assign ${sd ? sd.name : ""} (${sd && sd.short ? sd.short : ""}) ${icon} to slot:`;
    assignBar.style.display = "block";
  }

  // Pool item interactions
  poolWrap.querySelectorAll(".skill-pool-item").forEach((itemEl) => {
    const skillId = itemEl.dataset.skillId;

    // Click on row = select and show assign bar (no instant assign)
    itemEl.addEventListener("click", () => {
      showAssignBar(skillId);
    });

  });

  // Build Skillbook panel content (list + details + preview)
  (function buildSkillbookPanel() {
    const wrap = document.createElement("div");
    wrap.className = "skillbook";
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "1fr 2fr";
    wrap.style.gap = "12px";

    const list = document.createElement("div");
    list.className = "skillbook-list";
    list.style.maxHeight = "340px";
    list.style.overflow = "auto";
    const ul = document.createElement("div");
    ul.style.display = "flex";
    ul.style.flexDirection = "column";
    ul.style.gap = "6px";
    list.appendChild(ul);

    const detail = document.createElement("div");
    detail.className = "skillbook-detail";
    detail.style.minHeight = "240px";
    detail.style.padding = "8px";
    detail.style.border = "1px solid rgba(255,255,255,0.1)";
    detail.style.borderRadius = "6px";
    const title = document.createElement("h3");
    const icon = document.createElement("div");
    icon.style.fontSize = "28px";
    const expl = document.createElement("div");
    expl.style.marginTop = "6px";
    const stats = document.createElement("div");
    stats.style.fontSize = "12px";
    stats.style.opacity = "0.9";
    stats.style.lineHeight = "1.6";
    const imgBox = document.createElement("div");
    imgBox.style.marginTop = "8px";
    const previewBtn = document.createElement("button");
    previewBtn.className = "pill-btn pill-btn--yellow";
    previewBtn.textContent = "▶️";
    detail.style.position = "relative";
    Object.assign(previewBtn.style, { position: "absolute", top: "8px", right: "8px", marginTop: "0" });

    // Assign row (same UX as pool)
    const assignRow = document.createElement("div");
    assignRow.style.display = "flex";
    assignRow.style.gap = "8px";
    assignRow.style.marginTop = "8px";
    const assignLabel2 = document.createElement("div");
    assignLabel2.style.opacity = "0.9";
    const btns2 = document.createElement("div");
    btns2.style.display = "flex";
    btns2.style.gap = "8px";
    const assignBtns2 = ["Q","W","E","R"].map((k, i) => {
      const b = document.createElement("button");
      b.className = "pill-btn pill-btn--yellow";
      b.textContent = k;
      b.addEventListener("click", () => {
        const s = assignRow.__skill;
        if (s && s.id) assignSkillTo(i, s.id);
      });
      return b;
    });
    assignBtns2.forEach((b) => btns2.appendChild(b));
    assignRow.appendChild(assignLabel2);
    assignRow.appendChild(btns2);

    detail.appendChild(title);
    detail.appendChild(expl);
    detail.appendChild(icon);
    detail.appendChild(stats);
    detail.appendChild(imgBox);
    detail.appendChild(assignRow);
    detail.appendChild(previewBtn);

    const typeExplain = {
      chain: "Chains between nearby enemies, hitting multiple targets.",
      aoe: "Ground-targeted area. Damages enemies within its radius.",
      aura: "Toggle aura around hero. Ticks damage periodically while draining mana.",
      storm: "Multiple random strikes in a radius over time.",
      beam: "Instant zap to nearest enemy in range.",
      nova: "Radial burst around hero.",
      heal: "Restores hero HP instantly.",
      mana: "Restores hero MP instantly.",
      buff: "Temporarily increases damage and speed.",
      dash: "Quickly dash forward.",
      blink: "Teleport toward direction/point.",
      clone: "Summons a lightning image that periodically zaps nearby foes.",
    };

    function computeDamage(s) {
      const base = s.dmg || 0;
      const lvl = Math.max(1, (player && player.level) || 1);
      const mult = Math.pow(SCALING.hero.skillDamageGrowth, Math.max(0, lvl - 1));
      return Math.floor(base * mult);
    }

    function renderDetail(s) {
      title.textContent = `${s.name} (${s.short || ""})`;
      icon.textContent = getSkillIcon(s.short || s.name);
      const dmgLine = typeof s.dmg === "number" ? `Damage: ${computeDamage(s)} (base ${s.dmg})` : "";
      const lines = [
        `Type: ${s.type}`,
        s.cd != null ? `Cooldown: ${s.cd}s` : "",
        s.mana != null ? `Mana: ${s.mana}` : "",
        s.radius != null ? `Radius: ${s.radius}` : "",
        s.range != null ? `Range: ${s.range}` : "",
        s.jumps != null ? `Jumps: ${s.jumps}` : "",
        s.jumpRange != null ? `Jump Range: ${s.jumpRange}` : "",
        s.tick != null ? `Tick: ${s.tick}s` : "",
        s.duration != null ? `Duration: ${s.duration}s` : "",
        s.slowFactor != null ? `Slow: ${Math.round(s.slowFactor * 100)}%` : "",
        s.slowDuration != null ? `Slow Duration: ${s.slowDuration}s` : "",
        dmgLine,
      ].filter(Boolean);
      stats.innerHTML = lines.map((x) => `<div>${x}</div>`).join("");
      expl.textContent = typeExplain[s.type] || "No description.";
      previewBtn.onclick = () => {
        try {
          window.__skillsRef && window.__skillsRef.previewSkill(s);
        } catch (_) {}
      };
      // wire assign row for previewed skill
      assignRow.__skill = s;
      assignLabel2.textContent = `Assign ${s.name} (${s.short || ""}) ${getSkillIcon(s.short || s.name)} to slot:`;
    }

    SKILL_POOL.forEach((s) => {
      const btn = document.createElement("div");
      btn.className = "skillbook-item";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "8px";
      btn.style.cursor = "pointer";
      const ic = document.createElement("span");
      ic.textContent = getSkillIcon(s.short || s.name);
      const nm = document.createElement("span");
      nm.textContent = s.name;
      btn.appendChild(ic);
      btn.appendChild(nm);
      btn.addEventListener("click", () => renderDetail(s));
      ul.appendChild(btn);
    });

    try {
      if (SKILL_POOL.length) renderDetail(SKILL_POOL[0]);
    } catch (_) {}

    wrap.appendChild(list);
    wrap.appendChild(detail);
    bookPanel.appendChild(wrap);
  })();

  // Build Maps panel content (scrollable list + set active)
  (function buildMapsPanel() {
    if (!mapManager) return;
    const wrap = document.createElement("div");
    wrap.className = "maps-panel";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";

    const title = document.createElement("h3");
    title.textContent = (t && t("hero.tabs.maps")) || "Maps";
    wrap.appendChild(title);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";
    list.style.maxHeight = "300px";
    list.style.overflow = "auto";
    wrap.appendChild(list);

    function renderMaps() {
      list.innerHTML = "";
      try {
        const items = mapManager.listMaps?.() || [];
        items.forEach((m) => {
          const row = document.createElement("div");
          row.style.display = "grid";
          row.style.gridTemplateColumns = "64px 1fr auto";
          row.style.gap = "12px";
          row.style.border = "1px solid rgba(255,255,255,0.1)";
          row.style.borderRadius = "8px";
          row.style.padding = "8px";

          const thumb = document.createElement("div");
          thumb.style.width = "64px";
          thumb.style.height = "64px";
          thumb.style.borderRadius = "6px";
          thumb.style.background = "linear-gradient(135deg, rgba(124,196,255,0.15), rgba(255,255,255,0.06))";
          thumb.style.border = "1px solid rgba(255,255,255,0.12)";
          thumb.style.overflow = "hidden";
          if (m.img) {
            thumb.style.backgroundImage = `url(${m.img})`;
            thumb.style.backgroundSize = "cover";
            thumb.style.backgroundPosition = "center";
            if (m.imgHint) thumb.title = m.imgHint;
          } else {
            const ph = document.createElement("div");
            ph.style.width = "100%";
            ph.style.height = "100%";
            ph.style.display = "flex";
            ph.style.alignItems = "center";
            ph.style.justifyContent = "center";
            ph.style.fontWeight = "700";
            ph.style.opacity = "0.7";
            ph.textContent = (m.name || "").slice(0, 2).toUpperCase();
            thumb.appendChild(ph);
          }

          const info = document.createElement("div");
          const title = document.createElement("div");
          title.style.fontWeight = "600";
          title.textContent = `${m.name}${m.current ? " • Current" : ""}${(!m.unlocked ? " • Locked" : "")}`;
          const desc = document.createElement("div");
          desc.style.fontSize = "12px";
          desc.style.opacity = "0.85";
          desc.textContent = m.desc || "";
          const req = document.createElement("div");
          req.style.fontSize = "12px";
          req.style.opacity = "0.7";
          req.textContent = `Requires Lv ${m.requiredLevel}`;
          const elites = document.createElement("div");
          elites.style.fontSize = "12px";
          elites.style.opacity = "0.9";
          elites.style.marginTop = "4px";
          elites.textContent = (m.strongEnemies && m.strongEnemies.length) ? `Elites: ${m.strongEnemies.join(", ")}` : "";

          info.appendChild(title);
          info.appendChild(desc);
          info.appendChild(req);
          if (elites.textContent) info.appendChild(elites);

          const act = document.createElement("div");
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
    mapsPanel.appendChild(wrap);
  })();

  // Build Marks panel content (table + teleport/remove/rename + cooldown status)
  (function buildMarksPanel() {
    if (!portals) return;
    const wrap = document.createElement("div");
    wrap.className = "marks-panel";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "12px";

    const head = document.createElement("div");
    head.style.display = "flex";
    head.style.alignItems = "center";
    head.style.justifyContent = "space-between";
    const titleMarks = document.createElement("h3");
    titleMarks.textContent = (t && t("hero.tabs.marks")) || "Marks";
    const cd = document.createElement("span");
    cd.style.fontSize = "12px";
    cd.style.opacity = "0.8";
    head.appendChild(titleMarks);
    head.appendChild(cd);

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gridTemplateColumns = "1fr auto auto auto";
    list.style.rowGap = "6px";
    list.style.columnGap = "8px";
    list.style.alignItems = "center";
    list.style.maxHeight = "240px";
    list.style.overflow = "auto";

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
          list.innerHTML = "";
          const empty = document.createElement("div");
          empty.style.opacity = "0.8";
          empty.style.fontSize = "12px";
          empty.textContent = "No marks yet. Use the 🚩 Mark button to place a flag.";
          list.appendChild(empty);
        } else {
          arr.forEach((m) => {
            const info = document.createElement("div");
            const nm = (m.name && String(m.name).trim()) ? m.name : `Mark ${m.index + 1}`;
            info.textContent = `${nm} • (${Math.round(m.x)}, ${Math.round(m.z)}) • ${fmtTime(m.createdAt)}`;

            const rn = document.createElement("button");
            rn.className = "pill-btn";
            rn.textContent = "✏️";
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
            tp.addEventListener("click", () => {
              try {
                portals.teleportToMark?.(m.index, player);
              } catch (_) {}
            });

            const rm = document.createElement("button");
            rm.className = "pill-btn";
            rm.textContent = "🗑️";
            rm.addEventListener("click", () => {
              try {
                portals.removePersistentMark?.(m.index);
                render();
              } catch (_) {}
            });

            list.appendChild(info);
            list.appendChild(rn);
            list.appendChild(tp);
            list.appendChild(rm);
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

    try {
      clearInterval(window.__marksPanelTick);
    } catch (_) {}
    window.__marksPanelTick = setInterval(tickCooldown, 500);
    tickCooldown();
    render();

    wrap.appendChild(head);
    wrap.appendChild(list);
    marksPanel.appendChild(wrap);
  })();

  // Append panels
  content.appendChild(infoPanel);
  content.appendChild(skillsPanel);
  content.appendChild(bookPanel);
  content.appendChild(mapsPanel);
  content.appendChild(marksPanel);

  // Tab switching
  function activate(panel) {
    [infoBtn, skillsBtn, bookBtn, mapsBtn, marksBtn].forEach((b) => b.classList.remove("active"));
    [infoPanel, skillsPanel, bookPanel, mapsPanel, marksPanel].forEach((p) => {
      p.classList.remove("active");
      p.style.display = "none";
    });
    if (panel === "info") {
      infoBtn.classList.add("active");
      infoPanel.classList.add("active");
      infoPanel.style.display = "block";
    } else if (panel === "book") {
      bookBtn.classList.add("active");
      bookPanel.classList.add("active");
      bookPanel.style.display = "block";
    } else if (panel === "maps") {
      mapsBtn.classList.add("active");
      mapsPanel.classList.add("active");
      mapsPanel.style.display = "block";
    } else if (panel === "marks") {
      marksBtn.classList.add("active");
      marksPanel.classList.add("active");
      marksPanel.style.display = "block";
    } else {
      skillsBtn.classList.add("active");
      skillsPanel.classList.add("active");
      skillsPanel.style.display = "block";
    }
  }
  infoBtn.addEventListener("click", () => activate("info"));
  skillsBtn.addEventListener("click", () => activate("skills"));
  bookBtn.addEventListener("click", () => activate("book"));
  mapsBtn.addEventListener("click", () => activate("maps"));
  marksBtn.addEventListener("click", () => activate("marks"));

  try {
    window.applyTranslations && window.applyTranslations(document.getElementById("heroScreen"));
  } catch (_) {}
}
