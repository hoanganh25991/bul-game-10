// Zeus RPG — Modular Orchestrator
// This refactor splits the original monolithic file into modules per system.
// Behavior is preserved; tuning values unchanged.

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { DEBUG } from "./config.js";
import { COLOR, WORLD, SKILLS, VILLAGE_POS, REST_RADIUS, SCALING } from "./constants.js";
import { initWorld, updateCamera, updateGridFollow, updateEnvironmentFollow, addResizeHandler, getTargetPixelRatio } from "./world.js";
import { UIManager } from "./ui.js";
import { Player, Enemy, getNearestEnemy, handWorldPos } from "./entities.js";
import { EffectsManager, createGroundRing } from "./effects.js";
import { SkillsSystem } from "./skills.js";
import { createRaycast } from "./raycast.js";
import { createHouse, createHeroOverheadBars } from "./meshes.js";
import { initEnvironment } from "./environment.js";
import { distance2D, dir2D, now, clamp01 } from "./utils.js";
import { initPortals } from "./portals.js";
import { initI18n, setLanguage, getLanguage, t } from "./i18n.js";
import { initSplash } from "./splash.js";
import { initTouchControls } from "./touch.js";
import { createInputService } from "./input/input_service.js";
import { SKILL_POOL, DEFAULT_LOADOUT } from "./skills_pool.js";
import { loadOrDefault, saveLoadout, resolveLoadout } from "./loadout.js";
import { audio } from "./audio.js";
import { createVillagesSystem } from "./villages.js";
import { createMapManager } from "./maps.js";
import { initHeroPreview } from "./hero_preview.js";

/**
 * Minimal skill icon helper: returns a small emoji/SVG placeholder for a skill short name.
 * Keeps UI lightweight and avoids new asset dependencies.
 */
function getSkillIcon(short) {
  if (!short) return "—";
  const k = String(short).slice(0, 3).toLowerCase();
  const map = {
    chn: "⚡", // chain
    bol: "⚡", // bolt/chain-ish
    stc: "🔌", // static
    str: "⛈️", // storm
    bam: "🔋",
    nov: "✴️",
    aoe: "💥",
    "n/a": "⚡"
  };
  return map[k] || "⚡";
}

// ------------------------------------------------------------
// Bootstrapping world, UI, effects
// ------------------------------------------------------------
const { renderer, scene, camera, ground, cameraOffset, cameraShake } = initWorld();
const _baseCameraOffset = cameraOffset.clone();
const ui = new UIManager();
const effects = new EffectsManager(scene);
const mapManager = createMapManager();

// Load environment preferences from localStorage (persist rain + density)
const _envPrefs = JSON.parse(localStorage.getItem("envPrefs") || "{}");
let envRainState = !!_envPrefs.rain;
let envDensityIndex = Number.isFinite(parseInt(_envPrefs.density, 10)) ? parseInt(_envPrefs.density, 10) : 1;
let envRainLevel = Number.isFinite(parseInt(_envPrefs.rainLevel, 10)) ? parseInt(_envPrefs.rainLevel, 10) : 1;

// Presets used by the density slider (kept in sync with index 0..2)
const ENV_PRESETS = [
  { treeCount: 20, rockCount: 10, flowerCount: 60, villageCount: 1 },
  { treeCount: 60, rockCount: 30, flowerCount: 120, villageCount: 1 },
  { treeCount: 140, rockCount: 80, flowerCount: 300, villageCount: 2 },
];

envDensityIndex = Math.min(Math.max(0, envDensityIndex), ENV_PRESETS.length - 1);
let env = initEnvironment(scene, Object.assign({}, ENV_PRESETS[envDensityIndex], { enableRain: envRainState }));
try {
  if (envRainState && env && typeof env.setRainLevel === "function") {
    env.setRainLevel(Math.min(Math.max(0, envRainLevel), 2));
  }
} catch (_) {}

/* Initialize splash first (shows full-screen loader), then i18n */
initSplash();
 // Initialize i18n (default Vietnamese)
initI18n();

 /* Audio: preferences + initialize on first user gesture. Do not auto-start music if disabled. */
const _audioPrefs = JSON.parse(localStorage.getItem("audioPrefs") || "{}");
let musicEnabled = _audioPrefs.music !== false; // default true
let sfxEnabled = _audioPrefs.sfx !== false;     // default true

// Render quality preference (persisted). Default to "high".
const _renderPrefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
let renderQuality = (typeof _renderPrefs.quality === "string" && ["low", "medium", "high"].includes(_renderPrefs.quality))
  ? _renderPrefs.quality
  : "high";

audio.startOnFirstUserGesture(document);
/* Apply SFX volume per preference (default 0.5 when enabled) */
try { audio.setSfxVolume(sfxEnabled ? 0.5 : 0.0); } catch (_) {}

const __startMusicOnce = (ev) => {
  if (!musicEnabled) return;
  try {
    // FreePD CC0: "Ice and Snow" — soft, atmospheric, focus-friendly
    audio.startStreamMusic("audio/Ice and Snow.mp3", { volume: 0.35, loop: true });
  } catch (e) {
    // Fallback to generative if streaming fails
    try { audio.setMusicVolume(0.35); audio.startMusic(); } catch (_) {}
  } finally {
    try {
      document.removeEventListener("click", __startMusicOnce, true);
      document.removeEventListener("touchstart", __startMusicOnce, true);
      document.removeEventListener("keydown", __startMusicOnce, true);
    } catch (_) {}
  }
};
/* Only attach auto-start listeners when music is enabled */
if (musicEnabled) {
  document.addEventListener("click", __startMusicOnce, true);
  document.addEventListener("touchstart", __startMusicOnce, true);
  document.addEventListener("keydown", __startMusicOnce, true);
}

// Settings and overlay elements
const btnSettingsScreen = document.getElementById("btnSettingsScreen");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const settingsPanel = document.getElementById("settingsPanel");
const btnHeroScreen = document.getElementById("btnHeroScreen");
const btnCloseHero = document.getElementById("btnCloseHero");
const btnCloseHeroIcon = document.getElementById("btnCloseHeroIcon");
const heroScreen = document.getElementById("heroScreen");
const introScreen = document.getElementById("introScreen");
const btnStart = document.getElementById("btnStart");
const btnCamera = document.getElementById("btnCamera");
const btnPortal = document.getElementById("btnPortal");
const btnMark = document.getElementById("btnMark");
const langVi = document.getElementById("langVi");
const langEn = document.getElementById("langEn");
let firstPerson = false;
// preserve original camera defaults
const _defaultCameraNear = camera.near || 0.1;
const _defaultCameraFov = camera.fov || 60;

/**
 * Toggle first-person mode and adjust camera projection to reduce clipping.
 * When enabled we use a tighter near plane and slightly wider FOV for a comfortable FPS feel.
 */
function setFirstPerson(enabled) {
  firstPerson = !!enabled;
  if (firstPerson) {
    camera.near = 0.01;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    // Hide torso/head/cloak parts so arms remain visible in first-person
    try {
      if (typeof player !== "undefined" && player?.mesh?.userData?.fpHide) {
        player.mesh.userData.fpHide.forEach((o) => { if (o) o.visible = false; });
      }
      if (typeof heroBars !== "undefined" && heroBars?.container) {
        heroBars.container.visible = false;
      }
    } catch (e) {}
  } else {
    camera.near = _defaultCameraNear;
    camera.fov = _defaultCameraFov;
    camera.updateProjectionMatrix();
    // Restore visibility
    try {
      if (typeof player !== "undefined" && player?.mesh?.userData?.fpHide) {
        player.mesh.userData.fpHide.forEach((o) => { if (o) o.visible = true; });
      }
      if (typeof heroBars !== "undefined" && heroBars?.container) {
        heroBars.container.visible = true;
      }
    } catch (e) {}
  }
}

 // Settings handlers
 btnSettingsScreen?.addEventListener("click", () => {
   try {
     ensureSettingsTabs();
     ensureGuideButton();
   } catch(e) {}
   settingsPanel?.classList.toggle("hidden");
 });
 btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));

 // Hero open/close
 btnHeroScreen?.addEventListener("click", () => { renderHeroScreen("skills"); heroScreen?.classList.remove("hidden"); });
 btnCloseHero?.addEventListener("click", () => { heroScreen?.classList.add("hidden"); });
 btnCloseHeroIcon?.addEventListener("click", () => { heroScreen?.classList.add("hidden"); });

 // Generic top-right screen-close icons (ensure any element with .screen-close closes its parent .screen)
 document.querySelectorAll(".screen-close").forEach((b) => {
   b.addEventListener("click", (e) => {
     const sc = e.currentTarget.closest(".screen");
     if (sc) sc.classList.add("hidden");
   });
 });

 // intro may be absent (we removed it), keep safe guard
 btnStart?.addEventListener("click", () => { introScreen?.classList.add("hidden"); });
// use the setter so projection updates correctly
btnCamera?.addEventListener("click", () => { setFirstPerson(!firstPerson); });
// Portal button: recall to nearest portal (same as pressing 'B')
btnPortal?.addEventListener("click", () => {
  try { portals.recallToVillage(player, setCenterMsg); } catch (e) {}
});
// Place persistent Mark/Flag (3-minute cooldown)
btnMark?.addEventListener("click", () => {
  try {
    const remain = portals.getMarkCooldownMs?.() ?? 0;
    if (remain > 0) {
      const s = Math.ceil(remain / 1000);
      setCenterMsg(`Mark ready in ${s}s`);
      setTimeout(() => clearCenterMsg(), 1200);
      return;
    }
    const m = portals.addPersistentMarkAt?.(player.pos());
    if (m) {
      setCenterMsg("Flag placed");
      setTimeout(() => clearCenterMsg(), 1100);
    }
  } catch (_) {}
});

