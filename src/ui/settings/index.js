/* Settings Screen wiring and controls
   - Tabs (General / Environment / Controls)
   - Guide button
   - Environment controls (rain toggle, density, rain level)
   - Render controls (quality, zoom)
   - Audio controls (music, sfx)
*/
import { t as tI18n } from "../../i18n.js";

export function setupSettingsScreen({
  t = tI18n,
  startInstructionGuide,
  elements = {},
  environment,
  render,
  audioCtl,
} = {}) {
  const btnSettingsScreen = elements.btnSettingsScreen || document.getElementById("btnSettingsScreen");
  const btnCloseSettings = elements.btnCloseSettings || document.getElementById("btnCloseSettings");
  const settingsPanel = elements.settingsPanel || document.getElementById("settingsPanel");

  // Open/close handlers
  btnSettingsScreen?.addEventListener("click", () => {
    try {
      ensureSettingsTabs(settingsPanel, t, startInstructionGuide);
      ensureGuideButton(settingsPanel, startInstructionGuide);
    } catch (_) {}
    settingsPanel?.classList.toggle("hidden");
  });
  btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));

  // Initialize controls once on boot (in case user opens immediately)
  try {
    ensureSettingsTabs(settingsPanel, t, startInstructionGuide);
    ensureGuideButton(settingsPanel, startInstructionGuide);
  } catch (_) {}

  // Audio toggles
  initAudioControls(audioCtl);

  // Environment controls
  initEnvironmentControls(environment);

  // Render controls
  initQualitySelect(render);
  initZoomControl(render);
}

/* ---------------- Tabs and Guide ---------------- */

