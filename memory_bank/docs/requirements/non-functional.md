# Non-Functional Requirements

Technology
- Three.js, HTML/CSS/JavaScript.
- ES Modules; no build step required; can be served statically.
- i18n via JSON locale bundles (vi/en) dynamically loaded at runtime.

Performance
- Maintain smooth frame times.
- Clamp dt in the update loop to avoid large steps.
- Minimize allocations per frame.
- Dispose transient geometries/materials created for VFX after expiry.

Quality Tiers (applied via Settings > Quality; requires reload)
- High:
  - Default visuals on capable hardware.
  - Pixel ratio up to ~2.0; antialias on; full VFX counts and lifetimes.
  - Standard lighting/shadows; default environment density.
- Medium (balanced for mid-tier tablets/phones):
  - Pixel ratio capped ~1.25; antialias off.
  - Simpler lighting; reduce environment density by one preset step.
  - Trim particle counts and lifetimes; cap concurrent VFX to ~48; reduce far-effect distances.
  - Budget CPU-heavy work (collisions/AI) across frames to avoid spikes.
- Low (performance-first):
  - Pixel ratio capped ~1.0; antialias off.
  - Minimal lighting; disable costly post/normal effects.
  - Lowest environment density; aggressive VFX caps (~24) and shorter lifetimes.

Device Targets
- Medium quality must achieve a consistent 30+ FPS on Xiaomi Redmi Pad 6, with responsive movement and reliable skill casting.

Constraints
- Do not implement dynamic quality switching; quality changes are applied only after user confirmation and a full game reload.

Input
- All interactions via mouse and keyboard.
- Disable browser context menu on the canvas.

Visuals
- Electric beams/strikes have short lifetimes and fade.
- Ground rings and indicators are transparent and double-sided.
- Theme palette: dark blue, blue, white, yellow. System screens may use a lighter/yellow variant to contrast the battlefield.

Responsiveness
- Canvas resizes with window; camera aspect updates accordingly.
- Viewport scaling: desktop scale ≈1.0; mobile (≤ 932px) scale ≈0.75 via meta viewport.
- Mobile UI sizing: joystick and minimap reduced to ~75% of desktop size.

Persistence
- Language selection, player level/XP, unlocked maps, and teleport marks are persisted in localStorage across sessions.

Behavior Preservation
- Refactors must not change gameplay behavior or tuning values.

Acceptance (Non-Functional)
- No runtime errors in the browser console during normal play.
- Stable frame times under typical use; no unbounded memory growth over extended play sessions.
- On medium-tier devices (e.g., Xiaomi Redmi Pad 6), Medium quality achieves stable 30+ FPS with responsive movement and reliable skill casting; no noticeable input lag.
- Quality changes take effect only after in-game confirmation and reload from the Settings screen.