function updateFlagActive() {
  try {
    const lang = (typeof getLanguage === "function" ? getLanguage() : "vi");
    const on = (el, isActive) => {
      if (!el) return;
      // Keep class for any theme CSS that may target it
      try { el.classList.toggle("active", !!isActive); } catch (_) {}
      // Inline highlight to match checkbox (thunder yellow) so it's always visible
      if (isActive) {
        el.style.background = "linear-gradient(180deg, #ffe98a, #ffd94a)";
        el.style.color = "var(--theme-dark-blue)";
        el.style.borderColor = "rgba(255,217,74,0.6)";
        el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35), 0 0 10px rgba(255,217,74,0.28)";
      } else {
        el.style.background = "rgba(10,25,48,0.6)";
        el.style.color = "#fff";
        el.style.borderColor = "rgba(124,196,255,0.35)";
        el.style.boxShadow = "0 6px 14px rgba(0,0,0,0.35)";
      }
    };
    on(langVi, lang === "vi");
    on(langEn, lang === "en");
  } catch (_) {}
}
langVi?.addEventListener("click", () => { setLanguage("vi"); updateFlagActive(); });
langEn?.addEventListener("click", () => { setLanguage("en"); updateFlagActive(); });
try { updateFlagActive(); } catch (_) {}

// Environment controls (Settings panel)
// - #envRainToggle : checkbox to enable rain
// - #envDensity : range [0..2] for sparse / default / dense world
const envRainToggle = document.getElementById("envRainToggle");
const envDensity = document.getElementById("envDensity");
// Initialize controls from stored prefs
if (envRainToggle) {
  envRainToggle.checked = !!envRainState;
  envRainToggle.addEventListener("change", (ev) => {
    envRainState = !!ev.target.checked;
    if (env && typeof env.toggleRain === "function") env.toggleRain(envRainState);
    if (envRainState && env && typeof env.setRainLevel === "function") {
      try { env.setRainLevel(Math.min(Math.max(0, envRainLevel), 2)); } catch (_) {}
    }
    // persist
    try { localStorage.setItem("envPrefs", JSON.stringify({ rain: envRainState, density: envDensityIndex, rainLevel: envRainLevel })); } catch (_) {}
  });
}
if (envDensity) {
  // set initial slider value (clamped)
  envDensity.value = Math.min(Math.max(0, envDensityIndex), ENV_PRESETS.length - 1);
  const onEnvDensityChange = (ev) => {
    const v = parseInt(ev.target.value, 10) || 1;
    envDensityIndex = Math.min(Math.max(0, v), ENV_PRESETS.length - 1);
    const preset = ENV_PRESETS[envDensityIndex];
    // Recreate environment with new density while preserving rain state and rain level
    try { if (env && env.root && env.root.parent) env.root.parent.remove(env.root); } catch (e) {}
    env = initEnvironment(scene, Object.assign({}, preset, { enableRain: envRainState }));
    try {
      if (envRainState && env && typeof env.setRainLevel === "function") {
        env.setRainLevel(Math.min(Math.max(0, envRainLevel), 2));
      }
      updateEnvironmentFollow(env, player);
    } catch (e) {}
    // persist
    try { localStorage.setItem("envPrefs", JSON.stringify({ rain: envRainState, density: envDensityIndex, rainLevel: envRainLevel })); } catch (_) {}
  };
  envDensity.addEventListener("input", onEnvDensityChange);
  envDensity.addEventListener("change", onEnvDensityChange);
}

/* Rain density slider (0=low,1=medium,2=high) */
const rainDensity = document.getElementById("rainDensity");
if (rainDensity) {
  try {
    rainDensity.value = Math.min(Math.max(0, Number.isFinite(parseInt(_envPrefs.rainLevel, 10)) ? parseInt(_envPrefs.rainLevel, 10) : 1), 2);
  } catch (_) {}
  const onRainDensityChange = (ev) => {
    const v = parseInt(ev.target.value, 10);
    const lvl = Math.min(Math.max(0, Number.isFinite(v) ? v : 1), 2);
    envRainLevel = lvl;
    try { env && typeof env.setRainLevel === "function" && env.setRainLevel(lvl); } catch (_) {}
    try { localStorage.setItem("envPrefs", JSON.stringify({ rain: envRainState, density: envDensityIndex, rainLevel: envRainLevel })); } catch (_) {}
  };
  rainDensity.addEventListener("input", onRainDensityChange);
  rainDensity.addEventListener("change", onRainDensityChange);
}

/* Render quality: native select (low/medium/high) */
function initQualitySelect() {
  const sel = document.getElementById("qualitySelect");
  if (!sel) return;

  // Initialize from persisted prefs or current variable
  let q = renderQuality;
  try {
    const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
    if (prefs && typeof prefs.quality === "string") q = prefs.quality;
  } catch (_) {}

  // Fallback to high if unexpected
  if (q !== "low" && q !== "medium" && q !== "high") q = "high";
  try { sel.value = q; } catch (_) {}

  // Bind once
  if (!sel.dataset.bound) {
    sel.addEventListener("change", () => {
      const v = String(sel.value || "high").toLowerCase();
      const valid = v === "low" || v === "medium" || v === "high";
      const nextQ = valid ? v : "high";
      // persist (preserve other fields like zoom)
      try {
        const prev = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
        prev.quality = nextQ;
        localStorage.setItem("renderPrefs", JSON.stringify(prev));
      } catch (_) {}
      // keep local variable consistent
      renderQuality = nextQ;
      // Apply immediately
      try {
        renderer.setPixelRatio(getTargetPixelRatio());
        renderer.setSize(window.innerWidth, window.innerHeight);
      } catch (_) {}
    });
    sel.dataset.bound = "1";
  }
}
try { initQualitySelect(); } catch (_) {}
try { initZoomControl && initZoomControl(); } catch (_) {}

/* Render zoom: range slider (0.6..1.6) */
function initZoomControl() {
  const sel = document.getElementById("zoomSlider");
  if (!sel) return;

  // Initialize from persisted prefs or default 1.0
  let z = 1;
  try {
    const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
    if (typeof prefs.zoom === "number") z = prefs.zoom;
  } catch (_) {}

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  z = clamp(Number.isFinite(parseFloat(z)) ? parseFloat(z) : 1, 0.6, 1.6);

  try { sel.value = String(z); } catch (_) {}

  // Apply immediately on init
  try {
    cameraOffset.copy(_baseCameraOffset.clone().multiplyScalar(z));
  } catch (_) {}

  // Bind once
  if (!sel.dataset.bound) {
    const onChange = () => {
      const v = clamp(parseFloat(sel.value), 0.6, 1.6) || 1;
      try {
        cameraOffset.copy(_baseCameraOffset.clone().multiplyScalar(v));
      } catch (_) {}
      try {
        const prev = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
        prev.zoom = v;
        localStorage.setItem("renderPrefs", JSON.stringify(prev));
      } catch (_) {}
    };
    sel.addEventListener("input", onChange);
    sel.addEventListener("change", onChange);
    sel.dataset.bound = "1";
  }
}

/* Settings: Audio toggles (Music / SFX) */
const musicToggle = document.getElementById("musicToggle");
const sfxToggle = document.getElementById("sfxToggle");
if (musicToggle) {
  musicToggle.checked = !!musicEnabled;
  musicToggle.addEventListener("change", () => {
    musicEnabled = !!musicToggle.checked;
    try { localStorage.setItem("audioPrefs", JSON.stringify({ music: musicEnabled, sfx: sfxEnabled })); } catch (_) {}
    if (musicEnabled) {
      // Start background music immediately
      try {
        audio.startStreamMusic("audio/Ice and Snow.mp3", { volume: 0.35, loop: true });
      } catch (e) {
        try { audio.setMusicVolume(0.35); audio.startMusic(); } catch (_) {}
      }
    } else {
      // Stop any music
      try { audio.stopStreamMusic(); } catch (_) {}
      try { audio.stopMusic(); } catch (_) {}
      try { audio.setMusicVolume(0); } catch (_) {}
    }
  });
}
if (sfxToggle) {
  sfxToggle.checked = !!sfxEnabled;
  sfxToggle.addEventListener("change", () => {
    sfxEnabled = !!sfxToggle.checked;
    try { audio.setSfxVolume(sfxEnabled ? 0.5 : 0.0); } catch (_) {}
    try { localStorage.setItem("audioPrefs", JSON.stringify({ music: musicEnabled, sfx: sfxEnabled })); } catch (_) {}
  });
}

 // Setup Settings tabs (General / Environment / Controls)
function ensureSettingsTabs(){
  if (!settingsPanel || settingsPanel.dataset.tabsReady === "1") return;
  const content = settingsPanel.querySelector(".panel-content");
  if (!content) return;

  // Collect existing rows
  const rows = Array.from(content.querySelectorAll(".row"));
  const generalPanel = document.createElement("div");
  generalPanel.className = "tab-panel active";
  const envPanel = document.createElement("div");
  envPanel.className = "tab-panel";
  const controlsPanel = document.createElement("div");
  controlsPanel.className = "tab-panel";

  // Move rows by detecting known elements
  rows.forEach((row) => {
    if (row.querySelector("#langVi") || row.querySelector("#settingsInstructions")) {
      generalPanel.appendChild(row);
    } else if (row.querySelector("#envRainToggle") || row.querySelector("#envDensity") || row.querySelector("#rainDensity") || row.querySelector("#zoomSlider")) {
      envPanel.appendChild(row);
    } else {
      generalPanel.appendChild(row);
    }
  });

  if (!controlsPanel.innerHTML) {
    const r = document.createElement("div");
    r.className = "row";
    const lbl = document.createElement("span");
    lbl.className = "row-label";
    lbl.setAttribute("data-i18n", "settings.tabs.controls");
    const val = document.createElement("div");
    val.style.fontSize = "12px";
    val.style.opacity = "0.75";
    val.textContent = "—";
    r.appendChild(lbl);
    r.appendChild(val);
    controlsPanel.appendChild(r);
  }

  // Initialize panel visibility
  generalPanel.style.display = "block";
  envPanel.style.display = "none";
  controlsPanel.style.display = "none";

  // Tab buttons
  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";
  const tabs = [
    { key: "general", labelKey: "settings.tabs.general", panel: generalPanel },
    { key: "environment", labelKey: "settings.tabs.environment", panel: envPanel },
    { key: "controls", labelKey: "settings.tabs.controls", panel: controlsPanel },
  ];
  // IMPORTANT: avoid shadowing the i18n function t by renaming the loop variable
  tabs.forEach((tabDef, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (idx === 0 ? " active" : "");
    btn.setAttribute("data-i18n", tabDef.labelKey);
    // Render translated label immediately; data-i18n keeps it updated when language changes
    try { btn.textContent = t(tabDef.labelKey); } catch(_) { btn.textContent = tabDef.labelKey; }
    btn.addEventListener("click", () => {
      tabBar.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      [generalPanel, envPanel, controlsPanel].forEach((p) => {
        p.classList.remove("active");
        p.style.display = "none";
      });
      tabDef.panel.classList.add("active");
      tabDef.panel.style.display = "block";
    });
    tabBar.appendChild(btn);
  });

  // Rebuild content
  content.innerHTML = "";
  content.appendChild(tabBar);
  content.appendChild(generalPanel);
  content.appendChild(envPanel);
  content.appendChild(controlsPanel);
  settingsPanel.dataset.tabsReady = "1";

  // Insert Instruction Guide button into the Instructions row
  try {
    const instrRow = generalPanel.querySelector("#settingsInstructions");
    if (instrRow && !instrRow.querySelector("#btnInstructionGuide")) {
      const btn = document.createElement("button");
      btn.id = "btnInstructionGuide";
      btn.className = "primary";
      btn.title = "Show guide";
      btn.innerHTML = "👋 Guide";
      btn.addEventListener("click", () => {
        try { startInstructionGuide(); } catch (_) {}
      });
      instrRow.appendChild(btn);
    }
  } catch (_) {}

  // Re-init quality/zoom controls after rebuilding tabs (safe if called multiple times)
  try { initQualitySelect && initQualitySelect(); } catch (e) {}
  try { initZoomControl && initZoomControl(); } catch (e) {}
  try { window.applyTranslations && window.applyTranslations(settingsPanel); } catch (e) {}
}

