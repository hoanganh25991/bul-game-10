/**
 * Environment tab: rain toggle, density, rain level.
 * Wires controls within the Settings screen Environment panel.
 */
export function renderEnvironmentTab(panelEl, ctx = {}) {
  const { environment } = ctx;
  if (!panelEl || !environment || panelEl.dataset.rendered === "1") return;

  try {
    initEnvironmentControls(environment);
    panelEl.dataset.rendered = "1";
  } catch (_) {}
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
    if (!envRainToggle.dataset.bound) {
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
      envRainToggle.dataset.bound = "1";
    }
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
    if (!envDensity.dataset.bound) {
      envDensity.addEventListener("change", onEnvDensityChange);
      envDensity.dataset.bound = "1";
    }
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
    if (!rainDensity.dataset.bound) {
      rainDensity.addEventListener("change", onRainDensityChange);
      rainDensity.dataset.bound = "1";
    }
  }
}

function persistEnvPrefs(rain, densityIndex, rainLevel) {
  try {
    localStorage.setItem("envPrefs", JSON.stringify({ rain: !!rain, density: densityIndex, rainLevel }));
  } catch (_) {}
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

/* ---------------- Utils ---------------- */
function clamp01i(v, a, b) {
  const n = parseInt(v, 10);
  return Math.min(Math.max(a, Number.isFinite(n) ? n : a), b);
}
