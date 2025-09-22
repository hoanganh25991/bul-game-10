# Zeus RPG — Technical Architecture (Modularized)

The original single-page technical architecture document has been split into focused module documents under docs/technical/. This preserves behavior and tuning while making each system easier to reason about and evolve.

Overview index:
- docs/technical/index.md

Module docs:
- Modules and Source Structure: docs/technical/modules-and-structure.md
- Utilities, Config, and Constants: docs/technical/utils-and-config.md
- World & Rendering: docs/technical/world.md
- Entities (Player, Enemy): docs/technical/entities.md
- Input & Raycasting: docs/technical/input-and-raycast.md
- Combat & Skills (Cooldowns): docs/technical/combat-and-skills.md
- AI (Aggro, Wander, Attack): docs/technical/ai.md
- VFX & Indicators (Transient Effects): docs/technical/vfx-and-indicators.md
- HUD & Minimap: docs/technical/ui-and-minimap.md
- Portals, Recall, Respawn: docs/technical/portals-and-respawn.md
- Camera & Movement: docs/technical/camera-and-movement.md
- Update Loop: docs/technical/update-loop.md
- Audio System: docs/technical/audio.md
- Leveling & Progression: docs/technical/leveling.md

Notes:
- These documents map 1:1 to the runtime modules in src/.
- Behavior is unchanged from the original single-module implementation; only structure and documentation organization were refactored for maintainability.
- Additional docs included: Audio System and Leveling & Progression. Mobile/touch input, i18n/localization, and persistence updates are documented in the relevant module pages.
