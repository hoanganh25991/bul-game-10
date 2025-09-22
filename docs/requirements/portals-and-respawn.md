# Portals, Recall, Village, Respawn — Functional Requirements

Scope
- Player recall flow, portal linking/teleportation, village regen zone, death/respawn behavior.

Recall & Portals
- Press B (Recall):
  - Spawns or refreshes a return portal at the player’s current position.
  - Links the return portal to the fixed village portal.
  - Freezes the player (no other actions) while a visible 3 → 2 → 1 countdown runs; on 0 auto‑teleport occurs.
  - Destination is the nearest available village portal when multiple villages exist.
  - Shows center message with countdown: “Teleporting in 3… 2… 1…”.
- Portal Interaction (while frozen):
  - Clicking the portal mesh OR clicking the ground near the portal (within portal radius + small margin) teleports the player to the village portal immediately (skips remaining countdown).
  - After teleporting, player unfreezes; normal controls resume.
- Village Portal:
  - Persistently exists near the village center; visually distinct, vertical green gate motif with inner rotating swirl.
  - Portals display ring spin/animation and appear on the minimap.

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
- Pressing B creates a return portal at the player’s location, freezes the player, and a visible 3‑2‑1 countdown begins.
- On countdown reaching 0, the player auto‑teleports to the nearest village portal; player unfreezes.
- Clicking/near the return portal during frozen state teleports immediately (skips countdown) and unfreezes the player.
- The village ring provides visibly faster regen while the player is inside it.
- On death, a message shows; after the delay, the player respawns at the village with full HP/MP and brief invulnerability.
- Portals use a vertical green gate with an inner swirl; rings rotate/spin; both village and return portals appear on the minimap.
