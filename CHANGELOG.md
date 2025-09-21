# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Removed
- Removed 3D hero preview from Hero Screen: eliminated heroPreviewCanvas and related preview code in src/main.js.

### Fixed
- Hero Screen layout on mobile (e.g., iPhone 14 Pro Max): .hero-right now fits and scrolls properly.
  - css/hero.css: made .screen-content.hero-layout a grid to avoid flex constraints, enabled -webkit-overflow-scrolling for inner panels, wrapped/stacked loadout slots on small screens.
- Skill wheel: adjusted Q button placement to prevent overlap with the central Basic Attack button.
  - css/skills.css: moved .skill-btn.q to right:120px; bottom:48px; ensuring adequate center-to-center spacing at default (260px) and compact (220px) wheel sizes.

## [0.2.0] - 2025-09-20
### Changed
- Modularized runtime into ES modules:
  - New modules under `src/`: `config.js`, `constants.js`, `utils.js`, `meshes.js`, `entities.js`, `effects.js`, `skills.js`, `raycast.js`, `portals.js`, `ui.js`, `world.js`
  - `src/main.js` slimmed down to orchestrate modules (render loop, input wiring, sequencing)
- Ground size now sourced from `WORLD.groundSize` in `world.js` (behavior preserved; value unchanged)
- Documentation split by module:
  - `docs/requirements/` with per-system requirements and index
  - `docs/technical/` with per-system technical docs and index
- Added ADR documenting architectural decision:
  - `docs/adr/0001-modularize-es-modules.md`
- Updated top-level docs to point to new modular indexes:
  - `docs/requirements.md`
  - `docs/technical.md`

### Notes
- No gameplay behavior or tuning changes; this is a behavior-preserving refactor for maintainability, testability, and clarity.

## [0.1.0] - 2025-09-20
### Refactored
- Extracted helper `getNearestEnemy(origin, maxDist)` to centralize nearest-enemy search and remove duplicated loops.
- Extracted `handleFrozenPortalClick()` to de-duplicate portal travel handling while the player is frozen after recall, used by both left and right mouse handlers.
- Added JSDoc for `tryBasicAttack(attacker, target)` clarifying behavior and return type.
- Naming and inline comments aligned with `.clinerules/refactor.md`.
- No gameplay behavior changes.

### Documentation
- Added `docs/requirements.md` describing functional and non-functional requirements, controls, acceptance criteria, and a smoke-test checklist.
- Added `docs/technical.md` explaining architecture, subsystems (renderer/scene/camera, input, AI, combat, VFX, HUD/minimap, portals/recall, update loop), helpers, and extensibility notes.
- Updated `README.md` with quick start, controls, gameplay overview, links to requirements and technical docs, and testing guidance.
