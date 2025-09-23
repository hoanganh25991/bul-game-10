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
    } catch (_) {}
    settingsPanel?.classList.toggle("hidden");
  });
  btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));

  // Initialize controls once on boot (in case user opens immediately)
  try {
    ensureSettingsTabs(settingsPanel, t, startInstructionGuide);
  } catch (_) {}

  // Audio toggles
  initAudioControls(audioCtl);

  // Environment controls
  initEnvironmentControls(environment);

  // Render controls
  initQualitySelect(render, t);
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
      const len = (environment.ENV_PRESETS?.length || 3);
      const idx = clamp01i(envDensityIndex, 0, len - 1);
      const uiVal = 1 + Math.round((idx / Math.max(1, len - 1)) * 9);
      envDensity.value = String(uiVal);
    } catch (_) {}
    // Show numeric value next to slider (UI scale 1..10)
    try { attachSliderValueDisplay(envDensity, (v) => String(v)); } catch (_) {}
    const onEnvDensityChange = (ev) => {
      const vv = parseInt(ev.target.value, 10);
      const len = (environment.ENV_PRESETS?.length || 3);
      const ui = Math.min(Math.max(1, Number.isFinite(vv) ? vv : 5), 10);
      envDensityIndex = Math.min(Math.max(0, Math.round(((ui - 1) / 9) * (len - 1))), len - 1);
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
    // Apply only on commit (no live drag updates)
    envDensity.addEventListener("change", onEnvDensityChange);
  }

  if (rainDensity) {
    try {
      const uiVal = 1 + Math.round((clamp01i(envRainLevel, 0, 2) / 2) * 9);
      rainDensity.value = String(uiVal);
    } catch (_) {}
    // Show numeric value next to slider (UI scale 1..10)
    try { attachSliderValueDisplay(rainDensity, (v) => String(v)); } catch (_) {}
    const onRainDensityChange = (ev) => {
      const vv = parseInt(ev.target.value, 10);
      const ui = Math.min(Math.max(1, Number.isFinite(vv) ? vv : 5), 10);
      envRainLevel = Math.round(((ui - 1) / 9) * 2);
      try {
        env && typeof env.setRainLevel === "function" && env.setRainLevel(envRainLevel);
      } catch (_) {}
      persistEnvPrefs(envRainState, envDensityIndex, envRainLevel);
      environment.setState?.({ env, envRainState, envDensityIndex, envRainLevel });
    };
    // Apply only on commit (no live drag updates)
    rainDensity.addEventListener("change", onRainDensityChange);
  }
}

function persistEnvPrefs(rain, densityIndex, rainLevel) {
  try {
    localStorage.setItem("envPrefs", JSON.stringify({ rain: !!rain, density: densityIndex, rainLevel }));
  } catch (_) {}
}

