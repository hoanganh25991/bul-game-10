# Acceptance Criteria — End-to-End

Gameplay
- Player can move with right‑click and attack enemies when in range.
- S key stops current orders and briefly suppresses auto‑acquire.
- A key enters attack‑aim: left‑click enemy to attack, or ground to attack‑move.

Skills
- Q/W/E/R perform as specified:
  - Q: Chains across nearby enemies within range; applies damage on each hop.
  - W: Shows aim ring; on cast, damages and slows enemies in radius.
  - E: Toggles aura; ticks periodically, drains MP per tick, deactivates on no MP or time expiry.
  - R: Spawns random strikes over time; damages enemies in local radius; small camera shake.
- Cooldown overlays update wedges and countdowns continuously and flash on ready.

UI & Minimap
- HUD shows accurate HP/MP/XP/Level values and updates smoothly.
- Minimap shows player, enemies, village ring, and portals relative to player at center.

World & Camera
- Ground recenters and UVs offset as player moves (endless‑world feel).
- Camera follows smoothly with mild movement look‑ahead and brief shakes on big strikes.
- Window resize keeps canvas size/aspect correct.

Portals, Recall, Respawn
- Pressing B spawns/refreshes a return portal and freezes the player with message prompt.
- Clicking the return portal (or near it) teleports to village; player unfreezes.
- Player death shows message and respawns at village after a short delay with brief invulnerability.

Stability
- No runtime errors in the browser console during normal play.
