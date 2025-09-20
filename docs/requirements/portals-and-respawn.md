# Portals, Recall, Village, Respawn — Functional Requirements

Scope
- Player recall flow, portal linking/teleportation, village regen zone, death/respawn behavior.

Recall & Portals
- Press B (Recall):
  - Spawns or refreshes a return portal at the player’s current position.
  - Links the return portal to the fixed village portal.
  - Freezes the player (no other actions) until they click the portal or near it to travel.
  - Shows center message: “Click the portal to travel to the village”.
- Portal Interaction (while frozen):
  - Clicking the portal mesh OR clicking the ground near the portal (within portal radius + small margin) teleports the player to the village portal.
  - After teleporting, player unfreezes; normal controls resume.
- Village Portal:
  - Persistently exists near the village center; visually distinct color from return portal.
  - Portals display slow ring spin/animation.

Village Regen
- A ring around origin (REST_RADIUS) indicates the village area.
- While inside the ring:
  - Apply bonus regen to player HP/MP per second, clamped at max.

Death & Respawn
- On death:
  - Disable movement/attacks; hide selection and aim behaviors as needed.
  - Show center message: “You died. Respawning…”.
  - Schedule a respawn after a short delay (e.g., 3 seconds).
- On respawn:
  - Teleport to village, restore HP/MP to full.
  - Apply brief invulnerability window.
  - Clear any current orders and targets.
  - Clear center message.

Acceptance Criteria
- Pressing B creates a return portal at the player’s location and freezes the player.
- Clicking/near the return portal teleports to the village portal and unfreezes the player.
- The village ring provides visibly faster regen while the player is inside it.
- On death, a message shows; after the delay, the player respawns at the village with full HP/MP and brief invulnerability.
- Portals visibly rotate/spin; both village and return portals appear on the minimap.
