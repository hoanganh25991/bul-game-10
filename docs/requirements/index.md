# Zeus RPG — Requirements by Module

This folder breaks the monolithic requirements into focused module specifications. Each document contains user-facing requirements and acceptance criteria relevant to that module. Behavior and tuning values remain identical to the original requirements.md.

Highlights (synced from todo.md)
- Mobile/touch controls: virtual joystick, radial skills layout with hold-to-cast; cooldown label hides at 0; minimap moved below the top-right button group; portal button above skills radial.
- Keyboard: A is immediate basic attack with hold-to-repeat; Arrow Keys move; Space quick-casts ready skills; camera toggle button; attack-aim mode removed.
- Portals: 3→2→1 auto-teleport to nearest village portal; vertical green gate with inner swirl visual; countdown overlay.
- World: new villages appear as you travel; protective fence ring; curved, connected roads; multi-map progression (MAP 1, 2, …) with level-based gating and travel.
- AI: higher enemy density with fast respawn for “hunter”-style gameplay; melee/ranged variants and size differences; enemies don’t use thunder effects.
- Combat: basic attack range increased (~3×); W AOE has touch placement via mini-joystick drag; thunder-themed skills exclusive to the player.
- Camera: first-person mode toggle with two-hands overlay; faster stop response (~0.1s).
- Audio: procedural SFX and ambient music via WebAudio (no external assets).
- Leveling & Persistence: level/XP persist; unlocked maps and user “marks/flags” persist; language selection persists.
- i18n & Theme: dynamic vi/en locale loading (default vi); theme uses dark blue, blue, white, yellow.

Modules:
- World & Rendering: ./world.md
- Entities (Player & Enemy): ./entities.md
- Input & Raycasting: ./input-and-raycast.md
- Combat & Skills: ./combat-and-skills.md
- AI (Aggro, Wander, Attack): ./ai.md
- VFX & Indicators: ./vfx-and-indicators.md
- HUD & Minimap: ./ui-and-minimap.md
- Portals, Recall, Village, Respawn: ./portals-and-respawn.md
- Camera & Movement: ./camera-and-movement.md
- Update Loop Orchestration: ./update-loop.md
- Non-Functional Requirements: ./non-functional.md
- Acceptance Criteria: ./acceptance.md
- Controls Quick Reference: ./controls.md
- Test Checklist (Smoke): ./smoke-tests.md

Source baseline: ../requirements.md
