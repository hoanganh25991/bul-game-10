# Zeus RPG — Technical Architecture (Modular)

This folder refactors the original single technical.md into module-focused pages. It mirrors the runtime modules in src/ and explains responsibilities, data flow, and extension points. Behavior and tuning remain unchanged.

Overview
- Runtime Stack and Entry: ./modules-and-structure.md
- Utilities, Config, Constants: ./utils-and-config.md
- World & Rendering: ./world.md
- Entities (Player, Enemy): ./entities.md
- Input & Raycasting: ./input-and-raycast.md
- Combat & Skills (Cooldowns): ./combat-and-skills.md
- AI (Aggro, Wander, Attack): ./ai.md
- VFX & Indicators (Transient Effects): ./vfx-and-indicators.md
- HUD & Minimap: ./ui-and-minimap.md
- Portals, Recall, Respawn: ./portals-and-respawn.md
- Camera & Movement: ./camera-and-movement.md
- Update Loop: ./update-loop.md
- Audio System: ./audio.md
- Leveling & Progression: ./leveling.md
- Debug Parameters: ./debug.md

Key Mapping (src -> docs)
- src/world.js -> ./world.md
- src/entities.js -> ./entities.md
- src/raycast.js, input in src/main.js -> ./input-and-raycast.md
- src/skills.js -> ./combat-and-skills.md
- src/meshes.js, src/effects.js -> ./vfx-and-indicators.md
- src/ui/hud.js -> ./ui-and-minimap.md
- src/ui/guide.js, src/ui/settings/index.js, src/ui/hero/index.js -> UI screens under src/ui/*
- src/portals.js -> ./portals-and-respawn.md
- src/world.js (camera), src/main.js (movement) -> ./camera-and-movement.md
- src/main.js (sequence) -> ./update-loop.md
- src/utils.js, src/config.js, src/constants.js, src/i18n.js -> ./utils-and-config.md
- src/audio.js -> ./audio.md

Extensibility
- Add skills by extending src/skills.js and SKILLS config; prefer reusing VFX helpers.
- Add enemy types by extending Entity/Enemy and wiring userData for raycast resolution.
- UI additions should hook into UIManager (src/ui/hud.js) and update per frame where needed. Modular UI screens live under src/ui/* (guide, settings, hero).

Behavior Preservation
- All refactors preserve game behavior and tuning values from the original single module.
