/* Settings Screen wiring and controls
   - Tabs (General / Environment / Controls)
   - Guide button
   - Environment controls (rain toggle, density, rain level)
   - Render controls (quality, zoom)
   - Audio controls (music, sfx)
*/
import { t as tI18n } from "../../i18n.js";
import { renderGeneralTab } from "./tabs/general.js";
import { renderEnvironmentTab } from "./tabs/environment.js";

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

    // Apply fullscreen on open if toggle is enabled (user gesture context)
    try {
      const fsEl = document.getElementById("fullscreenToggle");
      if (fsEl && !settingsPanel?.classList.contains("hidden") && fsEl.checked) {
        enterFullscreen();
      }
    } catch (_) {}

    // Ensure background music keeps playing independently of settings visibility
    try {
      if (audioCtl?.getMusicEnabled?.()) {
        audioCtl.audio?.resumeFromForeground?.();
        // Safe to call; will (re)start stream or resume element on user gesture
        audioCtl.audio?.startStreamMusic?.("audio/Ice and Snow.mp3", { volume: 0.35, loop: true });
      }
    } catch (_) {}
  });
  btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));

  // Initialize controls once on boot (in case user opens immediately)
  try {
    ensureSettingsTabs(settingsPanel, t, startInstructionGuide);
  } catch (_) {}

  // Bind domain tabs once
  try {
    const content = settingsPanel?.querySelector(".panel-content");
    const generalPanel = content?.querySelector("#tabGeneral");
    const envPanel = content?.querySelector("#tabEnvironment");
    renderGeneralTab(generalPanel, { t, audioCtl, render });
    renderEnvironmentTab(envPanel, { environment });
  } catch (_) {}
}

/* ---------------- Tabs and Guide ---------------- */

function ensureSettingsTabs(settingsPanel, t, startInstructionGuide) {
  if (!settingsPanel || settingsPanel.dataset.tabsReady === "1") return;
  const content = settingsPanel.querySelector(".panel-content");
  if (!content) return;

  const tabBar = content.querySelector(".tab-bar");
  const generalPanel = content.querySelector("#tabGeneral");
  const envPanel = content.querySelector("#tabEnvironment");
  const tabBtns = tabBar ? Array.from(tabBar.querySelectorAll(".tab-btn")) : [];

  // Localize tab labels using t() if available
  tabBtns.forEach((btn) => {
    const key = btn.getAttribute("data-i18n");
    try { if (key && typeof t === "function") btn.textContent = t(key); } catch (_) {}
  });

  // Bind tab switching
  tabBtns.forEach((btn) => {
    if (btn.dataset.bound === "1") return;
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      [generalPanel, envPanel].forEach((p) => {
        if (!p) return;
        p.classList.remove("active");
        p.style.display = "none";
      });
      const targetId = btn.getAttribute("aria-controls");
      const target = targetId ? content.querySelector(`#${targetId}`) : null;
      if (target) {
        target.classList.add("active");
        target.style.display = "block";
      }
    });
    btn.dataset.bound = "1";
  });

  // Ensure initial active state
  const activeBtn = tabBtns.find((b) => b.classList.contains("active")) || tabBtns[0];
  if (activeBtn) {
    // Activate without double-adding listeners
    const targetId = activeBtn.getAttribute("aria-controls");
    const target = targetId ? content.querySelector(`#${targetId}`) : null;
    tabBtns.forEach((b) => b.classList.remove("active"));
    activeBtn.classList.add("active");
    [generalPanel, envPanel].forEach((p) => {
      if (!p) return;
      p.classList.remove("active");
      p.style.display = "none";
    });
    if (target) {
      target.classList.add("active");
      target.style.display = "block";
    }
  }

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

  // Default to UI value 2 when no saved preference:
  // ui=2 => zoom = 0.6 + ((2 - 1) / 9) * 1.0 = ~0.7111
  let z = 0.6 + (1 / 9) * 1.0;
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
    const modal = document.getElementById("qualityReloadConfirm");

    if (modal) {
      const titleEl = modal.querySelector("#qualityReloadTitle");
      const descEl = modal.querySelector(".modal-desc");
      const btnCancel = document.getElementById("qualityReloadCancel") || modal.querySelector(".secondary");
      const btnOk = document.getElementById("qualityReloadOk") || modal.querySelector(".primary");

      // Localize
      try {
        if (titleEl) titleEl.textContent = tt("settings.render.reloadTitle") || "Reload required";
        if (descEl) descEl.textContent =
          tt("settings.render.reloadDesc") || (tt("settings.render.reloadPrompt") || "Changing graphics quality requires a reload.");
        if (btnCancel) btnCancel.textContent = tt("btn.cancel") || "Cancel";
        if (btnOk) btnOk.textContent = tt("btn.yes") || "Yes";
      } catch (_) {}

      function cleanup() {
        document.removeEventListener("keydown", onKey, true);
        modal.removeEventListener("click", onClickBackdrop, true);
        try { modal.classList.add("hidden"); } catch (_) {}
      }
      function onKey(ev) {
        const k = String(ev.key || "").toUpperCase();
        if (k === "ESCAPE") { ev.preventDefault?.(); cleanup(); resolve(false); }
        else if (k === "ENTER") { ev.preventDefault?.(); cleanup(); resolve(true); }
      }
      function onClickBackdrop(ev) {
        if (ev.target === modal) { cleanup(); resolve(false); }
      }

      document.addEventListener("keydown", onKey, true);
      modal.addEventListener("click", onClickBackdrop, true);
      try { modal.classList.remove("hidden"); } catch (_) {}

      btnCancel?.addEventListener("click", function onC() { cleanup(); resolve(false); }, { once: true });
      btnOk?.addEventListener("click", function onO() { cleanup(); resolve(true); }, { once: true });
      return;
    }

    // Fallback: native confirm if static modal not present
    try {
      const ok = window.confirm(tt("settings.render.reloadPrompt") || "Changing graphics quality requires a reload. Proceed?");
      resolve(!!ok);
    } catch (_) {
      resolve(false);
    }
  });
}

