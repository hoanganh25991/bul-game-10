# Non-Functional Requirements

Technology
- Three.js, HTML/CSS/JavaScript.
- ES Modules; no build step required; can be served statically.

Performance
- Maintain smooth frame times.
- Clamp dt in the update loop to avoid large steps.
- Minimize allocations per frame.
- Dispose transient geometries/materials created for VFX after expiry.

Input
- All interactions via mouse and keyboard.
- Disable browser context menu on the canvas.

Visuals
- Electric beams/strikes have short lifetimes and fade.
- Ground rings and indicators are transparent and double-sided.

Responsiveness
- Canvas resizes with window; camera aspect updates accordingly.

Behavior Preservation
- Refactors must not change gameplay behavior or tuning values.

Acceptance (Non-Functional)
- No runtime errors in the browser console during normal play.
- Stable frame times under typical use; no unbounded memory growth over extended play sessions.
