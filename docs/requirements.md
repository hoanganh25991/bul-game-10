# Zeus RPG — Requirements Specification (Modularized)

The original single-page requirements have been split into focused module documents under docs/requirements/. This preserves all behavior and tuning, while making it easier to reason about each system.

Overview index:
- docs/requirements/index.md

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
- World & Rendering: docs/requirements/world.md
- Entities (Player & Enemy): docs/requirements/entities.md
- Input & Raycasting: docs/requirements/input-and-raycast.md
- Combat & Skills: docs/requirements/combat-and-skills.md
- AI (Aggro, Wander, Attack): docs/requirements/ai.md
- VFX & Indicators: docs/requirements/vfx-and-indicators.md
- HUD & Minimap: docs/requirements/ui-and-minimap.md
- Portals, Recall, Village, Respawn: docs/requirements/portals-and-respawn.md
- Camera & Movement: docs/requirements/camera-and-movement.md
- Update Loop Orchestration: docs/requirements/update-loop.md

Cross-cutting and reference:
- Non-Functional Requirements: docs/requirements/non-functional.md
- Acceptance Criteria: docs/requirements/acceptance.md
- Controls Quick Reference: docs/requirements/controls.md
- Test Checklist (Smoke): docs/requirements/smoke-tests.md

Note: These documents are behavior-preserving refactors of the previous content, now organized by system for maintainability.