function ensureSettingsTabs(settingsPanel, t, startInstructionGuide) {
  if (!settingsPanel || settingsPanel.dataset.tabsReady === "1") return;
  const content = settingsPanel.querySelector(".panel-content");
  if (!content) return;

  const rows = Array.from(content.querySelectorAll(".row"));
  const generalPanel = document.createElement("div");
  generalPanel.className = "tab-panel active";
  const envPanel = document.createElement("div");
  envPanel.className = "tab-panel";
  const controlsPanel = document.createElement("div");
  controlsPanel.className = "tab-panel";

  rows.forEach((row) => {
    if (row.querySelector("#langVi") || row.querySelector("#settingsInstructions")) {
      generalPanel.appendChild(row);
    } else if (
      row.querySelector("#envRainToggle") ||
      row.querySelector("#envDensity") ||
      row.querySelector("#rainDensity") ||
      row.querySelector("#zoomSlider") ||
      row.querySelector("#qualitySelect")
    ) {
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

  generalPanel.style.display = "block";
  envPanel.style.display = "none";
  controlsPanel.style.display = "none";

  const tabBar = document.createElement("div");
  tabBar.className = "tab-bar";
  const tabs = [
    { key: "general", labelKey: "settings.tabs.general", panel: generalPanel },
    { key: "environment", labelKey: "settings.tabs.environment", panel: envPanel },
    { key: "controls", labelKey: "settings.tabs.controls", panel: controlsPanel },
  ];
  tabs.forEach((tabDef, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (idx === 0 ? " active" : "");
    btn.setAttribute("data-i18n", tabDef.labelKey);
    try {
      btn.textContent = (t || ((x) => x))(tabDef.labelKey);
    } catch (_) {
      btn.textContent = tabDef.labelKey;
    }
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

  content.innerHTML = "";
  content.appendChild(tabBar);
  content.appendChild(generalPanel);
  content.appendChild(envPanel);
  content.appendChild(controlsPanel);
  settingsPanel.dataset.tabsReady = "1";

  try {
    window.applyTranslations && window.applyTranslations(settingsPanel);
  } catch (_) {}

  // Ensure guide button
  try {
    ensureGuideButton(settingsPanel, startInstructionGuide);
  } catch (_) {}
}

function ensureGuideButton(settingsPanel, startInstructionGuide) {
  try {
    const root = settingsPanel || document.getElementById("settingsPanel");
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
        try {
          startInstructionGuide && startInstructionGuide();
        } catch (_) {}
      });
      instrRow.appendChild(btn);
    }
  } catch (_) {}
}

/* ---------------- Audio ---------------- */
function initAudioControls(audioCtl) {
  if (!audioCtl) return;
  const musicToggle = document.getElementById("musicToggle");
  const sfxToggle = document.getElementById("sfxToggle");
  if (musicToggle) {
    try {
      musicToggle.checked = !!audioCtl.getMusicEnabled?.();
    } catch (_) {}
    musicToggle.addEventListener("change", () => {
      const next = !!musicToggle.checked;
      try {
        audioCtl.setMusicEnabled?.(next);
      } catch (_) {}
      // Start/stop music immediately
      if (next) {
        try {
          audioCtl.audio?.startStreamMusic?.("audio/Ice and Snow.mp3", { volume: 0.35, loop: true });
        } catch (e) {
          try {
            audioCtl.audio?.setMusicVolume?.(0.35);
            audioCtl.audio?.startMusic?.();
          } catch (_) {}
        }
      } else {
        try {
          audioCtl.audio?.stopStreamMusic?.();
        } catch (_) {}
        try {
          audioCtl.audio?.stopMusic?.();
        } catch (_) {}
        try {
          audioCtl.audio?.setMusicVolume?.(0);
        } catch (_) {}
      }
      try {
        localStorage.setItem(
          "audioPrefs",
          JSON.stringify({ music: !!audioCtl.getMusicEnabled?.(), sfx: !!audioCtl.getSfxEnabled?.() })
        );
      } catch (_) {}
    });
  }
  if (sfxToggle) {
    try {
      sfxToggle.checked = !!audioCtl.getSfxEnabled?.();
    } catch (_) {}
    sfxToggle.addEventListener("change", () => {
      const next = !!sfxToggle.checked;
      try {
        audioCtl.setSfxEnabled?.(next);
      } catch (_) {}
      try {
        const vol = next ? 0.5 : 0.0;
        audioCtl.audio?.setSfxVolume?.(vol);
      } catch (_) {}
      try {
        localStorage.setItem(
          "audioPrefs",
          JSON.stringify({ music: !!audioCtl.getMusicEnabled?.(), sfx: !!audioCtl.getSfxEnabled?.() })
        );
      } catch (_) {}
    });
  }
}

/* ---------------- Environment ---------------- */
function initEnvironmentControls(environment) {
  if (!environment) return;

  const envRainToggle = document.getElementById("envRainToggle");
  const envDensity = document.getElementById("envDensity");
  const rainDensity = document.getElementById("rainDensity");

  // Snapshot current
  let { env, envRainState, envDensityIndex, envRainLevel } = environment.getState?.() || {};

  // Initialize toggles
  if (envRainToggle) {
    try {
      envRainToggle.checked = !!envRainState;
    } catch (_) {}
    envRainToggle.addEventListener("change", (ev) => {
      envRainState = !!ev.target.checked;
      try {
        if (env && typeof env.toggleRain === "function") env.toggleRain(envRainState);
        if (envRainState && env && typeof env.setRainLevel === "function") {
          env.setRainLevel(clamp01i(envRainLevel, 0, 2));
        }
      } catch (_) {}
      persistEnvPrefs(envRainState, envDensityIndex, envRainLevel);
      // push back to host
      environment.setState?.({ env, envRainState, envDensityIndex, envRainLevel });
    });
  }

  if (envDensity) {
    try {
      envDensity.value = clamp01i(envDensityIndex, 0, (environment.ENV_PRESETS?.length || 3) - 1);
    } catch (_) {}
    const onEnvDensityChange = (ev) => {
      const v = parseInt(ev.target.value, 10);
      envDensityIndex = clamp01i(Number.isFinite(v) ? v : 1, 0, (environment.ENV_PRESETS?.length || 3) - 1);
      const preset = environment.ENV_PRESETS?.[envDensityIndex] || {};
      // Recreate environment
      try {
        if (env && env.root && env.root.parent) env.root.parent.remove(env.root);
      } catch (_) {}
      try {
        const next = environment.initEnvironment?.(environment.scene, Object.assign({}, preset, { enableRain: envRainState }));
        env = next || env;
        if (envRainState && env && typeof env.setRainLevel === "function") {
          env.setRainLevel(clamp01i(envRainLevel, 0, 2));
        }
        // Follow
        try {
          environment.updateEnvironmentFollow?.(env, environment.player);
        } catch (_) {}
      } catch (_) {}
      persistEnvPrefs(envRainState, envDensityIndex, envRainLevel);
      environment.setState?.({ env, envRainState, envDensityIndex, envRainLevel });
    };
    envDensity.addEventListener("input", onEnvDensityChange);
    envDensity.addEventListener("change", onEnvDensityChange);
  }

  if (rainDensity) {
    try {
      rainDensity.value = clamp01i(envRainLevel, 0, 2);
    } catch (_) {}
    const onRainDensityChange = (ev) => {
      const v = parseInt(ev.target.value, 10);
      envRainLevel = clamp01i(Number.isFinite(v) ? v : 1, 0, 2);
      try {
        env && typeof env.setRainLevel === "function" && env.setRainLevel(envRainLevel);
      } catch (_) {}
      persistEnvPrefs(envRainState, envDensityIndex, envRainLevel);
      environment.setState?.({ env, envRainState, envDensityIndex, envRainLevel });
    };
    rainDensity.addEventListener("input", onRainDensityChange);
    rainDensity.addEventListener("change", onRainDensityChange);
  }
}

function persistEnvPrefs(rain, densityIndex, rainLevel) {
  try {
    localStorage.setItem("envPrefs", JSON.stringify({ rain: !!rain, density: densityIndex, rainLevel }));
  } catch (_) {}
}

/* ---------------- Render Controls ---------------- */
function initQualitySelect(render) {
  if (!render) return;
  const sel = document.getElementById("qualitySelect");
  if (!sel) return;

  try {
    const q = render.getQuality?.() || "high";
    sel.value = q === "low" || q === "medium" || q === "high" ? q : "high";
  } catch (_) {}

  if (!sel.dataset.bound) {
    sel.addEventListener("change", () => {
      const v = String(sel.value || "high").toLowerCase();
      const valid = v === "low" || v === "medium" || v === "high";
      const nextQ = valid ? v : "high";
      try {
        // persist
        const prev = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
        prev.quality = nextQ;
        localStorage.setItem("renderPrefs", JSON.stringify(prev));
      } catch (_) {}
      try {
        render.setQuality?.(nextQ);
      } catch (_) {}
      try {
        render.renderer?.setPixelRatio?.(render.getTargetPixelRatio?.());
        render.renderer?.setSize?.(window.innerWidth, window.innerHeight);
      } catch (_) {}
    });
    sel.dataset.bound = "1";
  }
}

function initZoomControl(render) {
  if (!render) return;
  const sel = document.getElementById("zoomSlider");
  if (!sel) return;

  let z = 1;
  try {
    const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
    if (typeof prefs.zoom === "number") z = prefs.zoom;
  } catch (_) {}
  z = clampNum(z, 0.6, 1.6);

  try {
    sel.value = String(z);
  } catch (_) {}

  try {
    render.cameraOffset?.copy?.(render.baseCameraOffset?.clone?.().multiplyScalar(z));
  } catch (_) {}

  if (!sel.dataset.bound) {
    const onChange = () => {
      const v = clampNum(parseFloat(sel.value), 0.6, 1.6) || 1;
      try {
        render.cameraOffset?.copy?.(render.baseCameraOffset?.clone?.().multiplyScalar(v));
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

/* ---------------- Utils ---------------- */
function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clamp01i(v, a, b) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(a, Number.isFinite(n) ? n : a), b);
}
