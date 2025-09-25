# GoT RPG (Three.js Top‑Down Action/RTS‑like Prototype)

A lightweight prototype featuring DOTA‑style controls, electric abilities, simple AI, HUD/minimap, portals/recall, and a village regen zone — implemented as modular ES modules with Three.js.

- Live demo entry: index.html
- Orchestrator: src/main.js
- Styles: src/style.css
- Three.js: loaded as an ES module from unpkg

Documentation:
- Requirements (modular index): docs/requirements/index.md
- Technical Architecture (modular index): docs/technical/index.md
- ADRs: docs/adr/
- Changelog: CHANGELOG.md
- Audio System: docs/technical/audio.md

## Quick Start

This project is static (no build step). Serve the root directory with any static file server to enable ES module imports.

Examples:
- Python 3
  - macOS/Linux: `python3 -m http.server 8000`
  - Windows (with Python): `py -3 -m http.server 8000`
- Node (http-server): `npx http-server -p 8000`
- VSCode: Use the “Live Server” extension, open index.html, click “Go Live”.

Then open:
- http://localhost:8000 (or the port you chose)
- Optional flags:
  - `?debug=1` enables convenience left‑click‑to‑move on ground for faster iteration.
  - `?model=URL` attempts to load an external GLTF/GLB hero model (placeholder hidden on success), auto‑scaled to ~2.2 units.

## Controls

Mouse
- Left Click: Select hero or enemy. In debug mode, left‑click ground to move.
- Right Click: Move to ground or attack a clicked enemy.

Keyboard
- Q: Chain Lightning
- W: Lightning Bolt (AOE auto-cast)
- E: Static Field (toggle aura)
- R: Thunderstorm (duration strikes)
- B: Recall (spawn return portal; click portal to travel to village)
- S: Stop (clear orders and briefly suppress re‑acquire)

## Audio

- Background music: relaxing, generative loop (focus-friendly). Starts after first user interaction (autoplay-safe).
- SFX events: basic attack, cast skill (type-specific), skill effects (chain hits, beam impact, boom for AOE/Nova, aura ticks, storm strikes), enemy death, and player hit.
- Controls (DevTools console):
  - `audio.setMusicVolume(0..1)`, `audio.setSfxVolume(0..1)`, `audio.setEnabled(true|false)`
  - `audio.startMusic()`, `audio.stopMusic()`
- Implementation: `src/audio.js` (procedural WebAudio; no external assets). See docs/technical/audio.md.

## Gameplay Overview

- Player (GoT) moves with RTS‑style orders and auto‑attacks when in range.
- Enemies aggro, chase, attack, or wander when idle.
- Four skills with cooldowns and mana:
  - Q Chain Lightning (chains targets in range)
  - W Lightning AOE (damages + applies slow)
  - E Static Field Aura (periodic ticks, drains mana)
  - R Thunderstorm (random strikes over time)
- HUD shows HP/MP/XP/Level; cooldown wedges display time remaining.
- Minimap shows player, enemies, village ring, and portals.
- Recall (B) spawns a return portal; click it to travel to the village; regen is boosted in the village ring.
- On death, auto‑respawn in the village after a short delay.

## Project Structure

- index.html — page shell, HUD/minimap DOM
- src/main.js — orchestrator (render loop, input wiring, sequencing)
- src/style.css — basic UI styling
- src/config.js — runtime flags (DEBUG, HERO_MODEL_URL)
- src/constants.js — COLOR, WORLD, STATS_BASE, SKILLS, VILLAGE_POS, REST_RADIUS
- src/utils.js — math/time helpers, worldToMinimap, makeNoiseTexture
- src/meshes.js — createGoTMesh, createEnemyMesh, createBillboardHPBar, createPortalMesh, createHouse
- src/entities.js — Entity, Player, Enemy, getNearestEnemy, handWorldPos
- src/effects.js — EffectsManager (transients/indicators), createGroundRing
- src/skills.js — SkillsSystem (cooldowns, basic attack, Q/W/E/R, ticks)
- src/raycast.js — createRaycast (ground/enemy/player helpers)
- src/portals.js — initPortals (recall flow, portal spin, teleport)
- src/ui.js — UIManager (HUD, cooldown overlays, minimap, center messages)
- src/world.js — initWorld, updateCamera, updateGridFollow, addResizeHandler
- src/audio.js — WebAudio helper (procedural SFX + music)

Documentation (by module):
- See docs/requirements/ and docs/technical/ for per‑system pages and indices.
- Architectural Decision: docs/adr/0001-modularize-es-modules.md

## Development Notes

- ES Modules only; no bundler required.
- Three.js imported from unpkg as an ES module; ensure you use a static server (file:// won’t load modules).
- Refactor and maintenance guidelines: see .clinerules/refactor.md and .clinerules/document.md.
- Known limitations: no pathfinding, desktop mouse/keyboard only, stylized placeholder visuals.

## Testing and Verification

- Quick smoke test (full list: docs/requirements/smoke-tests.md):
  - Load the page and verify the scene renders and HUD/minimap appear.
  - Move with right‑click; attack enemies; observe HP bars.
  - Cast Q/W/E/R and verify visuals, cooldowns, and mana drain.
  - Use B recall and click the portal; verify village regen.
  - Die and confirm respawn at the village.
- Additional technical pointers:
  - Unit-test pure helpers (distance2D, dir2D, nearest enemy logic)
  - Integration: input → state transitions; cooldown correctness
  - E2E: critical flows for skills, recall/portals, respawn

## Credits

Developed with passion by the Monk Journey team.

## License

Copyright © 2025 Monk Journey Team. All Rights Reserved.

This project is proprietary and confidential. Unauthorized reproduction, distribution, or disclosure is prohibited. No license, express or implied, to any intellectual property rights is granted by this document.

See the [LICENSE](LICENSE) file for full details.