function ensureGuideButton() {
  try {
    const root = settingsPanel;
    if (!root) return;
    const instrRow = root.querySelector("#settingsInstructions");
    if (!instrRow) return;
    if (!instrRow.querySelector("#btnInstructionGuide")) {
      const btn = document.createElement("button");
      btn.id = "btnInstructionGuide";
      btn.className = "primary";
      btn.title = "Show guide";
      btn.innerHTML = "👋 Guide";
      btn.addEventListener("click", () => {
        try { startInstructionGuide(); } catch (_) {}
      });
      instrRow.appendChild(btn);
    }
  } catch (_) {}
}
// Build once on load (in case user opens immediately)
// Build once on load (in case user opens immediately)
try { ensureSettingsTabs(); ensureGuideButton(); } catch(e) {}

// Selection/aim indicators
/* Load and apply saved loadout so runtime SKILLS.Q/W/E/R reflect player's choice */
let currentLoadout = loadOrDefault(SKILL_POOL, DEFAULT_LOADOUT);

/**
 * Apply an array of 4 skill ids to the SKILLS mapping (mutates exported SKILLS).
 */
function applyLoadoutToSKILLS(loadoutIds) {
  const idMap = new Map(SKILL_POOL.map((s) => [s.id, s]));
  const keys = ["Q", "W", "E", "R"];
  for (let i = 0; i < 4; i++) {
    const id = loadoutIds[i];
    const def = idMap.get(id);
    if (def) {
      // shallow copy to avoid accidental shared references
      SKILLS[keys[i]] = Object.assign({}, def);
    }
  }
}

/**
 * Update the skillbar labels to reflect the active SKILLS mapping.
 */
function updateSkillBarLabels() {
    try {
    const map = { Q: "#btnSkillQ", W: "#btnSkillW", E: "#btnSkillE", R: "#btnSkillR" };
    for (const k of Object.keys(map)) {
      const el = document.querySelector(map[k]);
      if (!el) continue;
      const def = SKILLS[k] || {};
      // icon (emoji/SVG placeholder)
      const iconEl = el.querySelector(".icon");
      if (iconEl) iconEl.textContent = getSkillIcon(def.short || def.name);
      // name / short label
      const nameEl = el.querySelector(".name");
      if (nameEl) nameEl.textContent = def.short || def.name || nameEl.textContent;
      const keyEl = el.querySelector(".key");
      if (keyEl) keyEl.textContent = k;
      // accessibility: set button title to skill name if available
      if (def.name) el.title = def.name;
    }

    // Update central basic button icon (larger visual)
    try {
      const basicBtn = document.getElementById("btnBasic");
      if (basicBtn) {
        const icon = basicBtn.querySelector(".icon");
        if (icon) icon.textContent = getSkillIcon("atk");
        basicBtn.title = basicBtn.title || "Basic Attack";
      }
    } catch (e) {
      // ignore
    }

  } catch (err) {
    console.warn("updateSkillBarLabels error", err);
  }
}

/**
 * Persist and apply a new loadout.
 */
function setLoadoutAndSave(ids) {
  const resolved = resolveLoadout(SKILL_POOL, ids, DEFAULT_LOADOUT);
  currentLoadout = resolved;
  applyLoadoutToSKILLS(currentLoadout);
  saveLoadout(currentLoadout);
  updateSkillBarLabels();
try {
  console.info("[WORLD]", {
    attackRange: WORLD.attackRange,
    attackRangeMult: WORLD.attackRangeMult,
    basicAttackCooldown: WORLD.basicAttackCooldown,
    basicAttackDamage: WORLD.basicAttackDamage
  });
} catch (e) {}
}

/**
 * Render the hero screen skill picker UI into #heroSkillsList
 * - shows hero info, current 4-slot loadout, and the full skill pool
 * - click a slot to select it, then click a skill to assign; or click Assign on a skill
 */
