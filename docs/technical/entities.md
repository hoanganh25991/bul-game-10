# Entities (entities.js)

Responsibilities
- Define base Entity behavior and concrete Player and Enemy implementations.
- Encapsulate health, team, collision radius, and lifecycle (alive/dead).
- Provide helpers used by other systems (nearest enemy search, hand world position).

Exports
- class Entity
  - constructor(mesh: THREE.Object3D, radius = 1)
  - fields: mesh, radius, team, maxHP, hp, alive, invulnUntil?
  - methods:
    - pos(): THREE.Vector3 — returns mesh.position
    - takeDamage(amount: number): void — reduces HP if not invulnerable; hides mesh and invokes onDeath on zero HP
- class Player extends Entity
  - Team: "player"
  - Stats & Leveling:
    - level, xp, xpToLevel; maxHP/maxMP, hp/mp; hpRegen/mpRegen
    - gainXP(amount): levels up when xp >= xpToLevel; scales caps/regen/xpToLevel
  - Movement/Combat State:
    - moveTarget: THREE.Vector3|null
    - speed, turnSpeed
    - target: Enemy|null
    - nextBasicReady: number (timestamp)
    - attackMove: boolean
    - frozen, deadUntil, holdUntil
    - lastFacingYaw, lastFacingUntil
    - braceUntil (brief squash after basic attack)
  - Aim State:
    - aimMode: boolean
    - aimModeSkill: "ATTACK" | "W" | null
    - staticField: { active: boolean, until: number, nextTick: number }
  - Mana helpers: canSpend(mana): boolean; spend(mana): void
  - Visuals:
    - Right-hand light/orb; idle pulsing via mesh.userData.handLight/thunderOrb in main loop
- class Enemy extends Entity
  - Team: "enemy"
  - Fields:
    - moveTarget: THREE.Vector3|null
    - speed: number
    - nextAttackReady: number (timestamp)
    - slowUntil?: number; slowFactor?: number (if under slow)
    - hpBar: { container: THREE.Group, fill: THREE.Mesh } — attached billboard HP bar
  - Methods:
    - updateHPBar(): void — scales fill based on hp/maxHP
- function getNearestEnemy(origin: THREE.Vector3, maxDist: number, enemies: Enemy[]): Enemy|null
- function handWorldPos(player: Player): THREE.Vector3 — returns right-hand anchor position if available; otherwise chest height

Integration Notes
- enemies[i].mesh.userData.enemyRef must be set to resolve the Enemy instance from raycasted child meshes (done in main.js).
- Enemy billboard HP bars should be faced toward the camera each frame (managed in main loop).
- Player’s onDeath callback is assigned in main.js to handle respawn messaging and order clearing.

Behavior Parity
- Stats, leveling scale factors, and state fields match the original monolithic implementation.
- Damage, death behavior, and HP bar updates are consistent with previous behavior.
