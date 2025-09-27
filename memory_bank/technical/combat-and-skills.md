# Combat & Skills (skills.js)

Responsibilities
- Centralize basic attack logic, skill cooldowns, and the four skills (Q/W/E/R).
- Drive per-frame ticking for Static Field and Thunderstorm.
- Update cooldown UI overlays.

Exports
- class SkillsSystem
  - constructor(player, enemies, effects, cdUI)
    - player: Player instance
    - enemies: Enemy[] (live list)
    - effects: EffectsManager (for beams/strikes/rings)
    - cdUI: { Q, W, E, R } DOM elements for cooldown overlays
  - startCooldown(key: "Q"|"W"|"E"|"R", seconds)
  - isOnCooldown(key)
  - updateCooldownUI(): writes conic-gradient wedges and numeric countdown
  - tryBasicAttack(attacker: Entity, target: Entity): boolean
    - Range/cooldown checks; spawns electric beam; applies WORLD.basicAttackDamage.
  - castQ_ChainLightning(): nearest-in-range target, chained jumps within jumpRange; beams/decals per hop.
  - castW_AOE(point: THREE.Vector3): damages in radius and applies slow debuff (slowUntil/slowFactor).
  - castE_StaticField(): toggle aura with duration and mana drain per tick; ticks damage to enemies in radius.
  - castR_Thunderstorm(): schedules timed strikes around the player over duration; per-strike damage and camera shake.
  - runStaticField(dt, t): internal tick runner for E.
  - runStorms(cameraShake): processes queued strikes and applies local damage.
  - update(t, dt, cameraShake): per-frame; runs E/R and updates cooldown UI.

Data & UI
- Cooldowns stored as absolute timestamps (now()+seconds).
- cdState tracks remaining time to detect “ready” transitions for flash animations.
- cdUI entries are optional; updateCooldownUI() is no-op if elements are not present.

Visuals
- tryBasicAttack uses handWorldPos(player) to originate beams from right hand when available.
- EffectsManager provides:
  - spawnElectricBeamAuto for dynamic beams
  - spawnStrike for strikes
  - createGroundRing and queue-based fade/scale cleanup for aura pulses (E)
- Small cameraShake bump is applied on large R strikes.

Integration Notes
- SkillsSystem is created once in main.js with live references to player/enemies/effects and bound to cooldown elements via UIManager.
- Main loop calls skills.update() each frame.
- Input layer calls castQ/W/E/R and tryBasicAttack during confirmations.

Behavior Parity
- Cooldown durations, mana costs, ranges, radii, damage values, and visual triggers are unchanged from original implementation.
- Basic attack timing/bracing and skill effects match previous behavior.
