# Modules and Structure

Runtime Stack
- HTML/CSS/JS with ES Modules. No build step; static hosting is sufficient.
- Three.js (0.160.0) loaded from unpkg as an ES module.

Entry Points
- index.html imports src/main.js as the only script module.
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
- ui.js
  - UIManager: binds HUD elements, cooldown overlay elements, minimap rendering, and center message helpers.
- main.js
  - Wires everything together: creates player/enemies, houses, village ring; configures input handlers; runs the update loop.

Data Flow & Ownership
- main.js owns high-level state: player, enemies array, selection rings/aim previews, and timing for the main loop.
- Modules expose stateless helpers or small stateful managers:
  - EffectsManager owns transient/indicator groups; attached to the scene once.
  - SkillsSystem holds cooldown timestamps and storm queues; reads player/enemy states; writes cooldown UI.
  - Portals system stores references to village/return portals; exposes recall/handleFrozenPortalClick/update.
- UIManager reads player/enemies/portals to render HUD/minimap/center messages; retains DOM references.

Update Sequencing
- Player update -> Enemies update -> Camera/world -> HUD -> Skills -> Minimap -> Effects/Indicators -> Portals -> Village regen -> Death/respawn -> Render.
- dt is clamped; transient buffers disposed on expiry to avoid leaks.

Extending the Game
- New Skills: extend SKILLS in constants.js; add logic in skills.js; reuse effects.js visuals where possible.
- New Enemy Types: derive from Entity or specialize Enemy; set userData.enemyRef for raycast resolution; push instances into enemies array; ensure HP bar attachment.
- New UI: extend UIManager to bind extra elements and add per-frame update calls from main loop.

Behavior Parity
- The modular version preserves all behaviors and tuning values from the original monolithic implementation.
