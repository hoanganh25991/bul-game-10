# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Procedural audio system (WebAudio, no external assets): SFX for basic attack, skill casts (type-specific), aura ticks, storm strikes, enemy death, and player hit; plus a relaxing generative background music loop that starts after the first user interaction (autoplay-safe).
  - New: src/audio.js
  - Hooks: src/skills.js, src/main.js

- Leveling and progression system: hero gains XP from kills, levels up with stat growth (HP, MP, regen) and base damage scaling. Configurable via SCALING in src/constants.js.
- Enemy scaling and respawn: enemies scale HP/damage per hero level and respawn after WORLD.enemyRespawnDelay to maintain density. Spawns respect village boundary.
- HUD level-up feedback and dynamic XP/Level display (already present); dispatches player-levelup event for animations.
- Documentation: docs/technical/leveling.md
- Settings screen: sliders display numeric badges for Zoom/Environment Density/Rain Density; quality changes gated by in-game confirm and full reload (renderPrefs.quality).
- Guide overlay: non-blocking, auto-closes Settings while active, reopens on exit; localized via i18n; persists language.
- Hero Skills Preview overlay: in-game key selection (Q/W/E/R) replaces native prompt for assignment; countdown+cast flow with persistence.

### Changed
- Mobile UI scale for small screens (≤ 932px):
  - Minimap resized to 150x150 (75% of desktop 200x200).
  - Joystick (container/base/knob) scaled to 75% with recentered knob to reduce overlap and improve ergonomics.
   - Files: css/hud.css, css/mobile.css.

- Basic attack now scales with hero level via Player.baseDamage; Q (Chain) and Beam skills scale with level; AOE/Nova/Aura/Storm remain fixed for pacing.
- Introduced SCALING knobs in src/constants.js (hero/enemy growth, xp growth, skill scaling toggle) and WORLD.enemyRespawnDelay.
- Controls: added M to place a flag (persistent; 3 min cooldown); updated Controls and Input docs.
- Settings: quality change now prompts with native in-game confirm and reloads on confirm; no dynamic switching.
- Non-Functional: defined quality tiers (High/Medium/Low) with device target (Xiaomi Redmi Pad 6 30+ FPS); switching requires reload.
- Technical Docs: added docs/technical/ui-screens.md; updated utils-and-config with envPrefs/renderPrefs/audioPrefs.

- Map thumbnails now use deterministic emoji icons for all maps; removed image URLs from src/maps.js; UI renders large emoji in 64x64 thumbs.
### Removed
- Removed 3D hero preview from Hero Screen: eliminated heroPreviewCanvas and related preview code in src/main.js.

### Fixed
- Hero Screen layout on mobile (e.g., iPhone 14 Pro Max): .hero-right now fits and scrolls properly.
  - css/hero.css: made .screen-content.hero-layout a grid to avoid flex constraints, enabled -webkit-overflow-scrolling for inner panels, wrapped/stacked loadout slots on small screens.
- Skill wheel: remapped positions and spacing to improve ergonomics and prevent overlap.
  - css/skills.css: Q → former R (right:208px; bottom:24px), R → top-right slot (right:32px; bottom:148px), W → former E (right:148px; bottom:100px), E → adjusted (right:120px; bottom:36px).
- Camera button placement: moved Camera toggle to the top-right cluster with Settings and Hero (index.html).

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
