# AI (Enemies) — Aggro, Wander, Attack

Responsibilities
- Drive enemy behaviors: spawning, idle wandering, aggro/pursuit, attack cadence, and debuff handling.

Behavior Model
- Spawning
  - Enemies are created around the village within WORLD.enemySpawnRadius.
  - Each enemy receives randomized maxHP and a billboard HP bar (attached to mesh).
  - mesh.userData.enemyRef is set for raycast resolution.
- Idle (Wander)
  - If the player is outside WORLD.aiAggroRadius:
    - Periodically choose a random moveTarget within WORLD.aiWanderRadius of current position.
    - Move at a reduced speed (e.g., 60% multiplier) compared to chase.
- Aggro and Pursuit
  - If player distance is less than WORLD.aiAggroRadius:
    - Chase the player (direct steering).
    - Face the player smoothly using quaternion slerp.
- Attack
  - When within WORLD.aiAttackRange:
    - Attack if current time ≥ nextAttackReady.
    - On attack:
      - Spawn a short red beam VFX from enemy head height to player.
      - Apply WORLD.aiAttackDamage to player.
      - Set nextAttackReady = now + WORLD.aiAttackCooldown.
- Debuffs (Slow)
  - If enemy has slowUntil in the future:
    - Apply speed multiplier slowFactor (e.g., 0.45) to movement.
    - Show a slow indicator ring while the slow is active.
- Death & XP
  - On hp ≤ 0:
    - alive=false; hide mesh.
    - Grant player XP once (guard via _xpGranted flag).

Key Data (from constants.js)
- WORLD.aiAggroRadius
- WORLD.aiWanderRadius
- WORLD.aiAttackRange
- WORLD.aiAttackCooldown
- WORLD.aiAttackDamage

Integration
- updateEnemies(dt) is called from the main loop.
- Billboard HP bar faces camera each frame in the main loop.
- Slow rings are created/destroyed via effects indicators in updateIndicators(dt).

Behavior Parity
- Aggro, wander, attack cadence, and slow handling match the original monolithic implementation.