/* ---------------- Render Controls ---------------- */
function initQualitySelect(render, t) {
  if (!render) return;
  const sel = document.getElementById("qualitySelect");
  if (!sel) return;

  let current = "high";
  try {
    const q = render.getQuality?.() || "high";
    current = q === "low" || q === "medium" || q === "high" ? q : "high";
    sel.value = current;
  } catch (_) {
    try {
      sel.value = current;
    } catch (_) {}
  }

  if (!sel.dataset.bound) {
    sel.addEventListener("change", () => {
      const v = String(sel.value || current).toLowerCase();
      const valid = v === "low" || v === "medium" || v === "high";
      const nextQ = valid ? v : current;

      if (nextQ === current) return;

      const tt = typeof t === "function" ? t : (x) => x;
      showReloadConfirm(tt).then((ok) => {
        if (ok) {
          try {
            const prev = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
            prev.quality = nextQ;
            localStorage.setItem("renderPrefs", JSON.stringify(prev));
          } catch (_) {}
          try {
            window.location.reload();
          } catch (_) {
            try {
              location.reload();
            } catch (_) {}
          }
        } else {
          try {
            sel.value = current;
          } catch (_) {}
        }
      });
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
    const uiVal = 1 + Math.round(((z - 0.6) / 1.0) * 9);
    sel.value = String(Math.max(1, Math.min(10, uiVal)));
  } catch (_) {}
  // Show numeric value next to slider (UI scale 1..10)
  try { attachSliderValueDisplay(sel, (v) => String(v)); } catch (_) {}

  try {
    render.cameraOffset?.copy?.(render.baseCameraOffset?.clone?.().multiplyScalar(z));
  } catch (_) {}

  if (!sel.dataset.bound) {
    const onChange = () => {
      const ui = Math.max(1, Math.min(10, parseInt(sel.value, 10) || 5));
      const zoom = 0.6 + ((ui - 1) / 9) * 1.0;
      try {
        render.cameraOffset?.copy?.(render.baseCameraOffset?.clone?.().multiplyScalar(zoom));
      } catch (_) {}
      try {
        const prev = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
        prev.zoom = zoom;
        localStorage.setItem("renderPrefs", JSON.stringify(prev));
      } catch (_) {}
    };
    // Apply only on commit (no live drag updates)
    sel.addEventListener("change", onChange);
    sel.dataset.bound = "1";
  }
}

/* ---------------- Confirm Modal ---------------- */
function showReloadConfirm(t) {
  return new Promise((resolve) => {
    const tt = typeof t === "function" ? t : (x) => x;

    const root = document.createElement("div");
    root.id = "__qualityReloadConfirm";
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.35)",
      zIndex: "9999",
      backdropFilter: "blur(2px)",
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      minWidth: "280px",
      maxWidth: "90vw",
      background: "rgba(10,20,30,0.92)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "10px",
      padding: "14px",
      color: "#dfefff",
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
      textAlign: "center",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
    });

    const title = document.createElement("div");
    title.textContent = tt("settings.render.reloadTitle") || "Reload required";
    Object.assign(title.style, { fontWeight: "700", marginBottom: "6px", fontSize: "16px" });

    const desc = document.createElement("div");
    desc.textContent = tt("settings.render.reloadDesc") || (tt("settings.render.reloadPrompt") || "Changing graphics quality requires a reload.");
    Object.assign(desc.style, { fontSize: "13px", opacity: "0.85", marginBottom: "12px" });

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "8px", justifyContent: "center" });

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.textContent = tt("btn.cancel") || "Cancel";
    Object.assign(btnCancel.style, {
      padding: "8px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(120,40,40,0.85)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
    });
    btnCancel.addEventListener("mouseenter", () => (btnCancel.style.background = "rgba(160,60,60,0.9)"));
    btnCancel.addEventListener("mouseleave", () => (btnCancel.style.background = "rgba(120,40,40,0.85)"));
    btnCancel.addEventListener("click", () => { cleanup(); resolve(false); });

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.textContent = tt("btn.yes") || "Yes";
    Object.assign(btnOk.style, {
      padding: "8px 12px",
      borderRadius: "6px",
      border: "1px solid rgba(255,255,255,0.2)",
      background: "rgba(40,120,60,0.85)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: "600",
    });
    btnOk.addEventListener("mouseenter", () => (btnOk.style.background = "rgba(60,160,90,0.9)"));
    btnOk.addEventListener("mouseleave", () => (btnOk.style.background = "rgba(40,120,60,0.85)"));
    btnOk.addEventListener("click", () => { cleanup(); resolve(true); });

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);

    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(actions);
    root.appendChild(box);

    function onKey(ev) {
      const k = String(ev.key || "").toUpperCase();
      if (k === "ESCAPE") {
        ev.preventDefault?.();
        cleanup();
        resolve(false);
      } else if (k === "ENTER") {
        ev.preventDefault?.();
        cleanup();
        resolve(true);
      }
    }
    function onClickBackdrop(ev) {
      if (ev.target === root) {
        cleanup();
        resolve(false);
      }
    }

    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", onClickBackdrop, true);
    document.body.appendChild(root);

    function cleanup() {
      document.removeEventListener("keydown", onKey, true);
      root.removeEventListener("click", onClickBackdrop, true);
      try { root.remove(); } catch (_) { if (root && root.parentNode) root.parentNode.removeChild(root); }
    }
  });
}

/* ---------------- Slider value badge ---------------- */
function attachSliderValueDisplay(inputEl, format) {
  if (!inputEl || inputEl.dataset.valueBadgeBound === "1") return;
  const fmt = typeof format === "function" ? format : (v) => String(v);

  // Create a small value bubble right after the input
  const badge = document.createElement("span");
  badge.className = "slider-value";
  Object.assign(badge.style, {
    marginLeft: "6px",
    fontSize: "12px",
    color: "#bfe5ff",
    opacity: "0.9",
    minWidth: "36px",
    textAlign: "right",
    userSelect: "none"
  });

  function update() {
    try {
      badge.textContent = fmt(inputEl.value);
    } catch (_) {
      badge.textContent = String(inputEl.value);
    }
  }

  try {
    inputEl.insertAdjacentElement("afterend", badge);
  } catch (_) {
    if (inputEl.parentNode) inputEl.parentNode.appendChild(badge);
  }
  update();

  inputEl.addEventListener("input", update);
  inputEl.addEventListener("change", update);

  inputEl.dataset.valueBadgeBound = "1";
}

/* ---------------- Utils ---------------- */
function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clamp01i(v, a, b) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(a, Number.isFinite(n) ? n : a), b);
}