/* ---------------- Slider value badge ---------------- */
function attachSliderValueDisplay(inputEl, format) {
  if (!inputEl || inputEl.dataset.valueBadgeBound === "1") return;
  const fmt = typeof format === "function" ? format : (v) => String(v);

  // Reuse existing badge if present in DOM to avoid creating elements
  let badge = null;
  try {
    const sib = inputEl.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("slider-value")) {
      badge = sib;
    } else if (inputEl.parentNode) {
      const q = inputEl.parentNode.querySelector(".slider-value");
      if (q) badge = q;
    }
  } catch (_) {}

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "slider-value";
  }

  function update() {
    try {
      badge.textContent = fmt(inputEl.value);
    } catch (_) {
      badge.textContent = String(inputEl.value);
    }
  }

  if (!badge.isConnected) {
    try {
      inputEl.insertAdjacentElement("afterend", badge);
    } catch (_) {
      if (inputEl.parentNode) inputEl.parentNode.appendChild(badge);
    }
  }
  update();

  inputEl.addEventListener("input", update);
  inputEl.addEventListener("change", update);

  inputEl.dataset.valueBadgeBound = "1";
}

/* ---------------- UI: Fullscreen ---------------- */
function isFullscreen() {
  try {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  } catch (_) {
    return false;
  }
}
function enterFullscreen() {
  try {
    const el = document.documentElement;
    if (el.requestFullscreen) return el.requestFullscreen();
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  } catch (_) {}
}
function exitFullscreen() {
  try {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  } catch (_) {}
}
function initFullscreenControl() {
  const el = document.getElementById("fullscreenToggle");
  if (!el) return;

  // Load pref (default true)
  let pref;
  try {
    pref = JSON.parse(localStorage.getItem("uiPrefs") || "{}").fullscreen;
  } catch (_) {}
  const defaultVal = typeof pref === "boolean" ? pref : true;
  try { el.checked = defaultVal; } catch (_) {}

  // Sync checkbox with current state (if user exited via ESC)
  try {
    document.addEventListener("fullscreenchange", () => {
      try { el.checked = isFullscreen(); } catch (_) {}
    });
    document.addEventListener("webkitfullscreenchange", () => {
      try { el.checked = isFullscreen(); } catch (_) {}
    });
  } catch (_) {}

  // Toggle handler
  el.addEventListener("change", () => {
    const enabled = !!el.checked;
    if (enabled && !isFullscreen()) {
      enterFullscreen();
    } else if (!enabled && isFullscreen()) {
      exitFullscreen();
    }
    try {
      const prev = JSON.parse(localStorage.getItem("uiPrefs") || "{}");
      prev.fullscreen = enabled;
      localStorage.setItem("uiPrefs", JSON.stringify(prev));
    } catch (_) {}
  });
}

/* ---------------- Utils ---------------- */
function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clamp01i(v, a, b) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(a, Number.isFinite(n) ? n : a), b);
}
