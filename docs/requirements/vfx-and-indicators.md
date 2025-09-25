# VFX & Indicators — Functional Requirements

Scope
- Transient electric beams/strikes and ground rings.
- Visual indicators for selection, aim previews, debuffs, and pings.

Transient Effects
- Electric beams:
  - Straight and jagged variants; multi‑pass variant scales thickness with distance.
  - Short lifetimes; fade out and dispose geometry/materials on expiry.
  - Occasional forks on longer beams for visual richness.
- Strikes:
  - Vertical lightning strike from above to a ground point.
  - Optional radial mini‑beams/sparks from the impact center.

Ground Rings
- Reusable ring mesh used for selection, aim, slow debuffs, and move/target pings.
- Rings are double‑sided, transparent, and rotate subtly while visible.

Indicators
- Selection ring:
  - Follows the currently selected unit.
  - Color reflects team: blue for player, red for enemy.
- Aim previews:
  - W AOE ring follows the ground point under the mouse while in aim mode.
  - Attack aim reticle follows hovered enemy or ground.
- Debuff ring:
  - A visible ring under enemies slowed by W skill while the debuff lasts.
- Pings:
  - Move ping on ground‑right‑click; target ping when setting an enemy target.

Hand Micro‑Sparks
- While any skill is off cooldown (ready), small micro‑sparks occasionally arc around GoT’ right hand.

Acceptance Criteria
- Electric beams and strikes are short‑lived and visually distinct.
- Selection/aim/debuff rings appear/disappear appropriately and follow their targets.
- Move/target pings appear briefly at the correct world positions.
- Hand micro‑sparks appear intermittently when at least one skill is ready.
- No lingering/transient meshes remain after expiry; resources are cleaned up.
