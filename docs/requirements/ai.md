# AI — Functional Requirements

Scope
- Enemy non-player character behavior covering aggro, pursuit, attack, wander, and debuff handling.

Spawning
- Spawn a fixed number of enemies around the village at random positions within enemySpawnRadius.
- Each enemy is initialized alive with randomized maxHP and billboard HP bar.
- Maintain a high density suitable for “hunter”-style gameplay; dead enemies respawn after a short delay to keep density high.
- Variety: include multiple enemy types (melee and ranged), size variants, and different attack effects. Higher maps use stronger variants with distinct color/model differences.

Aggro & Pursuit
- Aggro if the player is within aiAggroRadius.
- While aggroed:
  - If distance to player > aiAttackRange, chase the player using direct steering.
  - Face the player smoothly while chasing.

Attacking
- If within aiAttackRange:
  - Attack on a cooldown (aiAttackCooldown).
  - Each attack deals aiAttackDamage to the player.
  - Render a short red beam VFX toward the player for feedback.
  - Enemies use non‑thunder effects; thunder visuals/skills are reserved for the hero.

Wander (Idle)
- Without aggro, periodically pick a random nearby moveTarget within aiWanderRadius and walk toward it.
- Movement uses reduced speed multiplier during wander to feel less “urgent”.

Debuffs
- Enemies slowed by W skill honor a temporary slow:
  - While slowUntil > now, apply speed multiplier slowFactor (e.g., 0.45).
  - Visual slow indicator ring is visible while slowed.

Death & XP
- On death:
  - Enemy mesh hides and is excluded from future interactions/aggro.
  - Player gains XP once per enemy death.

Acceptance Criteria
- Enemies wander when the player is far away.
- Enemies switch to chasing when the player enters aiAggroRadius.
- Enemies attack on cooldown when within aiAttackRange; player HP decreases appropriately.
- Slow debuff reduces enemy chase speed for the debuff duration and displays a visible indicator ring.
- On death, enemies stop moving/attacking, hide visually, and grant XP exactly once.
- Enemy density remains high due to respawn; the playfield stays populated in line with “hunter”-style gameplay.
- At least two distinct enemy types (melee and ranged) with size variants and differing attack effects are observable.
- Enemies do not cast thunder‑themed skills; thunder is exclusive to the hero.
