/* Minimal, dependency-free WebAudio system for SFX and ambient music
   - Autoplay-safe: resume AudioContext on first user interaction
   - Procedural SFX (free): zaps, booms, hits, strikes, aura blips, etc.
   - Gentle, relaxing generative background music (focus preset)
*/
export const audio = (() => {
  let ctx = null;
  let masterGain, sfxGain, musicGain;
  let started = false;
  let enabled = true;

  const state = {
    maxSfxVoices: 24,
    activeSfx: new Set(),
    musicTimer: null,
    musicNextTime: 0,
    musicVoices: new Set(),
    musicEnabled: true,
    // Streaming background music (external track)
    streamEl: null,
    streamNode: null,
    streamActive: false,
    streamUsingWebAudio: false,
  };

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      console.warn("[audio] WebAudio not supported.");
      enabled = false;
      return null;
    }
    ctx = new AC();
    masterGain = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    // Tuned defaults (adjustable via setters)
    masterGain.gain.value = 0.9;
    sfxGain.gain.value = 0.5;
    musicGain.gain.value = 0.22;

    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    if (!ctx) ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  function init() {
    if (started) return;
    ensureCtx();
    resume();
    started = true;
  }

  // Attach autoplay-safe resume on first user gesture
  function startOnFirstUserGesture(el) {
    if (!el) el = document;
    try { attachPageVisibilityHandlers(); } catch (_) {}
    const h = () => {
      try { init(); } catch (_) {}
      try {
        el.removeEventListener("click", h, true);
        el.removeEventListener("touchstart", h, true);
        el.removeEventListener("keydown", h, true);
      } catch (_) {}
    };
    el.addEventListener("click", h, true);
    el.addEventListener("touchstart", h, true);
    el.addEventListener("keydown", h, true);
  }

  // Utilities
  function now() {
    ensureCtx();
    return ctx ? ctx.currentTime : 0;
  }

  function createNoiseBuffer(seconds = 1.0) {
    ensureCtx();
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(seconds * sampleRate));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  const shared = {
    noise1s: null,
  };

  function applyEnv(g, t0, a = 0.004, d = 0.08, s = 0.0, r = 0.08, peak = 1.0) {
    // Simple ADSR on linearGain
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.00001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    const sustainTime = t0 + a + d;
    const sustainLevel = Math.max(0, s);
    g.gain.linearRampToValueAtTime(sustainLevel, sustainTime);
    // Caller should schedule stop and ramp to 0
    return sustainTime + r;
  }

  function withVoiceCleanup(node, stopAt, collection) {
    try {
      collection.add(node);
      node.onended = () => {
        try { collection.delete(node); } catch(_) {}
      };
      node.stop(stopAt);
    } catch (_) {}
  }

  function tooManySfx() {
    return state.activeSfx.size >= state.maxSfxVoices;
  }

  // Basic building blocks
  function playZap({ freqStart = 1100, freqEnd = 420, dur = 0.12, color = "bandpass", q = 8, gain = 0.7 } = {}) {
    if (!enabled) return;
    ensureCtx(); resume();
    if (!ctx) return;
    if (tooManySfx()) return;

    const t0 = now() + 0.001;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, freqEnd), t0 + dur);

    const filt = ctx.createBiquadFilter();
    filt.type = color;
    filt.frequency.value = Math.max(200, Math.min(4000, freqStart));
    filt.Q.value = q;

    const g = ctx.createGain();
    applyEnv(g, t0, 0.002, dur * 0.7, 0.0, Math.max(0.04, dur * 0.3), gain);

    osc.connect(filt);
    filt.connect(g);
    g.connect(sfxGain);

    const stopAt = t0 + dur + 0.1;
    try { osc.start(t0); } catch(_) {}
    withVoiceCleanup(osc, stopAt, state.activeSfx);
  }

  function playNoiseBurst({ dur = 0.18, type = "lowpass", cutoff = 500, q = 0.5, gain = 0.6 } = {}) {
    if (!enabled) return;
    ensureCtx(); resume();
    if (!ctx) return;
    if (!shared.noise1s) shared.noise1s = createNoiseBuffer(1.0);
    if (tooManySfx()) return;

    const t0 = now() + 0.001;
    const src = ctx.createBufferSource();
    src.buffer = shared.noise1s;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = cutoff;
    filt.Q.value = q;

    const g = ctx.createGain();
    applyEnv(g, t0, 0.004, dur * 0.6, 0.0, Math.max(0.05, dur * 0.4), gain);

    src.connect(filt);
    filt.connect(g);
    g.connect(sfxGain);

    const stopAt = t0 + dur + 0.12;
    try { src.start(t0); } catch(_) {}
    withVoiceCleanup(src, stopAt, state.activeSfx);
  }

  function playBlip({ freq = 400, dur = 0.06, gain = 0.35 } = {}) {
    if (!enabled) return;
    ensureCtx(); resume();
    if (!ctx) return;
    if (tooManySfx()) return;

    const t0 = now() + 0.001;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);

    const g = ctx.createGain();
    applyEnv(g, t0, 0.002, dur * 0.5, 0.0, Math.max(0.03, dur * 0.5), gain);

    osc.connect(g);
    g.connect(sfxGain);

    const stopAt = t0 + dur + 0.1;
    try { osc.start(t0); } catch(_) {}
    withVoiceCleanup(osc, stopAt, state.activeSfx);
  }

  function playStrike() {
    // Bright crack: highpass noise + tiny sine ping
    playNoiseBurst({ dur: 0.12, type: "highpass", cutoff: 1200, q: 0.6, gain: 0.35 });
    playBlip({ freq: 1300, dur: 0.05, gain: 0.25 });
  }

  function playBoom() {
    // Soft boom: lowpass noise, longer decay
    playNoiseBurst({ dur: 0.28, type: "lowpass", cutoff: 380, q: 0.7, gain: 0.65 });
  }

  function sfx(name, opts = {}) {
    if (!enabled) return;
    switch (name) {
      case "basic":
        return playZap({ freqStart: 1200, freqEnd: 380, dur: 0.10, gain: 0.6, ...opts });
      case "cast":
      case "cast_aoe":
      case "cast_beam":
      case "cast_nova":
      case "cast_chain":
        return playNoiseBurst({ dur: 0.18, type: "bandpass", cutoff: 900, q: 3.2, gain: 0.4, ...opts });
      case "chain_hit":
        return playZap({ freqStart: 1400, freqEnd: 600, dur: 0.07, gain: 0.33, ...opts });
      case "beam":
        return playZap({ freqStart: 1000, freqEnd: 500, dur: 0.09, gain: 0.45, ...opts });
      case "strike":
        return playStrike();
      case "boom":
        return playBoom();
      case "aura_on":
        return playBlip({ freq: 520, dur: 0.08, gain: 0.28 });
      case "aura_off":
        return playBlip({ freq: 320, dur: 0.08, gain: 0.25 });
      case "aura_tick":
        return playBlip({ freq: 800, dur: 0.03, gain: 0.12 });
      case "player_hit":
        return playBlip({ freq: 180, dur: 0.12, gain: 0.45 });
      case "enemy_die":
        // small falling tone + soft noise tail
        playZap({ freqStart: 700, freqEnd: 180, dur: 0.16, gain: 0.35 });
        return playNoiseBurst({ dur: 0.22, type: "lowpass", cutoff: 600, q: 0.9, gain: 0.25 });
      case "storm_start":
        return playNoiseBurst({ dur: 0.55, type: "lowpass", cutoff: 300, q: 0.6, gain: 0.3 });
      default:
        // no-op
        return;
    }
  }

  // Gentle, relaxing generative music (focus)
  const scales = {
    // A minor pentatonic (focus-friendly)
    focus: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00], // A3, C4, D4, E4, G4, A4
  };

  function startMusic(preset = "focus") {
    if (!state.musicEnabled) return;
    ensureCtx(); resume();
    if (!ctx) return;
    if (state.musicTimer) return; // already running

    const scale = scales[preset] || scales.focus;
    const bpm = 48; // slow
    const beat = 60 / bpm; // seconds per beat
    const bar = beat * 4;
    const scheduleHorizon = 2.5; // seconds

    state.musicNextTime = now();

    function scheduleNote(freq, start, dur, gain = 0.05) {
      const osc = ctx.createOscillator();
      // Soft triangle/sine hybrid using two layers for richness
      osc.type = "sine";
      const det = ctx.createOscillator();
      det.type = "triangle";

      const mix = ctx.createGain();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      lp.Q.value = 0.2;

      osc.frequency.setValueAtTime(freq, start);
      det.frequency.setValueAtTime(freq * 0.5, start); // sub tone

      mix.gain.value = 0.5;
      det.connect(mix);
      osc.connect(mix);
      mix.connect(lp);
      lp.connect(g);
      g.connect(musicGain);

      // Long fade envelope
      const a = Math.min(0.2, dur * 0.25);
      const r = Math.min(0.5, dur * 0.6);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(gain, start + a);
      g.gain.linearRampToValueAtTime(gain * 0.7, start + dur - r);
      g.gain.linearRampToValueAtTime(0.0001, start + dur);

      try { osc.start(start); det.start(start); } catch(_) {}
      const stopAt = start + dur + 0.05;
      try {
        osc.stop(stopAt);
        det.stop(stopAt);
      } catch(_) {}

      // Clean-up tracking
      state.musicVoices.add(osc);
      osc.onended = () => { state.musicVoices.delete(osc); };
      state.musicVoices.add(det);
      det.onended = () => { state.musicVoices.delete(det); };
    }

    function scheduler() {
      const tNow = now();
      while (state.musicNextTime < tNow + scheduleHorizon) {
        // Every bar, pick a chord center from the scale
        const base = scale[Math.floor(Math.random() * scale.length)];
        // Schedule 2-3 overlapping slow notes per bar
        const voices = 2 + (Math.random() < 0.3 ? 1 : 0);
        for (let v = 0; v < voices; v++) {
          const pick = base * Math.pow(2, (Math.floor(Math.random() * 5) - 2) / 12); // slight spread
          const dur = bar * (1.2 + Math.random() * 0.8);
          const offset = beat * (v * 0.5 + Math.random() * 0.3);
          scheduleNote(pick, state.musicNextTime + offset, dur, 0.035 + Math.random() * 0.02);
        }
        state.musicNextTime += bar;
      }
    }

    scheduler();
    state.musicTimer = setInterval(scheduler, 300);
  }

  // Streamed music from existing URL (e.g., CC0 tracks)
  function startStreamMusic(url, opts = {}) {
    if (!state.musicEnabled) return;
    ensureCtx(); resume();
    if (!ctx) return;

    // stop generative music if running
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = null;
    }
    // stop previous stream if any
    try { stopStreamMusic(); } catch (_) {}

    const loop = opts.loop !== undefined ? !!opts.loop : true;
    const vol = typeof opts.volume === "number" ? Math.max(0, Math.min(1, opts.volume)) : 0.3;

    const el = new Audio();
    el.src = url;
    el.preload = "auto";
    el.loop = loop;
    el.crossOrigin = "anonymous";

    let usingWebAudio = false;
    try {
      const node = ctx.createMediaElementSource(el);
      node.connect(musicGain);
      el.volume = 1.0; // use musicGain for volume when connected
      state.streamNode = node;
      usingWebAudio = true;
    } catch (e) {
      // Fallback to element volume control (e.g., if no CORS)
      el.volume = vol;
      usingWebAudio = false;
      console.warn("[audio] MediaElementSource fallback (likely no CORS): using element volume");
    }

    state.streamEl = el;
    state.streamUsingWebAudio = usingWebAudio;
    state.streamActive = true;

    // If using WebAudio path, set gain based on requested volume
    if (usingWebAudio) {
      setMusicVolume(vol);
    }

    el.play().catch(() => {
      // Will succeed after a user gesture
    });
  }

  function stopStreamMusic() {
    try {
      if (state.streamEl) {
        try { state.streamEl.pause(); } catch (_) {}
        try { state.streamEl.src = ""; } catch (_) {}
      }
      if (state.streamNode) {
        try { state.streamNode.disconnect(); } catch (_) {}
      }
    } finally {
      state.streamEl = null;
      state.streamNode = null;
      state.streamActive = false;
      state.streamUsingWebAudio = false;
    }
  }

  function stopMusic() {
    if (state.musicTimer) {
      clearInterval(state.musicTimer);
      state.musicTimer = null;
    }
    // Stop all music voices
    for (const node of state.musicVoices) {
      try { node.stop(); } catch (_) {}
    }
    state.musicVoices.clear();
  }

  // Public controls
  function setEnabled(v) {
    enabled = !!v;
  }
  function setSfxVolume(v) {
    ensureCtx();
    if (sfxGain) sfxGain.gain.value = Math.max(0, Math.min(1, Number(v)));
  }
  function setMusicVolume(v) {
    ensureCtx();
    const vol = Math.max(0, Math.min(1, Number(v)));
    if (musicGain) musicGain.gain.value = vol;
    // If streaming without WebAudio connection, set element volume directly
    if (state.streamEl && !state.streamUsingWebAudio) {
      try { state.streamEl.volume = vol; } catch(_) {}
    }
  }

  // Pause/resume helpers for page focus/visibility changes
  function pauseForBackground() {
    try {
      ensureCtx();
      if (ctx && ctx.state !== "suspended") ctx.suspend();
    } catch (_) {}
    // Pause streaming element to stop network/decoding while in background
    try { if (state.streamEl) state.streamEl.pause(); } catch (_) {}
  }

  function resumeFromForeground() {
    try { ensureCtx(); resume(); } catch (_) {}
    // Resume streamed element if active
    try {
      if (state.streamEl) {
        const p = state.streamEl.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch (_) {}
  }

  // Query if any background music is currently active (stream or generative)
  function isMusicActive() {
    try {
      if (state.musicTimer) return true;
      if (state.streamEl) return !state.streamEl.paused;
    } catch (_) {}
    return false;
  }

  // Ensure background music continues to play. If a stream URL is provided:
  // - If already streaming same URL, just resume and apply volume/loop
  // - Otherwise start/restart streaming that URL.
  // If no URL is provided, resume current stream or start generative music.
  function ensureBackgroundMusic(url = null, opts = {}) {
    if (!state.musicEnabled) return;
    ensureCtx(); resume();
    if (url) {
      if (state.streamEl) {
        const same =
          typeof state.streamEl.src === "string" &&
          (state.streamEl.src.indexOf(url) !== -1 || state.streamEl.src === url);
        if (same) {
          try {
            if (typeof opts.volume === "number") setMusicVolume(opts.volume);
          } catch (_) {}
          try {
            if (opts.loop !== undefined) state.streamEl.loop = !!opts.loop;
          } catch (_) {}
          try {
            if (state.streamEl.paused) state.streamEl.play().catch(() => {});
          } catch (_) {}
        } else {
          startStreamMusic(url, opts);
        }
      } else {
        startStreamMusic(url, opts);
      }
    } else {
      if (state.streamEl) {
        try {
          if (state.streamEl.paused) state.streamEl.play().catch(() => {});
        } catch (_) {}
      } else if (!state.musicTimer) {
        startMusic();
      }
    }
  }

  function attachPageVisibilityHandlers() {
    if (state._focusHandlersAttached) return;
    state._focusHandlersAttached = true;

    const onHide = () => { pauseForBackground(); };
    const onShow = () => { resumeFromForeground(); };

    // Only react to actual page/tab visibility changes.
    // Do NOT pause on window blur/focus, which can occur during in-app UI interactions.
    try {
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "hidden") onHide();
          else onShow();
        },
        true
      );
    } catch (_) {}

    // Optionally handle page lifecycle events (e.g., bfcache)
    try { window.addEventListener("pagehide", onHide, true); } catch (_) {}
    try { window.addEventListener("pageshow", onShow, true); } catch (_) {}
  }

  return {
    init,
    startOnFirstUserGesture,
    sfx,
    startMusic,
    stopMusic,
    startStreamMusic,
    stopStreamMusic,
    setEnabled,
    setSfxVolume,
    setMusicVolume,
    pauseForBackground,
    resumeFromForeground,
    isMusicActive,
    ensureBackgroundMusic,
    attachPageVisibilityHandlers,
  };
})();
