# ADR 0001: Modularize Runtime into ES Modules

## Status
- Accepted

## Context
The game previously lived in a single monolithic file (src/main.js). As features grew (entities, skills, AI, VFX, portals, UI, camera, update loop), the file became difficult to navigate and modify safely.  
Project guidelines in .clinerules/document.md call for keeping documentation up to date and creating ADRs for architectural pattern changes, and .clinerules/refactor.md emphasizes readability and maintainability without changing behavior.

Goals:
- Improve maintainability and clarity via separation of concerns.
- Preserve runtime behavior and tuning values.
- Organize requirements/technical docs to map directly to runtime modules.

Constraints:
- No build step (ES modules loaded directly via a static server).
- Behavior preservation (no gameplay changes).

## Decision
Split the runtime into focused ES modules and update documentation accordingly:

Code modules (src/):
- config.js — runtime flags (DEBUG, HERO_MODEL_URL)
- constants.js — COLOR, WORLD, STATS_BASE, SKILLS, VILLAGE_POS, REST_RADIUS
- utils.js — math/time helpers, worldToMinimap, makeNoiseTexture
- meshes.js — createZeusMesh, createEnemyMesh, createBillboardHPBar, createPortalMesh, createHouse
- entities.js — Entity, Player, Enemy, getNearestEnemy, handWorldPos
- effects.js — EffectsManager, createGroundRing
- skills.js — SkillsSystem (cooldowns, basic attack, Q/W/E/R)
- raycast.js — createRaycast helpers (ground/enemy/player)
- portals.js — initPortals (recall flow, portal spin, teleport)
- ui/hud.js — UIManager (HUD, cooldown overlays, minimap, center messages)
- ui/guide.js, ui/settings/index.js, ui/hero/index.js — Modular UI screens (guide, settings, hero)
- world.js — initWorld, updateCamera, updateGridFollow, addResizeHandler
- main.js — orchestration, input wiring, per-frame update order

Docs (split by module):
- docs/requirements/* and docs/technical/* map 1:1 to modules; index pages reference all sections.

## Consequences
Positive
- Clear separation of concerns; faster onboarding and safer edits.
- Documentation mirrors code layout, improving traceability.
- Enables unit testing of pure helpers and small systems.

Negative
- More files to browse; requires consistent import paths.
- Slight overhead in coordinating cross-module state (e.g., shared player/enemies/effects instances).
- Requires serving via a static server to load ES modules (no file://).

Neutral
- No gameplay behavior/tuning changes; all values preserved.
- Asset loading and DOM structure unchanged.

## Alternatives Considered
- Keep monolith:
  - Pros: Single file simplicity.
  - Cons: Poor maintainability; higher risk during changes.
- Introduce a bundler (e.g., Vite/Webpack/Rollup):
  - Pros: Alias support, tree-shaking, dev server niceties.
  - Cons: Increases toolchain complexity; contradicts “no build step” constraint.
- Namespacing inside one file (IIFE/modules pattern without splitting):
  - Pros: Minimal file changes.
  - Cons: Limited clarity; still a very large file.

## Related ADRs
- N/A (first ADR for modularization)

## References
- .clinerules/document.md
- .clinerules/refactor.md
- docs/requirements/* (modular)
- docs/technical/* (modular)
