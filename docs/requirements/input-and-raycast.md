# Input & Raycasting — Functional Requirements

Scope
- Mouse and keyboard controls for RTS-like interaction.
- Raycasting helpers to select ground, player, and enemies intuitively.

Mouse
- Right-click:
  - Move to ground point OR attack a clicked enemy (sets current target).
  - If player is frozen (recall), only allow portal interaction (clicking/near the portal teleports).
- Left-click:
  - Selection: player or enemy (for info).
  - Aim confirmation:
    - W: confirm AOE target on ground.
    - A (Attack aim): confirm enemy to attack OR ground to attack-move.
  - Debug convenience (?debug=1):
    - Left-click ground issues a move command (dev-only).
- Context menu on canvas is disabled.

Keyboard
- A: Enter “attack” aim mode; left-click enemy to attack or ground to attack-move.
- Q: Cast Chain Lightning (auto-target).
- W: Enter aim mode for Lightning Bolt AOE; left-click to place.
- E: Toggle Static Field (aura) for a set duration (consumes MP per tick).
- R: Cast Thunderstorm (random strikes over time).
- B: Recall—creates a return portal and freezes player until they click it to travel to the village.
- S: Stop—clears current orders and briefly suppresses auto-acquire.
- M: Mark — place a flag at the current location (persistent; 3 min cooldown).
- Escape: Cancel any aim mode.

Raycasting and Targeting
- Use a shared THREE.Raycaster and a horizontal ground plane (y=0).
- Helpers:
  - raycastGround(): intersect ray with ground plane; return world XZ point.
  - raycastEnemyOrGround(): prioritize enemy intersection; fall back to ground point.
  - raycastPlayerOrEnemyOrGround(): check player, then enemy, then ground for selection logic.
  - findEnemyFromObject(): walk parent chain to resolve Enemy instance from intersected mesh.
- Selection behavior:
  - Left-click selects player or enemy.
  - Selection ring shows the current selection; enemy selection is allowed for info only.
- Aim indicators:
  - W aim ring tracks the mouse ground point while in aim mode.
  - Attack aim preview tracks hovered enemy or ground position while in aim mode.

Acceptance Criteria
- Right-click moves the player to ground or sets target when clicking an enemy.
- Left-click selects player/enemy; in aim mode it confirms the target location/enemy.
- With ?debug=1, left-clicking the ground issues a move command (when not in aim or frozen).
- Aim preview rings are visible and follow the mouse while in aim modes.
- Frozen state restricts interactions to portal only during recall.
- No browser context menu appears on right-click within the canvas.
