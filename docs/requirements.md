# Zeus RPG — Requirements Specification (Modularized)

The original single-page requirements have been split into focused module documents under docs/requirements/. This preserves all behavior and tuning, while making it easier to reason about each system.

Overview index:
- docs/requirements/index.md

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
