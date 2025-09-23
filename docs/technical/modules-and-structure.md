# Modules and Structure

Runtime Stack
- HTML/CSS/JS with ES Modules. No build step; static hosting is sufficient.
- Three.js (0.160.0) loaded from unpkg as an ES module.

Entry Points
- index.html imports src/main.js as the primary script module. A startup splash (src/splash.js) may run first to show loading and then hand off to main.
- src/main.js orchestrates all systems; no global variables are required outside modules.

Source Modules (src/)
- config.js
  - Runtime flags: DEBUG (from URL ?debug), HERO_MODEL_URL (from URL ?model).
- constants.js
  - COLOR palette, WORLD tuning, STATS_BASE, SKILLS config, VILLAGE_POS, REST_RADIUS.
- utils.js
  - Pure helpers: clamp01, lerp, randRange, distance2D, dir2D, now, worldToMinimap, makeNoiseTexture.
- world.js
  - initWorld(): sets up renderer, scene, camera, lights, ground; returns handles.
  - updateCamera(), updateGridFollow(), addResizeHandler().
- meshes.js
  - Geometry factories: createZeusMesh(), createEnemyMesh(), createBillboardHPBar(), createPortalMesh(), createHouse().
- entities.js
  - Entity base class; Player and Enemy classes; getNearestEnemy(); handWorldPos(player).
- effects.js
  - EffectsManager for transient beams/strikes and indicator groups.
  - createGroundRing() utility.
- skills.js
  - SkillsSystem: manages cooldowns, basic attack, Q/W/E/R, Static Field tick, Thunderstorm scheduling, cooldown UI updates.
- raycast.js
  - createRaycast(): shared Raycaster with helpers for ground, player/enemy selection, and enemy resolution.
- portals.js
  - initPortals(scene): manages fixed village portal, return portal spawning/linking, frozen click handling, and ring spin update.
- ui/hud.js
  - UIManager: binds HUD elements, cooldown overlay elements, minimap rendering, and center message helpers.
- ui/guide.js, ui/settings/index.js, ui/hero/index.js
  - Modular UI screens/controllers (guide overlay, settings screen, hero screen).
- touch.js
  - Virtual joystick and mobile gestures: movement on bottom-left, skill radial interactions on bottom-right (center basic attack, Q/W/E/R around).
  - Hold-to-cast handling and AOE placement via mini-joystick drag on skill buttons.
- maps.js
  - Map segment and gating helpers (MAP 1, MAP 2, ...), thresholds to unlock next maps, palette/variant hooks for enemy color/model and strength ramps.
- villages.js
  - Procedural village generation when traveling far from origin; scalable size/complexity.
  - Village portals, naming/gates, fence ring barrier, and curved/connected road generation between villages.
- splash.js
  - Full-screen splash/intro; shows loading progress (min 1s), then reveals Start button to enter the game.
- i18n.js (+ locales/)
  - Dynamic language loading from src/locales/en.json and vi.json; persists language choice; fallback returns key strings before load.
- input/input_service.js
  - Keyboard/mouse input service (renamed from service.js): arrows movement, A basic attack (hold supported), Space quick-cast, camera toggle, etc.
- main.js
  - Wires everything together: creates player/enemies, houses, village fence; configures input handlers (keyboard/mouse/touch); runs the update loop.

Data Flow & Ownership
- main.js owns high-level state: player, enemies array, current map, selection/aim indicators, and timing for the main loop.
- Modules expose stateless helpers or small stateful managers:
  - EffectsManager owns transient/indicator groups; attached to the scene once.
  - SkillsSystem holds cooldown timestamps and storm queues; reads player/enemy states; writes cooldown UI.
  - Portals system stores references to village/return portals; exposes recall/handleFrozenPortalClick/update and nearest-portal queries.
  - Maps/Villages manage unlock thresholds, village registry, and road/fence meshes.
  - Touch input translates joystick/skill radial gestures into the same orders used by keyboard/mouse.
- UIManager (src/ui/hud.js) reads player/enemies/portals to render HUD/minimap/center messages; retains DOM references.
- Full-screen panels (Guide/Settings/Hero) are implemented as separate modules under src/ui/*.

Update Sequencing
- Player update -> Enemies update -> Camera/world -> HUD -> Skills -> Minimap -> Effects/Indicators -> Portals -> Village regen -> Death/respawn -> Render.
- dt is clamped; transient buffers disposed on expiry to avoid leaks.

Extending the Game
- New Skills: extend SKILLS in constants.js; add logic in skills.js; reuse effects.js visuals where possible.
- New Enemy Types: derive from Entity or specialize Enemy; set userData.enemyRef for raycast resolution; push instances into enemies array; ensure HP bar attachment.
- New UI: extend UIManager to bind extra elements and add per-frame update calls from main loop.

Behavior Parity
- The modular version preserves all behaviors and tuning values from the original monolithic implementation.
