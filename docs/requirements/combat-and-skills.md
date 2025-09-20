# Combat & Skills — Functional Requirements

Scope
- Core combat loop, basic attack, cooldowns, and four electric skills (Q/W/E/R).
- Cooldown UI behavior is specified; visual implementation details live under VFX & Indicators and UI modules.

Basic Combat
- Basic electric attack:
  - Has range and per-attacker cooldown.
  - Auto-executes when in range of the current target.
  - Player attack originates from right-hand position if available.
- Damage & Death:
  - Enemies take damage, can die, and grant XP once on death.
- Targeting:
  - Player can target an enemy (right-click or aim-confirm); if target dies or is out of range, behavior follows input/AI specs.

Cooldowns
- Skills Q/W/E/R each have a cooldown (seconds) and consume mana as configured.
- Cooldown UI shows remaining time with a conic-gradient wedge and numeric countdown.
- When cooldown finishes, show a brief “ready” flash.

Skills
- Q — Chain Lightning:
  - Targets nearest enemy within range.
  - Jumps to nearby enemies up to a configured jump count within jumpRange.
  - Applies damage per hit and shows distinct electric beam visuals.
- W — Lightning Bolt (AOE):
  - Requires aim mode and ground click to place.
  - Damages enemies within radius and applies a temporary slow debuff (speed multiplier) for a short duration.
- E — Static Field (Aura):
  - Toggle active for a duration.
  - Ticks periodically, consuming mana per tick and damaging enemies within a radius each tick.
  - Deactivates automatically when out of mana or duration ends; small lockout on manual toggle-off to prevent spam.
- R — Thunderstorm:
  - Schedules multiple random lightning strikes around the player within a radius over a duration.
  - Each strike damages nearby enemies and may add brief camera shake.

Acceptance Criteria
- Basic attack triggers only when in range and off cooldown; renders electric effect from hand (if present).
- Q finds a valid target if in range and chains across nearby enemies, applying damage on each hop.
- W shows an aim ring during placement; on cast, enemies in radius take damage and are slowed temporarily.
- E toggles on/off; while active, ticks at the configured interval, drains MP per tick, and damages enemies in radius; stops when out of MP or time expires.
- R schedules random strikes over time; each strike damages enemies in its local area; small camera shake is perceptible.
- Cooldown wedges and countdowns update smoothly; “ready” flash appears when a skill comes off cooldown.
