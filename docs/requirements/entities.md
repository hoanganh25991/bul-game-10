# Entities (Player & Enemy) — Functional Requirements

Scope
- Defines data, stats, and visual primitives for Player (GoT) and Enemy units.
- Behavior-only specs; AI logic is defined separately in ./ai.md.

Base Entity
- Each entity has:
  - mesh: THREE.Object3D root
  - team: "player" | "enemy" | "neutral"
  - radius (approx collision/selection size)
  - hp/maxHP; alive state
  - takeDamage(amount): reduces HP; on 0 HP:
    - sets alive=false
    - hides mesh
    - invokes onDeath if provided

Player (GoT)
- Visuals:
  - Mesh composed in blue/white/dark-blue tones
  - Optional GLTF model load via URL parameter (?model=URL) with auto-scaling to ~2.2 units height; hides placeholder when loaded
  - A point light and emissive orb at right hand; subtle idle pulsing
- Stats and Leveling:
  - HP/MP current and caps; regeneration (hpRegen/mpRegen)
  - XP and Level; leveling increases:
    - maxHP (~+12%), maxMP (~+10%), hpRegen (~+8%), mpRegen (~+6%), xpToLevel (~+20%) each level
  - xpToLevel initial baseline defined in constants
- Movement:
  - moveTarget vector; speed and turnSpeed configured via WORLD
  - attackMove flag (see input/aim in ./input-and-raycast.md)
- Combat State:
  - target (Enemy|null)
  - per-attacker basic attack cooldown (nextBasicReady)
  - invulnerability window (invulnUntil) after respawn
- Control/Aim:
  - aimMode and aimModeSkill for placing skills (W, ATTACK)
- Other State:
  - idlePhase (visual pulse), braceUntil (brief squash on basic attack), frozen (recall), holdUntil (stop suppression)
- Death/Respawn:
  - on death: disable orders, show center message; respawn handled in portals/respawn spec

Enemy
- Visuals:
  - Capsule-like mesh with a single eye
  - Billboard HP bar above head: background + red fill that scales with HP
- Stats:
  - Randomized maxHP in a small range (e.g., 60–120); current HP tracks fill
  - Speed; attack cooldown state (nextAttackReady)
- On Death:
  - Hide mesh and grant XP to the player (once per enemy)
- Debuffs:
  - Must reflect slow debuff state (slowUntil, slowFactor) impacting movement speed

Acceptance Criteria
- Player spawns with configured stats and visual effects (right-hand orb/light present).
- Optional GLTF model loads via ?model=URL and auto-scales; placeholder hides when loaded.
- Enemy instances spawn with visible billboard HP bars that decrease on damage.
- On enemy death:
  - Mesh hides
  - Player receives XP once
- Slow debuff applied by W skill visibly reduces enemy movement during its duration.
