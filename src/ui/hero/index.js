/* Hero Screen UI (Skills/Info/Skillbook/Maps/Marks)
   Extracted from main.js into a reusable module.
   Usage:
     import { renderHeroScreen } from "./ui/hero/index.js";
     renderHeroScreen("skills", { ...ctx });
*/
import { SCALING } from "../../constants.js";
import { renderSkillsTab } from "./tabs/skills.js";
import { renderInfoTab } from "./tabs/info.js";
import { renderBookTab } from "./tabs/book.js";
import { renderMapsTab } from "./tabs/maps.js";
import { renderMarksTab } from "./tabs/marks.js";


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

  try { renderInfoTab(infoPanel, ctx); } catch (_) {}

  try { renderSkillsTab(skillsPanel, ctx, (tab) => renderHeroScreen(tab, ctx)); } catch (_) {}

  try { renderBookTab(bookPanel, ctx); } catch (_) {}

  try { renderMapsTab(mapsPanel, ctx); } catch (_) {}

  try { renderMarksTab(marksPanel, ctx); } catch (_) {}

  // Panels are static in index.html

  // Tabs are bound via static markup .tab-bar in index.html

  try {
    window.applyTranslations && window.applyTranslations(document.getElementById("heroScreen"));
  } catch (_) {}
}
