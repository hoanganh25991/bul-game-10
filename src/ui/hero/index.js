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
  try { content.style.display = "flex"; content.style.flexDirection = "column"; } catch (_) {}

  // Bind to static tab bar and panels defined in index.html
  const tabBar = content.querySelector(".tab-bar");
  const tabBtns = tabBar ? Array.from(tabBar.querySelectorAll(".tab-btn")) : [];

  const skillsPanel = document.getElementById("heroTabSkills");
  const infoPanel = document.getElementById("heroTabInfo");
  const bookPanel = document.getElementById("heroTabBook");
  const mapsPanel = document.getElementById("heroTabMaps");
  const marksPanel = document.getElementById("heroTabMarks");

  const panels = {
    heroTabSkills: skillsPanel,
    heroTabInfo: infoPanel,
    heroTabBook: bookPanel,
    heroTabMaps: mapsPanel,
    heroTabMarks: marksPanel,
  };

  function showPanelById(id) {
    Object.values(panels).forEach((p) => {
      if (!p) return;
      p.classList.remove("active");
      p.style.display = "none";
    });
    const target = panels[id];
    if (target) {
      target.classList.add("active");
      target.style.display = "block";
    }
    tabBtns.forEach((b) => b.classList.remove("active"));
    const activeBtn = tabBtns.find((b) => b.getAttribute("aria-controls") === id);
    if (activeBtn) activeBtn.classList.add("active");
  }

  // Initial activation based on initialTab
  const tabMap = { skills: "heroTabSkills", info: "heroTabInfo", book: "heroTabBook", maps: "heroTabMaps", marks: "heroTabMarks" };
  showPanelById(tabMap[initialTab] || "heroTabSkills");

  // Bind tab buttons
  tabBtns.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("aria-controls");
      if (id) showPanelById(id);
    });
    btn.dataset.bound = "1";
  });

  // Info content
  const info = document.createElement("div");
  info.className = "hero-info";
  try {
    info.innerHTML = `<div>${t ? t("hero.info.level") : "Level"}: ${player.level || 1}</div><div>${t ? t("hero.info.hp") : "HP"}: ${Math.floor(player.hp)}/${player.maxHP}</div><div>${t ? t("hero.info.mp") : "MP"}: ${Math.floor(player.mp)}/${player.maxMP}</div>`;
  } catch (_) {
    info.textContent = "—";
  }
  infoPanel.appendChild(info);

  // Skills content (bind to static container/columns)
  const container = document.getElementById("heroSkillsList");
  const leftCol = document.getElementById("heroSkillsLeft");
  const rightCol = document.getElementById("heroSkillsRight");
  if (!container || !leftCol || !rightCol) return;
  try { leftCol.innerHTML = ""; rightCol.innerHTML = ""; } catch (_) {}

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
    slot.innerHTML = `<div class="slot-key">${keys[i]}</div>
                      <div class="skill-icon">${getSkillIcon(skillDef ? skillDef.short : null)}</div>
                      <div class="slot-short">${skillDef ? skillDef.short : "—"}</div>
                      <div class="slot-name">${skillDef ? skillDef.name : (t ? t("hero.slot.empty") : "Empty")}</div>`;
    slotsWrap.appendChild(slot);
  }
  rightCol.appendChild(slotsWrap);


  const poolWrap = document.createElement("div");
  poolWrap.className = "skill-pool skill-pool--list";
  SKILL_POOL.forEach((s) => {
    const el = document.createElement("div");
    el.className = "skill-pool-item";
    el.dataset.skillId = s.id;
    // More informative list item: icon, name, short
    el.innerHTML = `<div class="skill-icon">${getSkillIcon(s.short)}</div>
                    <div class="skill-text">
                      <div class="skill-name">${s.name}</div>
                      <div class="skill-short">${s.short || ""}</div>
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
  const assignLabel = document.createElement("div");
  assignLabel.className = "assign-label";
  const assignBtns = document.createElement("div");
  assignBtns.className = "assign-btns";
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
      });
    } catch (_) {}
    assignBar.classList.remove("active");
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

  // Build Skillbook panel content (list + details + preview)
  (function buildSkillbookPanel() {
    const wrap = document.createElement("div");
    wrap.className = "skillbook";

    const list = document.createElement("div");
    list.className = "skillbook-list";
    const ul = document.createElement("div");
    ul.className = "skillbook-ul";
    list.appendChild(ul);

    const detail = document.createElement("div");
    detail.className = "skillbook-detail";
    const title = document.createElement("h3");
    const icon = document.createElement("div");
    icon.className = "sb-icon";
    const expl = document.createElement("div");
    expl.className = "sb-expl";
    const stats = document.createElement("div");
    stats.className = "sb-stats";
    const imgBox = document.createElement("div");
    imgBox.className = "sb-imgBox";
    const previewBtn = document.createElement("button");
    previewBtn.className = "pill-btn pill-btn--yellow sb-preview";
    previewBtn.textContent = "▶️";

    detail.appendChild(title);
    detail.appendChild(expl);
    detail.appendChild(icon);
    detail.appendChild(stats);
    detail.appendChild(imgBox);
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

  // Panels are static in index.html

  // Tabs are bound via static markup .tab-bar in index.html

  try {
    window.applyTranslations && window.applyTranslations(document.getElementById("heroScreen"));
  } catch (_) {}
}
