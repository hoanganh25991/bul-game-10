# GoT RPG — Requirements Specification (Modularized)

The original single-page requirements have been split into focused module documents under memory_bank/docsrequirements/. This preserves all behavior and tuning, while making it easier to reason about each system.

Overview index:
- memory_bank/docsrequirements/index.md

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

Module requirements:
- World & Rendering: memory_bank/docsrequirements/world.md
- Entities (Player & Enemy): memory_bank/docsrequirements/entities.md
- Input & Raycasting: memory_bank/docsrequirements/input-and-raycast.md
- Combat & Skills: memory_bank/docsrequirements/combat-and-skills.md
- AI (Aggro, Wander, Attack): memory_bank/docsrequirements/ai.md
- VFX & Indicators: memory_bank/docsrequirements/vfx-and-indicators.md
- HUD & Minimap: memory_bank/docsrequirements/ui-and-minimap.md
- Portals, Recall, Village, Respawn: memory_bank/docsrequirements/portals-and-respawn.md
- Camera & Movement: memory_bank/docsrequirements/camera-and-movement.md
- Update Loop Orchestration: memory_bank/docsrequirements/update-loop.md

Cross-cutting and reference:
- Non-Functional Requirements: memory_bank/docsrequirements/non-functional.md
- Acceptance Criteria: memory_bank/docsrequirements/acceptance.md
- Controls Quick Reference: memory_bank/docsrequirements/controls.md
- Test Checklist (Smoke): memory_bank/docsrequirements/smoke-tests.md

Note: These documents are behavior-preserving refactors of the previous content, now organized by system for maintainability.