/* Hero Screen */
function renderHeroScreen(initialTab = "skills") {
  // Ensure tab structure on right side
  const layout = document.querySelector("#heroScreen .hero-layout");
  const listContainer = document.getElementById("heroSkillsList");
  if (!layout || !listContainer) return;
  layout.innerHTML = "";

  const title = document.createElement("h2");
  title.setAttribute("data-i18n", "hero.title");
  title.textContent = t("hero.title");
  layout.appendChild(title);

  // Tab bar (Skills / Info / Skillbook / Maps / Marks)
  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";
  const skillsBtn = document.createElement("button");
  skillsBtn.className = "tab-btn" + ((initialTab !== "info" && initialTab !== "book" && initialTab !== "maps" && initialTab !== "marks") ? " active" : "");
  skillsBtn.setAttribute("data-i18n", "hero.tabs.skills");
  skillsBtn.textContent = t("hero.tabs.skills") || "Skills";
  const infoBtn = document.createElement("button");
  infoBtn.className = "tab-btn" + (initialTab === "info" ? " active" : "");
  infoBtn.setAttribute("data-i18n", "hero.tabs.info");
  infoBtn.textContent = t("hero.tabs.info") || "Info";
  const bookBtn = document.createElement("button");
  bookBtn.className = "tab-btn" + (initialTab === "book" ? " active" : "");
  bookBtn.setAttribute("data-i18n", "hero.tabs.skillbook");
  bookBtn.textContent = t("hero.tabs.skillbook") || "Skillbook";
  const mapsBtn = document.createElement("button");
  mapsBtn.className = "tab-btn" + (initialTab === "maps" ? " active" : "");
  mapsBtn.setAttribute("data-i18n", "hero.tabs.maps");
  mapsBtn.textContent = t("hero.tabs.maps") || "Maps";
  const marksBtn = document.createElement("button");
  marksBtn.className = "tab-btn" + (initialTab === "marks" ? " active" : "");
  marksBtn.setAttribute("data-i18n", "hero.tabs.marks");
  marksBtn.textContent = t("hero.tabs.marks") || "Marks";
  tabBar.appendChild(skillsBtn);
  tabBar.appendChild(infoBtn);
  tabBar.appendChild(bookBtn);
  tabBar.appendChild(mapsBtn);
  tabBar.appendChild(marksBtn);
  layout.appendChild(tabBar);

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
  info.innerHTML = `<div>${t("hero.info.level")}: ${player.level || 1}</div><div>${t("hero.info.hp")}: ${Math.floor(player.hp)}/${player.maxHP}</div><div>${t("hero.info.mp")}: ${Math.floor(player.mp)}/${player.maxMP}</div>`;
  infoPanel.appendChild(info);

  // Skills content (reuse existing builder inside a wrapper)
  const container = document.createElement("div");
  container.id = "heroSkillsList";
  skillsPanel.appendChild(container);

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
                      <div class="slot-name">${skillDef ? skillDef.name : t("hero.slot.empty")}</div>
                      <button class="slot-clear">${t("hero.slot.clear")}</button>`;
    slotsWrap.appendChild(slot);
  }
  container.appendChild(slotsWrap);

  const poolHeader = document.createElement("div");
  poolHeader.className = "skill-pool-header";
  poolHeader.textContent = t("hero.pool");
  container.appendChild(poolHeader);

  const poolWrap = document.createElement("div");
  poolWrap.className = "skill-pool";
  SKILL_POOL.forEach((s) => {
    const el = document.createElement("div");
    el.className = "skill-pool-item";
    el.dataset.skillId = s.id;
    el.innerHTML = `<div class="skill-icon">${getSkillIcon(s.short)}</div><div class="skill-name">${s.name}</div><button class="assign">${t("hero.assign")}</button>`;
    poolWrap.appendChild(el);
  });
  container.appendChild(poolWrap);

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const resetBtn = document.createElement("button");
  resetBtn.textContent = t("hero.slot.reset");
  resetBtn.addEventListener("click", () => {
    currentLoadout = DEFAULT_LOADOUT.slice();
    setLoadoutAndSave(currentLoadout);
    renderHeroScreen("skills");
  });
  actions.appendChild(resetBtn);
  container.appendChild(actions);

  // Interaction handling
  let selectedSlotIndex = null;
  slotsWrap.querySelectorAll(".loadout-slot").forEach((slotEl) => {
    slotEl.addEventListener("click", () => {
      slotsWrap.querySelectorAll(".loadout-slot").forEach((s) => s.classList.remove("selected"));
      slotEl.classList.add("selected");
      selectedSlotIndex = parseInt(slotEl.dataset.slotIndex, 10);
    });
    const clearBtn = slotEl.querySelector(".slot-clear");
    clearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      currentLoadout[parseInt(slotEl.dataset.slotIndex, 10)] = null;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen("skills");
    });
  });
  poolWrap.querySelectorAll(".skill-pool-item").forEach((itemEl) => {
    const skillId = itemEl.dataset.skillId;
    itemEl.addEventListener("click", () => {
      const slotToAssign = selectedSlotIndex !== null ? selectedSlotIndex : 0;
      currentLoadout[slotToAssign] = skillId;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen("skills");
    });
    const btn = itemEl.querySelector(".assign");
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const slotToAssign = selectedSlotIndex !== null ? selectedSlotIndex : 0;
      currentLoadout[slotToAssign] = skillId;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen("skills");
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
    const stats = document.createElement("div");
    stats.style.fontSize = "12px";
    stats.style.opacity = "0.9";
    stats.style.lineHeight = "1.6";
    const expl = document.createElement("div");
    expl.style.marginTop = "6px";
    const imgBox = document.createElement("div");
    imgBox.style.marginTop = "8px";
    const previewBtn = document.createElement("button");
    previewBtn.textContent = "Preview";
    previewBtn.style.marginTop = "10px";

    detail.appendChild(title);
    detail.appendChild(icon);
    detail.appendChild(stats);
    detail.appendChild(expl);
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
      clone: "Summons a lightning image that periodically zaps nearby foes."
    };

    function getSkillIcon(short) {
      if (!short) return "⚡";
      const k = String(short).slice(0, 3).toLowerCase();
      const map = { chn: "⚡", bol: "⚡", stc: "🔌", str: "⛈️", bam: "🔋", nov: "✴️", aoe: "💥" };
      return map[k] || "⚡";
    }

    function computeDamage(s) {
      const base = s.dmg || 0;
      const lvl = Math.max(1, (player && player.level) || 1);
      const mult = Math.pow(SCALING.hero.skillDamageGrowth, Math.max(0, lvl - 1));
      return Math.floor(base * mult);
    }

    function renderDetail(s) {
      title.textContent = `${s.name} (${s.short || ""})`;
      icon.textContent = getSkillIcon(s.short || s.name);
      const dmgLine = (typeof s.dmg === "number") ? `Damage: ${computeDamage(s)} (base ${s.dmg})` : "";
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
        dmgLine
      ].filter(Boolean);
      stats.innerHTML = lines.map((x) => `<div>${x}</div>`).join("");
      expl.textContent = typeExplain[s.type] || "No description.";
      // Optional image placeholder
      imgBox.innerHTML = "";
      const ph = document.createElement("div");
      ph.style.fontSize = "40px";
      ph.style.opacity = "0.9";
      ph.textContent = getSkillIcon(s.short || s.name);
      imgBox.appendChild(ph);
      previewBtn.onclick = () => {
        try { window.__skillsRef && window.__skillsRef.previewSkill(s); } catch (_) {}
      };
    }

    // Populate list
    SKILL_POOL.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "skillbook-item";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.gap = "8px";
      const ic = document.createElement("span");
      ic.textContent = getSkillIcon(s.short || s.name);
      const nm = document.createElement("span");
      nm.textContent = s.name;
      btn.appendChild(ic);
      btn.appendChild(nm);
      btn.addEventListener("click", () => renderDetail(s));
      ul.appendChild(btn);
    });

    // Default select first
    try { if (SKILL_POOL.length) renderDetail(SKILL_POOL[0]); } catch (_) {}

    wrap.appendChild(list);
    wrap.appendChild(detail);
    bookPanel.appendChild(wrap);
  })();

/* ------------------------------------------------------------
   Guided Instruction Overlay (focus ring + hand + tooltip)
------------------------------------------------------------ */
let __guideState = null;

function startInstructionGuide() {
  if (__guideState && __guideState.active) return;

  const steps = [
    {
      key: "camera",
      get el() { return document.getElementById("btnCamera"); },
      title: "Camera Toggle",
      desc: "Tap to toggle first-person camera."
    },
    {
      key: "settings",
      get el() { return document.getElementById("btnSettingsScreen"); },
      title: "Settings",
      desc: "Open and adjust game options, environment, and audio."
    },
    {
      key: "hero",
      get el() { return document.getElementById("btnHeroScreen"); },
      title: "Hero Screen",
      desc: "View hero info and configure skills and loadout."
    },
    {
      key: "skills",
      get el() { return document.getElementById("skillWheel") || document.getElementById("btnBasic"); },
      title: "Skills",
      desc: "Tap Basic or Q/W/E/R to use skills. Cooldown shows in the ring."
    },
  ].filter(s => !!s.el);

  if (!steps.length) return;

  const overlay = document.createElement("div");
  overlay.className = "guide-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  // Force overlay to top-most layer above WebGL canvas on all platforms
  try {
    overlay.id = "guideOverlayRoot";
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.zIndex = "2147483647"; // higher than any in-app UI
    overlay.style.pointerEvents = "none"; // children manage interaction
  } catch (_) {}

  const blocker = document.createElement("div");
  blocker.className = "guide-blocker";
  overlay.appendChild(blocker);

  const focus = document.createElement("div");
  focus.className = "guide-focus";
  overlay.appendChild(focus);

  const hand = document.createElement("div");
  hand.className = "guide-hand";
  hand.textContent = "👉";
  overlay.appendChild(hand);

  const tip = document.createElement("div");
  tip.className = "guide-tooltip";
  const tipHeader = document.createElement("div");
  tipHeader.className = "guide-tooltip-header";
  const tipTitle = document.createElement("div");
  tipTitle.className = "guide-tooltip-title";
  const tipClose = document.createElement("button");
  tipClose.className = "guide-close";
  tipClose.setAttribute("aria-label", "Close guide");
  tipClose.textContent = "✕";
  tipHeader.appendChild(tipTitle);
  tipHeader.appendChild(tipClose);
  const tipBody = document.createElement("div");
  tipBody.className = "guide-tooltip-body";
  const tipNav = document.createElement("div");
  tipNav.className = "guide-nav";
  const btnPrev = document.createElement("button");
  btnPrev.className = "secondary";
  btnPrev.textContent = "Previous";
  const btnNext = document.createElement("button");
  btnNext.className = "primary";
  btnNext.textContent = "Next";
  tipNav.appendChild(btnPrev);
  tipNav.appendChild(btnNext);
  tip.appendChild(tipHeader);
  tip.appendChild(tipBody);
  tip.appendChild(tipNav);
  overlay.appendChild(tip);

  document.body.appendChild(overlay);

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function positionFor(el, pad = 10) {
    const r = el.getBoundingClientRect();
    const rect = {
      left: r.left - pad,
      top: r.top - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2
    };
    rect.right = rect.left + rect.width;
    rect.bottom = rect.top + rect.height;
    return rect;
  }

  function placeFocus(rect) {
    focus.style.left = rect.left + "px";
    focus.style.top = rect.top + "px";
    focus.style.width = rect.width + "px";
    focus.style.height = rect.height + "px";
  }

  function placeHand(rect) {
    const hx = rect.right - 8;
    const hy = rect.bottom + 6;
    hand.style.left = hx + "px";
    hand.style.top = hy + "px";
  }

  function placeTip(rect) {
    const margin = 8;
    let tx = rect.left;
    let ty = rect.bottom + margin;
    const vw = window.innerWidth, vh = window.innerHeight;
    tip.style.maxWidth = "320px";
    tip.style.visibility = "hidden";
    tip.style.left = "0px"; tip.style.top = "-9999px";
    tip.style.display = "block";
    const tb = tip.getBoundingClientRect();
    let tw = tb.width || 280;
    let th = tb.height || 120;

    // Prefer below; if not, try above.
    if (ty + th > vh - 12) {
      ty = rect.top - th - margin;
    }
    // Clamp horizontally
    tx = clamp(tx, 12, vw - tw - 12);
    // If still off-screen vertically, clamp
    ty = clamp(ty, 12, vh - th - 12);

    tip.style.left = tx + "px";
    tip.style.top = ty + "px";
    tip.style.visibility = "visible";
  }

  function setStep(idx) {
    __guideState.index = idx;
    const s = steps[idx];
    if (!s || !s.el) return;
    // Scroll into view if needed (for safety on small screens)
    try { s.el.scrollIntoView?.({ block: "nearest", inline: "nearest" }); } catch (_) {}
    const rect = positionFor(s.el, 10);
    placeFocus(rect);
    placeHand(rect);
    tipTitle.textContent = s.title || "";
    tipBody.textContent = s.desc || "";
    placeTip(rect);

    btnPrev.disabled = idx === 0;
    btnNext.textContent = (idx === steps.length - 1) ? "Done" : "Next";
  }

  function onNext() {
    if (__guideState.index >= steps.length - 1) {
      close();
      return;
    }
    setStep(__guideState.index + 1);
  }
  function onPrev() {
    if (__guideState.index <= 0) return;
    setStep(__guideState.index - 1);
  }
  function onResize() {
    const s = steps[__guideState.index];
    if (!s || !s.el) return;
    const rect = positionFor(s.el, 10);
    placeFocus(rect);
    placeHand(rect);
    placeTip(rect);
  }

  function close() {
    if (!__guideState || !__guideState.active) return;
    __guideState.active = false;
    btnPrev.removeEventListener("click", onPrev);
    btnNext.removeEventListener("click", onNext);
    tipClose.removeEventListener("click", close);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    try { overlay.remove(); } catch (_) {}
    __guideState = null;
  }

  btnPrev.addEventListener("click", onPrev);
  btnNext.addEventListener("click", onNext);
  tipClose.addEventListener("click", close);
  blocker.addEventListener("click", () => {}); // absorb clicks
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  __guideState = { active: true, index: 0, steps, overlay, focus, hand, tip };
  setStep(0);
  try { window.__guideClose = close; } catch (_) {}
}

// Fallback bindings to ensure the Guide button always triggers the overlay
try { window.startInstructionGuide = startInstructionGuide; } catch (_) {}
document.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t && t.id === "btnInstructionGuide") {
    try { startInstructionGuide(); } catch (_) {}
  }
});

  // Build Maps panel content (scrollable list + set active)
  (function buildMapsPanel() {
    const wrap = document.createElement("div");
    wrap.className = "maps-panel";
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";

    const title = document.createElement("h3");
    title.textContent = t("hero.tabs.maps") || "Maps";
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

          // Square image (left)
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

          // Info (name + desc + req + elites)
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

          // Action (right)
          const act = document.createElement("div");
          const btn = document.createElement("button");
          if (m.current) {
            btn.textContent = "Active";
            btn.disabled = true;
          } else if (!m.unlocked) {
            btn.textContent = "Locked";
            btn.disabled = true;
          } else {
            btn.textContent = "Set Active";
            btn.addEventListener("click", () => {
              try {
                if (mapManager.setCurrent?.(m.index)) {
                  enemies.forEach((en) => applyMapModifiersToEnemy(en));
                  setCenterMsg && setCenterMsg(`Switched to ${m.name}`);
                  setTimeout(() => clearCenterMsg(), 1100);
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
    titleMarks.textContent = t("hero.tabs.marks") || "Marks";
    const cd = document.createElement("span");
    cd.style.fontSize = "12px";
    cd.style.opacity = "0.8";
    head.appendChild(titleMarks);
    head.appendChild(cd);

    /* Marks list (separate table) */

    const list = document.createElement("div");
    list.style.display = "grid";
    list.style.gridTemplateColumns = "1fr auto auto auto";
    list.style.rowGap = "6px";
    list.style.columnGap = "8px";
    list.style.alignItems = "center";
    list.style.maxHeight = "240px";
    list.style.overflow = "auto";

    // Header
    const hName = document.createElement("div"); hName.style.fontWeight = "600"; hName.textContent = "Name / Position / Created";
    const hRN = document.createElement("div"); hRN.style.fontWeight = "600"; hRN.textContent = "✏️";
    const hTP = document.createElement("div"); hTP.style.fontWeight = "600"; hTP.textContent = "🌀";
    const hRM = document.createElement("div"); hRM.style.fontWeight = "600"; hRM.textContent = "❌";
    list.appendChild(hName); list.appendChild(hRN); list.appendChild(hTP); list.appendChild(hRM);

    function fmtTime(ts) {
      try {
        const d = new Date(ts);
        return d.toLocaleString();
      } catch (_) { return String(ts); }
    }
    function render() {
      list.innerHTML = "";
      try {
        const arr = portals.listPersistentMarks?.() || [];
        if (!arr.length) {
          // remove header if empty
          list.innerHTML = "";
          const empty = document.createElement("div");
          empty.style.opacity = "0.8";
          empty.style.fontSize = "12px";
          empty.textContent = "No marks yet. Use the 🚩 Mark button to place a flag.";
          list.appendChild(empty);
        } else {
          // keep header, append rows
          arr.forEach((m) => {
            const info = document.createElement("div");
            const nm = (m.name && String(m.name).trim()) ? m.name : `Mark ${m.index + 1}`;
            info.textContent = `${nm} • (${Math.round(m.x)}, ${Math.round(m.z)}) • ${fmtTime(m.createdAt)}`;

            const rn = document.createElement("button");
            rn.textContent = "Rename";
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
            tp.textContent = "Teleport";
            tp.addEventListener("click", () => {
              try { portals.teleportToMark?.(m.index, player); } catch (_) {}
            });

            const rm = document.createElement("button");
            rm.textContent = "Remove";
            rm.addEventListener("click", () => {
              try { portals.removePersistentMark?.(m.index); render(); } catch (_) {}
            });

            list.appendChild(info);
            list.appendChild(rn);
            list.appendChild(tp);
            list.appendChild(rm);
          });
        }
      } catch (e) {}
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

    try { clearInterval(window.__marksPanelTick); } catch (_) {}
    window.__marksPanelTick = setInterval(tickCooldown, 500);
    tickCooldown();
    render();

    wrap.appendChild(head);
    wrap.appendChild(list);
    marksPanel.appendChild(wrap);
  })();

  // Append panels
  layout.appendChild(infoPanel);
  layout.appendChild(skillsPanel);
  layout.appendChild(bookPanel);
  layout.appendChild(mapsPanel);
  layout.appendChild(marksPanel);

  // Tab switching
  function activate(panel) {
    [infoBtn, skillsBtn, bookBtn, mapsBtn, marksBtn].forEach((b) => b.classList.remove("active"));
    [infoPanel, skillsPanel, bookPanel, mapsPanel, marksPanel].forEach((p) => { p.classList.remove("active"); p.style.display = "none"; });
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


  try { window.applyTranslations && window.applyTranslations(document.getElementById("heroScreen")); } catch(e) {}
}

// Apply initial loadout so SKILLS are correct for subsequent UI/effects
applyLoadoutToSKILLS(currentLoadout);
updateSkillBarLabels();
try { window.updateSkillBarLabels = updateSkillBarLabels; } catch (e) {}
window.addEventListener("loadout-changed", () => {
  try {
    currentLoadout = loadOrDefault(SKILL_POOL, DEFAULT_LOADOUT);
    applyLoadoutToSKILLS(currentLoadout);
    updateSkillBarLabels();
    // If Hero Screen is visible, refresh its contents to reflect the new assignment
    if (heroScreen && !heroScreen.classList.contains("hidden")) {
      renderHeroScreen("skills");
    }
  } catch (_) {}
});

const aimPreview = null;

const attackPreview = null;

const selectionRing = createGroundRing(0.9, 1.05, 0x7cc4ff, 0.55);
selectionRing.visible = true;
effects.indicators.add(selectionRing);

// Center message helpers wired to UI
const setCenterMsg = (t) => ui.setCenterMsg(t);
const clearCenterMsg = () => ui.clearCenterMsg();
try {
  if (DEBUG) {
    setCenterMsg(`ATK rng=${WORLD.attackRange} x${WORLD.attackRangeMult} dmg=${WORLD.basicAttackDamage}`);
    setTimeout(() => clearCenterMsg(), 1800);
  }
} catch (e) {}

/* ------------------------------------------------------------
   Entities and Game State
------------------------------------------------------------ */
const player = new Player();
scene.add(player.mesh);
try { updateEnvironmentFollow(env, player); } catch (e) {}
// Map unlock check on startup and on level-up
try {
  mapManager.unlockByLevel(player.level);
  window.addEventListener("player-levelup", (ev) => {
    try {
      const lvl = ev?.detail?.level || player.level;
      const unlockedChanged = mapManager.unlockByLevel(lvl);
      // Auto-advance to highest unlocked map when new map unlocks
      if (unlockedChanged) {
        const prevIdx = mapManager.getCurrentIndex?.() || 1;
        const maxIdx = mapManager.getUnlockedMax?.() || prevIdx;
        if (maxIdx > prevIdx) {
          if (mapManager.setCurrent?.(maxIdx)) {
            // Reapply modifiers to existing enemies on map switch
            enemies.forEach((en) => applyMapModifiersToEnemy(en));
            setCenterMsg && setCenterMsg(`Unlocked and switched to MAP ${maxIdx}`);
            setTimeout(() => clearCenterMsg(), 1400);
          }
        }
      }
    } catch (_) {}
  });
} catch (_) {}

// Hero overhead HP/MP bars
const heroBars = createHeroOverheadBars();
player.mesh.add(heroBars.container);

// Respawn/death messaging
player.onDeath = () => {
  player.deadUntil = now() + 3;
  setCenterMsg("You died. Respawning...");
  player.aimMode = false;
  player.aimModeSkill = null;
  player.moveTarget = null;
  player.target = null;
};

/* Map modifiers helper */
function applyMapModifiersToEnemy(en) {
  try {
    const mods = mapManager.getModifiers?.() || {};
    // Apply multipliers
    en.maxHP = Math.max(1, Math.floor(en.maxHP * (mods.enemyHpMul || 1)));
    en.hp = Math.max(1, Math.min(en.maxHP, en.hp));
    en.attackDamage = Math.max(1, Math.floor(en.attackDamage * (mods.enemyDmgMul || 1)));
    if (mods.enemyTint) {
      en.beamColor = mods.enemyTint;
      try {
        const tint = new THREE.Color(mods.enemyTint);
        en.mesh.traverse?.((o) => {
          if (o && o.material && o.material.color) {
            o.material.color.lerp(tint, 0.25);
          }
        });
      } catch (_) {}
    }
  } catch (_) {}
}
// Enemies
const enemies = [];
for (let i = 0; i < WORLD.enemyCount; i++) {
  const angle = Math.random() * Math.PI * 2;
  const r = WORLD.enemySpawnRadius * (0.4 + Math.random() * 0.8);
  const pos = new THREE.Vector3(
    VILLAGE_POS.x + Math.cos(angle) * r,
    0,
    VILLAGE_POS.z + Math.sin(angle) * r
  );
  const e = new Enemy(pos, player.level);
  applyMapModifiersToEnemy(e);
  e.mesh.userData.enemyRef = e;
  scene.add(e.mesh);
  enemies.push(e);
}

let selectedUnit = player;

// Village visuals
const houses = [
  (() => { const h = createHouse(); h.position.set(8, 0, -8); scene.add(h); return h; })(),
  (() => { const h = createHouse(); h.position.set(-10, 0, 10); scene.add(h); return h; })(),
  (() => { const h = createHouse(); h.position.set(-16, 0, -12); scene.add(h); return h; })(),
];

/* Village fence: posts + connecting rails (multi-line) for a stronger visual barrier.
   The logical VILLAGE_POS/REST_RADIUS remain the authoritative gameplay boundary. */
const fenceGroup = new THREE.Group();
const FENCE_POSTS = 28;
const fenceRadius = REST_RADIUS - 0.2;

// create posts
const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8);
const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a });
const postPositions = [];
for (let i = 0; i < FENCE_POSTS; i++) {
  const ang = (i / FENCE_POSTS) * Math.PI * 2;
  const px = VILLAGE_POS.x + Math.cos(ang) * fenceRadius;
  const pz = VILLAGE_POS.z + Math.sin(ang) * fenceRadius;
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.set(px, 0.8, pz);
  post.rotation.y = -ang;
  post.receiveShadow = true;
  post.castShadow = true;
  fenceGroup.add(post);
  postPositions.push({ x: px, z: pz });
}

// connecting rails (three horizontal lines)
const railMat = new THREE.MeshStandardMaterial({ color: 0x4b3620 });
const railHeights = [0.45, 0.9, 1.35]; // y positions for rails
for (let i = 0; i < FENCE_POSTS; i++) {
  const a = postPositions[i];
  const b = postPositions[(i + 1) % FENCE_POSTS];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  for (const h of railHeights) {
    const railGeo = new THREE.BoxGeometry(len, 0.06, 0.06);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set((a.x + b.x) / 2, h, (a.z + b.z) / 2);
    rail.rotation.y = -angle;
    rail.receiveShadow = true;
    rail.castShadow = false;
    fenceGroup.add(rail);
  }
}

// Low translucent ground ring for visual guidance (subtle)
const fenceRing = new THREE.Mesh(
  new THREE.RingGeometry(fenceRadius - 0.08, fenceRadius + 0.08, 64),
  new THREE.MeshBasicMaterial({ color: COLOR.village, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
);
fenceRing.rotation.x = -Math.PI / 2;
fenceRing.position.copy(VILLAGE_POS);
fenceGroup.add(fenceRing);

scene.add(fenceGroup);

// Portals/Recall
const portals = initPortals(scene);
// Init Mark cooldown UI after portals are created
(function initMarkCooldownUI() {
  if (!btnMark || !portals?.getMarkCooldownMs) return;
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  }
  function tick() {
    try {
      const remain = portals.getMarkCooldownMs();
      if (remain > 0) {
        btnMark.disabled = true;
        btnMark.title = `Mark cooldown: ${fmt(remain)}`;
        btnMark.style.opacity = "0.5";
      } else {
        btnMark.disabled = false;
        btnMark.title = "Mark (3m cd)";
        btnMark.style.opacity = "";
      }
    } catch (_) {}
  }
  try { clearInterval(window.__markCoolInt); } catch (_) {}
  window.__markCoolInt = setInterval(tick, 500);
  tick();
})();
// Villages system (dynamic villages, roads, rest)
const villages = createVillagesSystem(scene, portals);

// ------------------------------------------------------------
// Skills system (cooldowns, abilities, storms) and UI
// ------------------------------------------------------------
const skills = new SkillsSystem(player, enemies, effects, ui.getCooldownElements(), villages);
try { window.__skillsRef = skills; } catch (_) {}
try { initHeroPreview(skills, { heroScreen }); } catch (_) {}

// Touch controls (joystick + skill wheel)
const touch = initTouchControls({ player, skills, effects, aimPreview, attackPreview, enemies, getNearestEnemy, WORLD, SKILLS });

// ------------------------------------------------------------
// Raycasting
// ------------------------------------------------------------
const raycast = createRaycast({
  renderer,
  camera,
  ground,
  enemiesMeshesProvider: () => enemies.filter((en) => en.alive).map((en) => en.mesh),
  playerMesh: player.mesh,
});

const inputService = createInputService({
  renderer,
  raycast,
  camera,
  portals,
  player,
  enemies,
  effects,
  skills,
  WORLD,
  DEBUG,
  aimPreview,
  attackPreview
});
inputService.attachCaptureListeners();
if (typeof touch !== "undefined" && touch) inputService.setTouchAdapter(touch);

// ------------------------------------------------------------
// UI: cooldowns are updated by skills; HUD and minimap updated in loop
// ------------------------------------------------------------

// ------------------------------------------------------------
// Input Handling
// ------------------------------------------------------------
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

let keyHoldA = false;

/* Autofire helper: attempt immediate auto-basic attack on nearest enemy within effective range.
   Respects cooldown in skills.tryBasicAttack, and enables attackMove if target is beyond range. */
function attemptAutoBasic() {
  if (!player.alive || player.frozen) return;
  try {
    const effRange = WORLD.attackRange * (WORLD.attackRangeMult || 1);
    const nearest = getNearestEnemy(player.pos(), effRange, enemies);
    if (!nearest) return;
    player.target = nearest;
    player.moveTarget = null;
    try {
      const d = distance2D(player.pos(), nearest.pos());
      player.attackMove = d > effRange * 0.95;
    } catch (err) {
      player.attackMove = false;
    }
    effects.spawnTargetPing(nearest);
    skills.tryBasicAttack(player, nearest);
  } catch (e) {}
}

/* Keyboard movement (arrow keys) */
const keyMove = { up: false, down: false, left: false, right: false };
function getKeyMoveDir() {
  const x = (keyMove.right ? 1 : 0) + (keyMove.left ? -1 : 0);
  const y = (keyMove.down ? 1 : 0) + (keyMove.up ? -1 : 0);
  const len = Math.hypot(x, y);
  if (len === 0) return { active: false, x: 0, y: 0 };
  return { active: true, x: x / len, y: y / len };
}

let lastMouseGroundPoint = new THREE.Vector3();
renderer.domElement.addEventListener("mousemove", (e) => {
  raycast.updateMouseNDC(e);
  const p = raycast.raycastGround();
  if (p) {
    lastMouseGroundPoint.copy(p);
  }
});

renderer.domElement.addEventListener("mousedown", (e) => {
  raycast.updateMouseNDC(e);
  if (e.button === 2) { // Right click: move / select (no auto-attack/move)
    if (player.frozen) {
      portals.handleFrozenPortalClick(raycast, camera, player, clearCenterMsg);
      return;
    }
    const obj = raycast.raycastEnemyOrGround();
    if (obj && obj.type === "enemy") {
      // Select enemy manually instead of auto-targeting/auto-attacking.
      selectedUnit = obj.enemy;
      effects.spawnTargetPing(obj.enemy);
    } else {
      const p = raycast.raycastGround();
      if (p) {
        // Manual move order; do not enable auto-attack.
        player.moveTarget = p.clone();
        player.target = null;
        player.attackMove = false;
        effects.spawnMovePing(p);
      }
    }
  } else if (e.button === 0) { // Left click: basic attack on enemy; ignore ground
    const obj = raycast.raycastPlayerOrEnemyOrGround();

    if (player.frozen) {
      portals.handleFrozenPortalClick(raycast, camera, player, clearCenterMsg);
      return;
    }

    const effRange = WORLD.attackRange * (WORLD.attackRangeMult || 1);

    if (obj && obj.type === "enemy") {
      selectedUnit = obj.enemy;
      if (obj.enemy && obj.enemy.alive) {
        player.target = obj.enemy;
        player.moveTarget = null;
        try {
          const d = distance2D(player.pos(), obj.enemy.pos());
          player.attackMove = d > effRange * 0.95;
        } catch (err) {
          player.attackMove = false;
        }
        effects.spawnTargetPing(obj.enemy);
        try { skills.tryBasicAttack(player, obj.enemy); } catch (_) {}
      }
    } else {
      // Ignore player/ground on left click (no move/order)
      selectedUnit = player;
    }
  }
});


window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "a") {
    // Ensure any existing aim mode is cancelled (defensive - some UI flows may have set aim)
    try {
      player.aimMode = false;
      player.aimModeSkill = null;
      if (aimPreview) aimPreview.visible = false;
      if (attackPreview) attackPreview.visible = false;
      renderer.domElement.style.cursor = "default";
    } catch (e) {}

    keyHoldA = true; // enable autofire while held
    // Auto-select nearest enemy and attempt basic attack.
    const nearest = getNearestEnemy(player.pos(), WORLD.attackRange * (WORLD.attackRangeMult || 1), enemies);
    if (nearest) {
      // select and perform basic attack immediately
      player.target = nearest;
      player.moveTarget = null;
      try {
        const d = distance2D(player.pos(), nearest.pos());
        player.attackMove = d > (WORLD.attackRange * (WORLD.attackRangeMult || 1)) * 0.95;
      } catch (err) {
        player.attackMove = false;
      }
      effects.spawnTargetPing(nearest);
      // Attempt basic attack (skills.tryBasicAttack will check cooldown/range)
      try { skills.tryBasicAttack(player, nearest); } catch (err) { /* ignore */ }
    } else {
      // No nearby enemy: do nothing (explicitly avoid entering ATTACK aim mode)
    }
  } else if (k === "q") {
    skills.castSkill("Q");
  } else if (k === "w") {
    skills.castSkill("W");
  } else if (k === "e") {
    skills.castSkill("E");
  } else if (k === "r") {
    skills.castSkill("R");
  } else if (k === "b") {
    portals.recallToVillage(player, setCenterMsg);
  } else if (k === "s") {
    stopPlayer();
  } else if (k === "escape") {
    // no-op (aiming removed)
  }
});

window.addEventListener("keyup", (e) => {
  const k = (e.key || "").toLowerCase();
  if (k === "a") {
    keyHoldA = false;
  }
});

/* Arrow keys: continuous movement while held */
window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
    try { e.preventDefault(); } catch (_) {}
    if (k === "ArrowUp") keyMove.up = true;
    if (k === "ArrowDown") keyMove.down = true;
    if (k === "ArrowLeft") keyMove.left = true;
    if (k === "ArrowRight") keyMove.right = true;
  }
});
window.addEventListener("keyup", (e) => {
  const k = e.key;
  if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
    if (k === "ArrowUp") keyMove.up = false;
    if (k === "ArrowDown") keyMove.down = false;
    if (k === "ArrowLeft") keyMove.left = false;
    if (k === "ArrowRight") keyMove.right = false;
  }
});

// ------------------------------------------------------------
// Systems Update Loop
// ------------------------------------------------------------
let lastMoveDir = new THREE.Vector3(0, 0, 0);
let lastT = now();

function animate() {
  requestAnimationFrame(animate);
  const t = now();
  const dt = Math.min(0.05, t - lastT);
  lastT = t;

  

  // Unified input (Hexagonal service): movement, holds, skills
  inputService.update(t, dt);

  // Mobile joystick movement (touch controls)
  try {
    if (typeof touch !== "undefined" && touch) {
      const joy = touch.getMoveDir?.();
      if (joy && joy.active && !player.frozen && !player.aimMode) {
        const speed = 30; // target distance ahead in world units
        const base = player.pos();
        const px = base.x + joy.x * speed;
        const pz = base.z + joy.y * speed;
        player.moveTarget = new THREE.Vector3(px, 0, pz);
        player.attackMove = false;
        player.target = null;
      }
    }
  } catch (_) {}

  updatePlayer(dt);
  updateEnemies(dt);
  if (firstPerson && typeof player !== "undefined") {
    // Compute world positions for left/right hand anchors (fall back to approximations)
    const ud = player.mesh.userData || {};
    const left = new THREE.Vector3();
    const right = new THREE.Vector3();
    if (ud.leftHandAnchor && ud.handAnchor) {
      ud.leftHandAnchor.getWorldPosition(left);
      ud.handAnchor.getWorldPosition(right);
    } else if (player.mesh.userData && player.mesh.userData.handAnchor) {
      const p = player.pos();
      left.set(p.x - 0.4, p.y + 1.15, p.z + 0.25);
      right.set(p.x + 0.4, p.y + 1.15, p.z + 0.25);
    } else {
      const p = player.pos();
      left.set(p.x - 0.4, p.y + 1.15, p.z);
      right.set(p.x + 0.4, p.y + 1.15, p.z);
    }

    // Midpoint between hands, and forward vector from player orientation
    const mid = left.clone().add(right).multiplyScalar(0.5);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion).normalize();

    // FP hand VFX and gestures (two hands, thunder-in-hand, move/attack animations)
    try {
      const ud = player.mesh.userData || {};
      const speed = lastMoveDir.length();
      const tnow = now();

      // Movement/idle crackle scheduling around hands
      if (!ud.nextCrackleT || tnow >= ud.nextCrackleT) {
        const strength = 0.6 + speed * 2.0;
        effects.spawnHandCrackle(player, false, strength);
        effects.spawnHandCrackle(player, true, strength * 0.8);
        ud.nextCrackleT = tnow + (speed > 0.1 ? 0.18 + Math.random() * 0.2 : 0.55 + Math.random() * 0.35);
      }

      // Boost orb/light intensity based on movement and a small flicker
      const flick = Math.sin(tnow * 10) * 0.2;
      if (ud.thunderOrb && ud.thunderOrb.material) {
        ud.thunderOrb.material.emissiveIntensity = 2.1 + speed * 0.6 + flick;
      }
      if (ud.leftThunderOrb && ud.leftThunderOrb.material) {
        ud.leftThunderOrb.material.emissiveIntensity = 1.9 + speed * 0.5 + flick * 0.8;
      }
      if (ud.handLight) ud.handLight.intensity = 1.2 + speed * 0.8;
      if (ud.leftHandLight) ud.leftHandLight.intensity = 1.0 + speed * 0.7;

      // Randomized gesture wobble while moving or idle, plus brace lift when attacking
      const rArm = ud.rightArm, lArm = ud.leftArm;
      if (rArm && lArm) {
        const moveAmp = 0.12 * Math.min(1, speed * 3);
        const idleAmp = 0.06;
        const phase = tnow * 6 + Math.random() * 0.05; // slight desync
        const amp = (speed > 0.02 ? moveAmp : idleAmp);
        const braceN = player.braceUntil && tnow < player.braceUntil ? Math.max(0, (player.braceUntil - tnow) / 0.18) : 0;

        // Base pose + sinusoidal bob + brace squash
        rArm.rotation.x = -Math.PI * 0.12 + Math.sin(phase) * amp - braceN * 0.15;
        lArm.rotation.x =  Math.PI * 0.12 + Math.cos(phase) * amp - braceN * 0.12;

        // Subtle sway and random micro-gestures
        rArm.rotation.y = 0.02 + Math.sin(phase * 0.5) * amp * 0.5 + (Math.random() - 0.5) * 0.01;
        lArm.rotation.y = -0.02 + Math.cos(phase * 0.5) * amp * 0.5 + (Math.random() - 0.5) * 0.01;

        // Occasional quick gesture twitch
        if (!ud.nextGestureT || tnow >= ud.nextGestureT) {
          rArm.rotation.z += (Math.random() - 0.5) * 0.08;
          lArm.rotation.z += (Math.random() - 0.5) * 0.08;
          ud.nextGestureT = tnow + 0.35 + Math.random() * 0.5;
        }
      }
    } catch (e) {}

    // Position camera slightly behind the hands (negative forward)
    // and bias framing so the visible model sits near the center-bottom of the screen
    const fpBack = 4.5;      // how far behind the hands the camera sits (increase to see more forward)
    const fpUp = 2.0;        // minimal vertical raise of camera to avoid occlusion
    const fpLookAhead = 3.0;  // look further ahead so enemies occupy the center
    const fpLookUp = 1.1;     // tilt camera upward more so hands/model sit lower in the frame

    const desiredPos = mid.clone()
      .add(forward.clone().multiplyScalar(-fpBack))
      .add(new THREE.Vector3(0, fpUp, 0));
    camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));

    // Look ahead and slightly upward to push the hands/model toward bottom-center of the view
    const lookTarget = mid.clone()
      .add(forward.clone().multiplyScalar(fpLookAhead))
      .add(new THREE.Vector3(0, fpLookUp, 0));
    camera.lookAt(lookTarget);
  } else {
    updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake);
  }
  updateGridFollow(ground, player);
  if (env) updateEnvironmentFollow(env, player);
  ui.updateHUD(player);
  skills.update(t, dt, cameraShake);
  ui.updateMinimap(player, enemies, portals, villages);
  effects.update(t, dt);
  if (env && typeof env.update === "function") env.update(t, dt);

  // Stream world features: ensure far village(s) exist as player travels
  villages.ensureFarVillage(player.pos());
  // When entering a village, connect it to previous visited village with a road
  villages.updateVisitedVillage(player.pos());

  updateIndicators(dt);
  portals.update(dt);
  villages.updateRest(player, dt);
  updateDeathRespawn();

  // Billboard enemy hp bars to face camera
  enemies.forEach((en) => {
    if (!en.alive) return;
    if (en.hpBar && en.hpBar.container) en.hpBar.container.lookAt(camera.position);
  });

  // Update hero overhead bars and billboard to camera
  if (heroBars) {
    const hpRatio = clamp01(player.hp / player.maxHP);
    const mpRatio = clamp01(player.mp / player.maxMP);
    heroBars.hpFill.scale.x = Math.max(0.001, hpRatio);
    heroBars.mpFill.scale.x = Math.max(0.001, mpRatio);
    heroBars.container.lookAt(camera.position);
  }

  renderer.render(scene, camera);
}
animate();

 // ------------------------------------------------------------
// Helpers and per-system updates
// ------------------------------------------------------------

// Pick a random valid spawn position for enemies around the village ring.
// Ensures spawns are outside the village rest radius and within the world enemy spawn radius.
function randomEnemySpawnPos() {
  // Dynamic enemy spawn around the hero for continuous gameplay.
  const angle = Math.random() * Math.PI * 2;
  const minR = Math.max(30, WORLD.enemySpawnRadius * 0.5);
  const maxR = Math.max(minR + 1, WORLD.enemySpawnRadius);
  const r = minR + Math.random() * (maxR - minR);

  // Base candidate around player's current position
  const center = player.pos();
  const cand = new THREE.Vector3(
    center.x + Math.cos(angle) * r,
    0,
    center.z + Math.sin(angle) * r
  );

  // Keep out of village rest radius if near village
  const dvx = cand.x - VILLAGE_POS.x;
  const dvz = cand.z - VILLAGE_POS.z;
  const dVillage = Math.hypot(dvx, dvz);
  if (dVillage < REST_RADIUS + 2) {
    const push = (REST_RADIUS + 2) - dVillage + 0.5;
    const nx = dvx / (dVillage || 1);
    const nz = dvz / (dVillage || 1);
    cand.x += nx * push;
    cand.z += nz * push;
  }

  // Keep out of any discovered dynamic village rest radius
  try {
    const list = villages?.listVillages?.() || [];
    for (const v of list) {
      const dvx2 = cand.x - v.center.x;
      const dvz2 = cand.z - v.center.z;
      const d2 = Math.hypot(dvx2, dvz2);
      const r2 = (v.radius || 0) + 2;
      if (d2 < r2) {
        const nx2 = dvx2 / (d2 || 1);
        const nz2 = dvz2 / (d2 || 1);
        const push2 = r2 - d2 + 0.5;
        cand.x += nx2 * push2;
        cand.z += nz2 * push2;
      }
    }
  } catch (_) {}

  return cand;
}

function stopPlayer() {
  // cancel movement/attack orders
  player.moveTarget = null;
  player.attackMove = false;
  player.target = null;

  // ensure no aim-related UI or state (aiming removed)
  player.aimMode = false;
  player.aimModeSkill = null;
  try {
    if (aimPreview) aimPreview.visible = false;
    if (attackPreview) attackPreview.visible = false;
    renderer.domElement.style.cursor = "default";
  } catch (_) {}

  // brief hold to prevent instant re-acquire
  player.holdUntil = now() + 0.4;
}

function updatePlayer(dt) {
  // Regen
  player.hp = Math.min(player.maxHP, player.hp + player.hpRegen * dt);
  player.mp = Math.min(player.maxMP, player.mp + player.mpRegen * dt);
  player.idlePhase += dt;

  // Dead state
  if (!player.alive) {
    player.mesh.position.y = 1.1;
    return;
  }

  // Freeze: no movement
  if (player.frozen) {
    player.mesh.position.y = 1.1;
    return;
  }

  // Auto-acquire nearest enemy if idle and in range (disabled — manual control)
  // Automatic target acquisition was removed so the player fully controls targeting and attacking.
  /*
  if (!player.moveTarget && (!player.target || !player.target.alive) && (!player.holdUntil || now() >= player.holdUntil)) {
    const nearest = getNearestEnemy(player.pos(), WORLD.attackRange + 0.5, enemies);
    if (nearest) player.target = nearest;
  }
  */

  // Attack-move: user-initiated attack-move is respected but automatic acquisition/auto-attack is disabled.
  if (player.attackMove) {
    // Intentionally left blank to avoid auto-acquiring targets while attack-moving.
    // Player must explicitly initiate attacks (e.g. press 'a' then click an enemy).
  }

  // Movement towards target or moveTarget
  let moveDir = null;
  if (player.target && player.target.alive) {
    const d = distance2D(player.pos(), player.target.pos());
    // Do NOT auto-move or auto-basic-attack when a target is set.
    // If the player explicitly used attack-move (player.attackMove) then allow moving toward the target.
    if (player.attackMove && d > (WORLD.attackRange * (WORLD.attackRangeMult || 1)) * 0.95) {
      moveDir = dir2D(player.pos(), player.target.pos());
    } else {
      // Otherwise, only auto-face the target when nearby (no auto-attack).
      if (d <= (WORLD.attackRange * (WORLD.attackRangeMult || 1)) * 1.5) {
        const v = dir2D(player.pos(), player.target.pos());
        const targetYaw = Math.atan2(v.x, v.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetYaw, 0));
        player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 1.5 * dt));
        player.lastFacingYaw = targetYaw;
        player.lastFacingUntil = now() + 0.6;
      }
    }
  } else if (player.moveTarget) {
    const d = distance2D(player.pos(), player.moveTarget);
    if (d > 0.6) {
      moveDir = dir2D(player.pos(), player.moveTarget);
    } else {
      player.moveTarget = null;
    }
  }

  if (moveDir) {
    const spMul = (player.speedBoostUntil && now() < player.speedBoostUntil && player.speedBoostMul) ? player.speedBoostMul : 1;
    const effSpeed = player.speed * spMul;
    player.mesh.position.x += moveDir.x * effSpeed * dt;
    player.mesh.position.z += moveDir.z * effSpeed * dt;

    // Rotate towards movement direction smoothly
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    const euler = new THREE.Euler(0, targetYaw, 0);
    const q = new THREE.Quaternion().setFromEuler(euler);
    player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * dt));

    // record move direction for camera look-ahead
    lastMoveDir.set(moveDir.x, 0, moveDir.z);
  } else {
    // stationary: face current target if any
    if (player.target && player.target.alive) {
      const v = dir2D(player.pos(), player.target.pos());
      const targetYaw = Math.atan2(v.x, v.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetYaw, 0));
      player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 1.5 * dt));
      player.lastFacingYaw = targetYaw;
      player.lastFacingUntil = now() + 0.6;
    } else if (player.lastFacingUntil && now() < player.lastFacingUntil) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.lastFacingYaw || 0, 0));
      player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 0.8 * dt));
    }
    // decay look-ahead
    lastMoveDir.multiplyScalar(Math.max(0, 1 - dt * 3));
  }

  // Keep y at ground
  player.mesh.position.y = 1.1;

  // Idle glow pulse and brief brace squash
  const ud = player.mesh.userData || {};
  if (ud.handLight) ud.handLight.intensity = 1.2 + Math.sin((player.idlePhase || 0) * 2.2) * 0.22;
  if (ud.thunderOrb && ud.thunderOrb.material) {
    ud.thunderOrb.material.emissiveIntensity = 2.2 + Math.sin((player.idlePhase || 0) * 2.2) * 0.35;
  }
  if (player.braceUntil && now() < player.braceUntil) {
    const n = Math.max(0, (player.braceUntil - now()) / 0.18);
    player.mesh.scale.set(1, 0.94 + 0.06 * n, 1);
  } else {
    player.mesh.scale.set(1, 1, 1);
  }
}

function updateEnemies(dt) {
  enemies.forEach((en) => {
    if (!en.alive) {
      // Death cleanup, SFX, and XP grant + schedule respawn
      if (!en._xpGranted) {
        try { audio.sfx("enemy_die"); } catch (e) {}
        en._xpGranted = true;
        player.gainXP(en.xpOnDeath);
        // schedule respawn to maintain density
        en._respawnAt = now() + (WORLD.enemyRespawnDelay || 8);
      }
      // Handle respawn to maintain enemy density; scale stats with current hero level
      if (en._respawnAt && now() >= en._respawnAt) {
        const pos = randomEnemySpawnPos();
        en.respawn(pos, player.level);
        applyMapModifiersToEnemy(en);
      }
      return;
    }
    const toPlayer = player.alive ? distance2D(en.pos(), player.pos()) : Infinity;

    // Stream/recycle enemies that are far away to maintain density around the hero
    const STREAM_DESPAWN_DIST = (WORLD.enemySpawnRadius || 220) * 1.6;
    if (toPlayer > STREAM_DESPAWN_DIST) {
      const pos = randomEnemySpawnPos();
      en.mesh.position.copy(pos);
      en.moveTarget = null;
      en.nextAttackReady = now() + 0.8;
      // skip AI this frame after relocation
      return;
    }

    if (toPlayer < WORLD.aiAggroRadius) {
      // chase player
      const d = toPlayer;
      const ar = en.attackRange || WORLD.aiAttackRange;
      if (d > ar) {
        const v = dir2D(en.pos(), player.pos());
        const spMul = en.slowUntil && now() < en.slowUntil ? en.slowFactor || 0.5 : 1;
        // Tentative next position
        const nx = en.mesh.position.x + v.x * en.speed * spMul * dt;
        const nz = en.mesh.position.z + v.z * en.speed * spMul * dt;
        const nextDistToVillage = Math.hypot(nx - VILLAGE_POS.x, nz - VILLAGE_POS.z);
        if (nextDistToVillage <= REST_RADIUS - 0.25) {
          // Clamp to fence boundary so enemies cannot enter origin village
          const dirFromVillage = dir2D(VILLAGE_POS, en.pos());
          en.mesh.position.x = VILLAGE_POS.x + dirFromVillage.x * (REST_RADIUS - 0.25);
          en.mesh.position.z = VILLAGE_POS.z + dirFromVillage.z * (REST_RADIUS - 0.25);
        } else {
          // Check dynamic villages
          const nextPos = new THREE.Vector3(nx, 0, nz);
          let clamped = false;
          try {
            const inside = villages?.isInsideAnyVillage?.(nextPos);
            if (inside && inside.inside && inside.key !== "origin") {
              const dirFrom = dir2D(inside.center, en.pos());
              const rad = Math.max(0.25, (inside.radius || REST_RADIUS) - 0.25);
              en.mesh.position.x = inside.center.x + dirFrom.x * rad;
              en.mesh.position.z = inside.center.z + dirFrom.z * rad;
              clamped = true;
            }
          } catch (_) {}
          if (!clamped) {
            en.mesh.position.x = nx;
            en.mesh.position.z = nz;
          }
        }
        // face
        const yaw = Math.atan2(v.x, v.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
        en.mesh.quaternion.slerp(q, 0.2);
      } else {
        // Attack
        const t = now();
        if (t >= (en.nextAttackReady || 0)) {
          const cd = en.attackCooldown || WORLD.aiAttackCooldown;
          en.nextAttackReady = t + cd;
          // Visual / Effect per enemy kind
          const from = en.pos().clone().add(new THREE.Vector3(0, 1.4, 0));
          const to = player.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
          try {
            if (en.attackEffect === "melee") {
              // impact strike at player
              effects.spawnStrike(player.pos(), 0.9, 0xff9955);
            } else if (en.attackEffect === "electric") {
              effects.spawnElectricBeamAuto(from, to, en.beamColor || 0x9fd8ff, 0.1);
            } else {
              // default beam (archer/others)
              effects.spawnBeam(from, to, en.beamColor || 0xff8080, 0.09);
            }
          } catch (e) {}
          // Damage
          player.takeDamage(en.attackDamage);
          // SFX: player hit by enemy
          try { audio.sfx("player_hit"); } catch (e) {}
          // floating damage popup on player
          try { effects.spawnDamagePopup(player.pos(), en.attackDamage, 0xffd0d0); } catch (e) {}
        }
      }
    } else {
      // Wander around their spawn origin
      if (!en.moveTarget || Math.random() < 0.005) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * WORLD.aiWanderRadius;
        en.moveTarget = en.pos().clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      }
      const d = distance2D(en.pos(), en.moveTarget);
      if (d > 0.8) {
        const v = dir2D(en.pos(), en.moveTarget);
        const spMul = en.slowUntil && now() < en.slowUntil ? en.slowFactor || 0.5 : 1;
        en.mesh.position.x += v.x * en.speed * spMul * 0.6 * dt;
        en.mesh.position.z += v.z * en.speed * spMul * 0.6 * dt;
      }
    }

    // keep y
    en.mesh.position.y = 1.0;

    // Update HP bar
    en.updateHPBar();

    // Death cleanup, SFX, and XP grant + schedule respawn
    if (!en.alive && !en._xpGranted) {
      try { audio.sfx("enemy_die"); } catch (e) {}
      en._xpGranted = true;
      player.gainXP(en.xpOnDeath);
      // schedule respawn to maintain density
      en._respawnAt = now() + (WORLD.enemyRespawnDelay || 8);
    }
    // Handle respawn to maintain enemy density; scale stats with current hero level
    if (!en.alive && en._respawnAt && now() >= en._respawnAt) {
      const pos = randomEnemySpawnPos();
      en.respawn(pos, player.level);
    }
  });
}

function updateIndicators(dt) {
  // Selection ring: follow currently selected unit
  if (selectedUnit && selectedUnit.alive) {
    selectionRing.visible = true;
    const p = selectedUnit.pos();
    selectionRing.position.set(p.x, 0.02, p.z);
    const col = selectedUnit.team === "enemy" ? 0xff6060 : 0x7cc4ff;
    selectionRing.material.color.setHex(col);
  } else {
    selectionRing.visible = false;
  }

  // Subtle rotation for aim ring for feedback

  // Slow debuff indicator rings
  const t = now();
  enemies.forEach((en) => {
    const slowed = en.slowUntil && t < en.slowUntil;
    if (slowed) {
      if (!en._slowRing) {
        const r = createGroundRing(0.6, 0.9, 0x66aaff, 0.7);
        effects.indicators.add(r);
        en._slowRing = r;
      }
      const p = en.pos();
      en._slowRing.position.set(p.x, 0.02, p.z);
      en._slowRing.visible = true;
    } else if (en._slowRing) {
      effects.indicators.remove(en._slowRing);
      en._slowRing.geometry.dispose?.();
      en._slowRing = null;
    }
  });

  // Hand charged micro-sparks when any skill is ready
  const anyReady = !(skills.isOnCooldown("Q") && skills.isOnCooldown("W") && skills.isOnCooldown("E") && skills.isOnCooldown("R"));
  if (anyReady && (window.__nextHandSparkT ?? 0) <= t) {
    const from = handWorldPos(player);
    const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6));
    effects.spawnElectricBeam(from, to, 0x9fd8ff, 0.06, 5, 0.2);
    window.__nextHandSparkT = t + 0.5 + Math.random() * 0.5;
  }
}


function updateDeathRespawn() {
  const t = now();
  if (!player.alive && player.deadUntil && t >= player.deadUntil) {
    // Respawn at village
    player.alive = true;
    player.mesh.visible = true;
    player.mesh.position.copy(VILLAGE_POS).add(new THREE.Vector3(1.5, 0, 0));
    player.hp = player.maxHP;
    player.mp = player.maxMP;
    player.moveTarget = null;
    player.target = null;
    player.invulnUntil = now() + 2;
    clearCenterMsg();
  }
}

// ------------------------------------------------------------
// Window resize
// ------------------------------------------------------------
addResizeHandler(renderer, camera);

// ------------------------------------------------------------
// Align player start facing village center
// ------------------------------------------------------------
(function initFace() {
  const v = dir2D(player.pos(), VILLAGE_POS);
  const yaw = Math.atan2(v.x, v.z);
  player.mesh.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
})();
