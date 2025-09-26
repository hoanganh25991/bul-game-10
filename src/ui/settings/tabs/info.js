/**
 * Settings -> Info tab
 * Shows live FPS and renderer stats from three.js, plus WebGL context info.
 */
export function renderInfoTab(panelEl, ctx = {}) {
  const { renderer, getPerf } = ctx;
  if (!panelEl || panelEl.dataset.rendered === "1") return;

  // Require static markup in index.html (css/info.css provides styles).
  // The shell should be present in the HTML; if it's missing, do nothing.
  if (!panelEl.querySelector(".perf-block")) {
    return;
  }

  // Query elements
  const el = (id) => panelEl.querySelector(id);
  const $fps = el("#perfFps");
  const $fpsLow = el("#perfFpsLow");
  const $avg = el("#perfAvgMs");
  const $ms = el("#perfMs");
  const $calls = el("#perfCalls");
  const $tris = el("#perfTriangles");
  const $lines = el("#perfLines");
  const $pts = el("#perfPoints");
  const $geoms = el("#perfGeoms");
  const $tex = el("#perfTex");

  const $api = el("#glApi");
  const $aa = el("#glAA");
  const $power = el("#glPower");
  const $vendor = el("#glVendor");
  const $renderer = el("#glRenderer");

  // Static WebGL capability info
  try {
    if (renderer) {
      const caps = renderer.capabilities || {};
      const gl = renderer.getContext && renderer.getContext();
      const attrs = (gl && gl.getContextAttributes && gl.getContextAttributes()) || {};
      let vendor = "Unknown";
      let rendererName = "Unknown";
      try {
        const ext = gl && gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
        vendor = gl && gl.getParameter && gl.getParameter(ext && ext.UNMASKED_VENDOR_WEBGL || (gl && gl.VENDOR)) || vendor;
        rendererName = gl && gl.getParameter && gl.getParameter(ext && ext.UNMASKED_RENDERER_WEBGL || (gl && gl.RENDERER)) || rendererName;
      } catch (_) {}

      if ($api) $api.textContent = caps.isWebGL2 ? "WebGL2" : "WebGL1";
      if ($aa) $aa.textContent = attrs.antialias ? "on" : "off";
      if ($power) $power.textContent = (renderer.getContext && renderer.getContext().getContextAttributes && renderer.getContext().getContextAttributes().powerPreference) || "high-performance";
      if ($vendor) $vendor.textContent = String(vendor);
      if ($renderer) $renderer.textContent = String(rendererName);
    }
  } catch (_) {}

  // Live update loop
  function round(n, d = 0) {
    const m = Math.pow(10, d);
    return Math.round((Number.isFinite(n) ? n : 0) * m) / m;
  }
  function update() {
    try {
      const perf = typeof getPerf === "function" ? getPerf() : (window.__perfMetrics || null);
      if (perf) {
        if ($fps) $fps.textContent = String(round(perf.fps || 0, 1));
        if ($fpsLow) $fpsLow.textContent = String(round(perf.fpsLow1 || 0, 1));
        if ($avg) $avg.textContent = `${round(perf.avgMs || perf.ms || 0, 2)} ms`;
        if ($ms) $ms.textContent = `${round(perf.ms || perf.avgMs || 0, 2)} ms`;

        const ri = perf.renderer || {};
        if ($calls) $calls.textContent = String(ri.calls || 0);
        if ($tris) $tris.textContent = String(ri.triangles || 0);
        if ($lines) $lines.textContent = String(ri.lines || 0);
        if ($pts) $pts.textContent = String(ri.points || 0);
        if ($geoms) $geoms.textContent = String(ri.geometries || (renderer?.info?.memory?.geometries || 0));
        if ($tex) $tex.textContent = String(ri.textures || (renderer?.info?.memory?.textures || 0));
      }
    } catch (_) {}
  }

  // Bind interval once
  if (panelEl.dataset.bound !== "1") {
    const intv = setInterval(update, 300);
    // Store cleanup
    panelEl.dataset.bound = "1";
    panelEl.dataset.intv = String(intv);
    // Best-effort cleanup when panel removed
    const obs = new MutationObserver(() => {
      if (!document.body.contains(panelEl)) {
        try { clearInterval(Number(panelEl.dataset.intv)); } catch (_) {}
        try { obs.disconnect(); } catch (_) {}
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  panelEl.dataset.rendered = "1";
  // Initial paint
  try { update(); } catch (_) {}
}
