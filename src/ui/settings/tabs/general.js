/**
 * General tab: audio, render quality, zoom, and fullscreen controls.
 * Wires controls within the Settings screen General panel.
 */
export function renderGeneralTab(panelEl, ctx = {}) {
  const { t, audioCtl, render } = ctx;
  if (!panelEl || panelEl.dataset.rendered === "1") return;

  try {
    initAudioControls(audioCtl);
  } catch (_) {}
  try {
    initQualitySelect(render, t);
  } catch (_) {}
  try {
    initZoomControl(render);
  } catch (_) {}
  try {
    initFullscreenControl();
  } catch (_) {}

  panelEl.dataset.rendered = "1";
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
    if (!musicToggle.dataset.bound) {
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
      musicToggle.dataset.bound = "1";
    }
  }
  if (sfxToggle) {
    try {
      sfxToggle.checked = !!audioCtl.getSfxEnabled?.();
    } catch (_) {}
    if (!sfxToggle.dataset.bound) {
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
      sfxToggle.dataset.bound = "1";
    }
  }
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
            try { location.reload(); } catch (_) {}
          }
        } else {
          try { sel.value = current; } catch (_) {}
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
  if (!el.dataset.bound) {
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
    el.dataset.bound = "1";
  }
}

/* ---------------- Utils ---------------- */
function clampNum(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
