/**
 * GoT Skill Pool — Enhanced with per-skill VFX "effects" and diversified roles
 *
 * effects:
 *  - beam: beam/electric color (hex)
 *  - impact: strike/decal color (hex)
 *  - ring: ground ring color (hex)
 *  - arc: secondary arc color (hex)
 *  - hand: hand flash tint (hex)
 *  - shake: camera shake magnitude (0..1)
 */
export const SKILL_POOL = [
  {
    "id": "chain_lightning",
    "name": "Chain Lightning",
    "short": "Chain",
    "type": "chain",
    "cd": 5,
    "mana": 22,
    "range": 45,
    "jumps": 5,
    "jumpRange": 24,
    "dmg": 24,
    "slowFactor": 0.25,
    "slowDuration": 0.9,
    "effects": {
      "beam": "0xdff3ff",
      "arc": "0xbfe9ff",
      "impact": "0x9fd8ff",
      "ring": "0x7fc7ff",
      "hand": "0x9fd8ff",
      "shake": 0.2
    },
    "description": "Zap an enemy and arc to nearby foes, slowing each struck target.",
    "behavior": "On cast:\n- Validate an initial enemy target within range and LoS from the caster's aim reticle; if none, fail (no cost).\n- Play effects.hand on caster.\n- Hit the initial target for dmg electric, apply slow (slowFactor, slowDuration). Play effects.impact at target and camera shake with effects.shake.\n- Draw a beam from caster to target using effects.beam.\n- Chain logic:\n - Maintain a set of already-hit targets (start with the initial target).\n - For up to jumps additional hits:\n - Find the nearest enemy to the last hit target within jumpRange and LoS that is not yet hit and is alive.\n - If none found, stop chaining.\n - Travel time is instantaneous; draw effects.arc between the last target and the new target and play effects.impact on hit.\n - Apply dmg and the same slow to the new target; add to hit set.\n- No damage falloff between jumps by default.\n- Apply no friendly fire; ignores dead/untargetable units."
  },
  {
    "id": "lightning_bolt",
    "name": "Lightning Bolt",
    "short": "Bolt",
    "type": "aoe",
    "cd": 8,
    "mana": 34,
    "radius": 16,
    "dmg": 35,
    "slowFactor": 0.45,
    "slowDuration": 1.5,
    "effects": {
      "ring": "0xffa54d",
      "impact": "0xffd86a",
      "arc": "0xffbb66",
      "hand": "0xffd86a",
      "shake": 0.35
    },
    "description": "Call a thunderous blast around you, damaging and heavily slowing enemies.",
    "behavior": "On cast:\n- Centered on the caster, create an immediate AoE with radius.\n- Play effects.hand on caster and effects.ring expanding from caster; flash effects.impact on each enemy hit.\n- All enemies within radius take dmg electric and are slowed by slowFactor for slowDuration.\n- Apply camera shake effects.shake once at cast.\n- Ignores LoS (affects enemies behind cover within the radius)."
  },
  {
    "id": "static_field",
    "name": "Static Field",
    "short": "Static",
    "type": "aura",
    "cd": 15,
    "mana": 0,
    "radius": 14,
    "tick": 0.7,
    "dmg": 8,
    "duration": 10,
    "manaPerTick": 2,
    "effects": {
      "ring": "0x7fc7ff",
      "impact": "0x7fc7ff",
      "hand": "0x9fd8ff",
      "shake": 0.1
    },
    "description": "Emit a static aura that periodically shocks nearby enemies while draining mana.",
    "behavior": "On cast:\n- Start an aura centered on the caster for duration. Aura follows the caster.\n- Every tick seconds:\n - If caster has >= manaPerTick, spend manaPerTick; otherwise end the aura early.\n - Damage all enemies within radius for dmg electric; play effects.impact on each and a subtle effects.ring pulse on caster.\n- Play effects.hand on activation; maintain a faint looping ring visual (effects.ring) for the aura's lifetime.\n- Ignores LoS; ticks cannot crit; no slow applied."
  },
  {
    "id": "thunderstorm",
    "name": "Thunderstorm",
    "short": "Storm",
    "type": "storm",
    "cd": 22,
    "mana": 55,
    "radius": 30,
    "strikes": 22,
    "dmg": 20,
    "duration": 7,
    "effects": {
      "impact": "0xb5e2ff",
      "ring": "0x88ccff",
      "hand": "0x9fd8ff",
      "shake": 0.45
    },
    "description": "Summon a localized storm cloud that rains random lightning strikes.",
    "behavior": "On cast:\n- Anchor the storm to the caster's current position; the storm area (radius) is stationary for duration.\n- Strike scheduling uses an accumulator at rate = strikes / duration; each time the accumulator >= 1, spawn a strike and decrement by 1. Multiple strikes can occur in a single frame.\n- Each strike:\n - If there are enemies inside radius, pick one at random and impact at their position; otherwise pick a random point uniformly within radius.\n - Deal dmg electric to all enemies within strikeRadius = 2.5 units of impact.\n - Play effects.impact at impact location and apply camera shake effects.shake (scaled down by distance to player).\n- On cast, play effects.hand and a large effects.ring on the ground. Ignores LoS."
  },
  {
    "id": "got_bolt",
    "name": "GoT Bolt",
    "short": "Bolt+",
    "type": "beam",
    "cd": 2.5,
    "mana": 14,
    "range": 36,
    "dmg": 22,
    "effects": {
      "beam": "0xdff6ff",
      "impact": "0xdeeaff",
      "hand": "0xdff3ff",
      "shake": 0.2
    },
    "description": "Fire a precise, fast lightning beam at the first enemy in your aim.",
    "behavior": "On cast:\n- Trace a straight line from caster origin along aim up to range, requiring LoS.\n- Hit the first enemy intersected for dmg electric.\n- Play effects.hand on cast start, effects.beam along the traced line, and effects.impact at the hit location with camera shake effects.shake.\n- If no enemy is hit, still show a brief beam to max range; no damage dealt; cost is consumed (successful cast)."
  },
  {
    "id": "ion_nova",
    "name": "Ion Nova",
    "short": "Nova",
    "type": "nova",
    "cd": 12,
    "mana": 26,
    "radius": 14,
    "dmg": 30,
    "effects": {
      "ring": "0x66ffe0",
      "impact": "0x99ffee",
      "hand": "0x66ffe0",
      "shake": 0.35
    },
    "description": "Emit a rapidly expanding ion shockwave from your position.",
    "behavior": "On cast:\n- Spawn a radial wave that expands from 0 to radius over 0.25s (visual only); damage is applied instantly to enemies within radius at cast time.\n- Deal dmg electric to all enemies in radius. Ignores LoS.\n- Play effects.hand on caster, effects.ring expanding, and effects.impact flashes on enemies hit; apply camera shake effects.shake once."
  },
  {
    "id": "overcharge_aura",
    "name": "Overcharge Aura",
    "short": "O-Chg",
    "type": "aura",
    "cd": 18,
    "mana": 0,
    "radius": 12,
    "tick": 0.5,
    "dmg": 6,
    "duration": 9,
    "manaPerTick": 2.5,
    "effects": {
      "ring": "0xffef85",
      "impact": "0xffd86a",
      "hand": "0xffd86a",
      "shake": 0.18
    },
    "description": "Sustain an overcharged field that zaps nearby foes more frequently.",
    "behavior": "On cast:\n- Start a following aura for duration; ticks every tick seconds.\n- Each tick: if caster has >= manaPerTick, spend it; else end aura early. Damage all enemies in radius for dmg electric; play effects.impact per enemy; pulse effects.ring on caster.\n- Slightly faster tick than Static Field; otherwise identical rules (no LoS needed)."
  },
  {
    "id": "crackling_field",
    "name": "Crackling Field",
    "short": "C-Field",
    "type": "aura",
    "cd": 14,
    "mana": 0,
    "radius": 13,
    "tick": 0.6,
    "dmg": 7,
    "duration": 8,
    "manaPerTick": 2,
    "effects": {
      "ring": "0x9fd8ff",
      "impact": "0x9fd8ff",
      "hand": "0x9fd8ff",
      "shake": 0.15
    },
    "description": "Maintain a crackling halo that intermittently shocks nearby enemies.",
    "behavior": "On cast:\n- Start a following aura for duration; every tick seconds spend manaPerTick or end early if insufficient.\n- On each tick, damage all enemies within radius for dmg electric and play effects.impact on each; maintain a looping subtle effects.ring around caster."
  },
  {
    "id": "static_overload",
    "name": "Static Overload",
    "short": "Over",
    "type": "aura",
    "cd": 16,
    "mana": 0,
    "radius": 15,
    "tick": 0.55,
    "dmg": 9,
    "duration": 9,
    "manaPerTick": 3,
    "effects": {
      "ring": "0xbfe9ff",
      "impact": "0x7fc7ff",
      "hand": "0xbfe9ff",
      "shake": 0.2
    },
    "description": "A high-intensity static field that hits harder and farther, at higher mana upkeep.",
    "behavior": "On cast:\n- Start a following aura for duration; on each tick spend manaPerTick or end early if insufficient.\n- Each tick deals dmg electric to all enemies within radius; trigger effects.impact on enemies and a brighter effects.ring on caster."
  },
  {
    "id": "ball_lightning",
    "name": "Ball Lightning",
    "short": "Ball",
    "type": "beam",
    "cd": 2.2,
    "mana": 16,
    "range": 48,
    "dmg": 20,
    "effects": {
      "beam": "0x88ccff",
      "impact": "0xa0ddff",
      "hand": "0x88ccff",
      "shake": 0.22
    },
    "description": "Launch a concentrated bolt that instantly hits the first enemy in line.",
    "behavior": "On cast:\n- Hitscan along aim up to range (LoS required).\n- First enemy hit takes dmg electric. Play effects.beam along path and effects.impact at hit; effects.hand at cast; apply camera shake effects.shake.\n- If no hit, show a brief beam to max range; cost consumed."
  },
  {
    "id": "arc_spear",
    "name": "Arc Spear",
    "short": "Spear",
    "type": "beam",
    "cd": 3.2,
    "mana": 18,
    "range": 52,
    "dmg": 28,
    "effects": {
      "beam": "0xff88e6",
      "impact": "0xffa5ee",
      "hand": "0xff88e6",
      "shake": 0.28
    },
    "description": "A high-voltage spear of lightning that pierces shields and strikes a single target.",
    "behavior": "On cast:\n- Hitscan along aim up to range (LoS). Impact the first enemy hit for dmg electric.\n- Visuals: effects.hand on cast, a thin long effects.beam, and effects.impact at hit with camera shake effects.shake.\n- Treats target shields like normal health unless your game has special interactions (no innate shield-bypass logic)."
  },
  {
    "id": "shockwave",
    "name": "Shockwave",
    "short": "Shock",
    "type": "beam",
    "cd": 2.8,
    "mana": 15,
    "range": 40,
    "dmg": 24,
    "effects": {
      "beam": "0xff6050",
      "impact": "0xff8a7a",
      "hand": "0xff7563",
      "shake": 0.3
    },
    "description": "Project a short, forceful electrical wave in a line.",
    "behavior": "On cast:\n- Hitscan along aim up to range; first enemy hit takes dmg electric.\n- Visuals: thicker, shorter-duration effects.beam and effects.impact at hit; play effects.hand and camera shake effects.shake.\n- No knockback or slow by default."
  },
  {
    "id": "sky_wrath",
    "name": "Sky Wrath",
    "short": "Wrath",
    "type": "storm",
    "cd": 18,
    "mana": 42,
    "radius": 24,
    "strikes": 14,
    "dmg": 18,
    "duration": 5.5,
    "effects": {
      "impact": "0xcc99ff",
      "ring": "0xa97bff",
      "hand": "0xbf8cff",
      "shake": 0.35
    },
    "description": "A brief, intense storm focused over a smaller area.",
    "behavior": "On cast:\n- Stationary storm centered at cast position for duration.\n- Strike rate = strikes / duration via accumulator. Each strike selects a random enemy inside radius (or random point if none).\n- Each strike deals dmg to enemies within strikeRadius = 2.5 units; play effects.impact and shake = effects.shake (distance-attenuated).\n- effects.hand on cast; purple-hued effects.ring marking the area. Ignores LoS."
  },
  {
    "id": "thunderdome",
    "name": "Thunderdome",
    "short": "Dome",
    "type": "storm",
    "cd": 24,
    "mana": 60,
    "radius": 32,
    "strikes": 28,
    "dmg": 18,
    "duration": 8,
    "effects": {
      "impact": "0x88bbff",
      "ring": "0x66aaff",
      "hand": "0x88bbff",
      "shake": 0.6
    },
    "description": "A large dome of relentless lightning strikes over an extended period.",
    "behavior": "On cast:\n- Stationary storm, large radius, duration as specified.\n- Strike scheduling with accumulator at rate = strikes / duration. Prefer randomly selecting from current enemies in radius; fallback to random ground points.\n- Each strike deals dmg to enemies within strikeRadius = 3.0 units; play effects.impact per strike and strong shake effects.shake (distance-attenuated).\n- Draw a prominent boundary using effects.ring on cast; ignores LoS."
  },
  {
    "id": "ion_storm",
    "name": "Ion Storm",
    "short": "Ion",
    "type": "storm",
    "cd": 20,
    "mana": 50,
    "radius": 28,
    "strikes": 20,
    "dmg": 19,
    "duration": 6.5,
    "effects": {
      "impact": "0x88ffee",
      "ring": "0x66ffe0",
      "hand": "0x66ffe0",
      "shake": 0.38
    },
    "description": "A balanced, mobile storm of ionizing strikes.",
    "behavior": "On cast:\n- Stationary storm at cast position for duration.\n- Spawn strikes using accumulator at rate = strikes / duration; each strike targets a random enemy in radius or a random point.\n- Impact deals dmg to enemies within strikeRadius = 2.5 units; play effects.impact and shake with intensity effects.shake.\n- On cast, show effects.ring and effects.hand. Ignores LoS."
  },
  {
    "id": "tempest_ring",
    "name": "Tempest Ring",
    "short": "Ring",
    "type": "aoe",
    "cd": 10,
    "mana": 32,
    "radius": 18,
    "dmg": 32,
    "slowFactor": 0.4,
    "slowDuration": 1.2,
    "effects": {
      "ring": "0x7dd3ff",
      "impact": "0x9bdfff",
      "hand": "0x9fd8ff",
      "shake": 0.32
    },
    "description": "A powerful circular blast that damages and slows around you.",
    "behavior": "On cast:\n- Centered on caster, instantly affect all enemies within radius.\n- Deal dmg electric and apply slow (slowFactor, slowDuration).\n- Visuals: strong expanding effects.ring from caster and effects.impact on enemies; apply one-time camera shake effects.shake. Ignores LoS."
  },
  {
    "id": "storm_pulse",
    "name": "Storm Pulse",
    "short": "Pulse",
    "type": "nova",
    "cd": 9,
    "mana": 22,
    "radius": 12,
    "dmg": 24,
    "effects": {
      "ring": "0x88ccff",
      "impact": "0xa0ddff",
      "hand": "0x88ccff",
      "shake": 0.26
    },
    "description": "A quick, lower-cost nova that bursts from your position.",
    "behavior": "On cast:\n- Instantly damage all enemies within radius for dmg electric (no slow).\n- Visuals: effects.hand and fast expanding effects.ring; effects.impact on those hit; brief camera shake effects.shake. Ignores LoS."
  },
  {
    "id": "magneto_burst",
    "name": "Magneto Burst",
    "short": "Burst",
    "type": "aoe",
    "cd": 11,
    "mana": 36,
    "radius": 17,
    "dmg": 34,
    "slowFactor": 0.5,
    "slowDuration": 1.3,
    "effects": {
      "ring": "0xff6a6a",
      "impact": "0xff9494",
      "hand": "0xff7a7a",
      "shake": 0.4
    },
    "description": "A heavy electromagnetic blast that damages and strongly slows nearby foes.",
    "behavior": "On cast:\n- Centered on caster; damage all enemies within radius for dmg; apply slowFactor for slowDuration.\n- Visuals: red-tinted effects.ring and effects.impact; camera shake effects.shake. Ignores LoS."
  },
  {
    "id": "static_prison",
    "name": "Static Prison",
    "short": "Prison",
    "type": "aoe",
    "cd": 16,
    "mana": 38,
    "radius": 14,
    "dmg": 18,
    "slowFactor": 0.7,
    "slowDuration": 2.8,
    "effects": {
      "ring": "0xc080ff",
      "impact": "0xe0a0ff",
      "hand": "0xc080ff",
      "shake": 0.36
    },
    "description": "Trap enemies in a static cage, massively reducing their movement.",
    "behavior": "On cast:\n- Centered on caster; all enemies in radius take dmg and receive a heavy slow (slowFactor) for slowDuration.\n- Visuals: persistent cage-like effects.ring for ~0.6s and effects.impact on enemies; camera shake effects.shake. Ignores LoS."
  },
  {
    "id": "thundersurge",
    "name": "Thundersurge",
    "short": "Surge",
    "type": "chain",
    "cd": 6,
    "mana": 26,
    "range": 42,
    "jumps": 4,
    "jumpRange": 22,
    "dmg": 28,
    "slowFactor": 0.2,
    "slowDuration": 1.0,
    "effects": {
      "beam": "0xcfefff",
      "arc": "0xbfe9ff",
      "impact": "0xa8e0ff",
      "ring": "0x8fd3ff",
      "hand": "0xa8e0ff",
      "shake": 0.24
    },
    "description": "A stronger chain strike with fewer jumps that slightly slows.",
    "behavior": "On cast:\n- Require initial enemy target within range and LoS; otherwise fail (no cost).\n- Hit initial target for dmg, applying slowFactor for slowDuration; show effects.beam from caster and effects.impact on target.\n- Chain up to jumps times to nearest new enemy within jumpRange and LoS; apply dmg and the same slow on each; draw effects.arc between hops; camera shake on first impact only (optional)."
  },
  {
    "id": "forked_lightning",
    "name": "Forked Lightning",
    "short": "Fork",
    "type": "chain",
    "cd": 7,
    "mana": 24,
    "range": 40,
    "jumps": 6,
    "jumpRange": 20,
    "dmg": 20,
    "slowFactor": 0.15,
    "slowDuration": 1.2,
    "effects": {
      "beam": "0x88e0ff",
      "arc": "0xa0eaff",
      "impact": "0x88ccff",
      "ring": "0x7fc7ff",
      "hand": "0x88ccff",
      "shake": 0.22
    },
    "description": "A wider-splitting chain that seeks more targets with lighter slows.",
    "behavior": "On cast:\n- Acquire initial enemy within range and LoS; if none, fail (no cost). Hit for dmg and apply slow (slowFactor, slowDuration).\n- Attempt up to jumps additional hits, each time selecting the nearest new enemy within jumpRange and LoS from the last target; apply dmg and slow on each.\n- Use effects.beam from caster to first target and effects.arc between chain targets; effects.impact on each hit; light camera shake on first hit."
  },
  {
    "id": "thunder_mend",
    "name": "Thunder Mend",
    "short": "Heal",
    "type": "heal",
    "cd": 14,
    "mana": 24,
    "heal": 55,
    "effects": {
      "impact": "0x85ffb2",
      "ring": "0x66ff99",
      "hand": "0x85ffc1",
      "shake": 0.18
    },
    "description": "Convert storm energy into restorative currents, healing yourself.",
    "behavior": "On cast:\n- Instantly heal the caster for heal health (cannot overheal unless your system supports shields; by default clamp to max HP).\n- Play effects.hand and a soft green effects.impact on the caster; no LoS or target needed; trigger a gentle camera shake effects.shake.\n- Does not affect allies."
  },
  {
    "id": "divine_mend",
    "name": "Divine Mend",
    "short": "Mend+",
    "type": "heal",
    "cd": 30,
    "mana": 40,
    "heal": 160,
    "effects": {
      "impact": "0x66ff99",
      "ring": "0x55ff88",
      "hand": "0x88ffd0",
      "shake": 0.25
    },
    "description": "A potent self-heal channeling celestial thunder.",
    "behavior": "On cast:\n- Instantly heal the caster for heal health (clamped to max HP).\n- Play brighter effects.hand and effects.impact on caster plus a brief green effects.ring; moderate camera shake effects.shake.\n- Self-only; no LoS required."
  },
  {
    "id": "storm_sip",
    "name": "Storm Sip",
    "short": "Mana",
    "type": "mana",
    "cd": 12,
    "mana": 0,
    "restore": 40,
    "effects": {
      "impact": "0x88aaff",
      "ring": "0x99bbff",
      "hand": "0x88ccff",
      "shake": 0.1
    },
    "description": "Draw a sip of storm power, restoring mana to yourself.",
    "behavior": "On cast:\n- Restore restore mana to the caster instantly (clamp to mana max).\n- Play effects.hand and a blue-tinted effects.impact on caster; no LoS or target needed; minimal camera shake."
  },
  {
    "id": "mana_well",
    "name": "Mana Well",
    "short": "Well",
    "type": "mana",
    "cd": 28,
    "mana": 0,
    "restore": 120,
    "effects": {
      "impact": "0x66ccff",
      "ring": "0x55bbff",
      "hand": "0x66ccff",
      "shake": 0.2
    },
    "description": "Tap a deep well of energy, restoring a large amount of mana.",
    "behavior": "On cast:\n- Restore restore mana to the caster instantly (clamped).\n- Play effects.hand, a stronger blue effects.impact, and a short effects.ring pulse on caster; mild camera shake effects.shake."
  },
  {
    "id": "overload_buff",
    "name": "Overload",
    "short": "Buff",
    "type": "buff",
    "cd": 20,
    "mana": 30,
    "buffMult": 1.4,
    "buffDuration": 8,
    "speedMult": 1.35,
    "effects": {
      "impact": "0xffd86a",
      "ring": "0xffef85",
      "hand": "0xffd86a",
      "shake": 0.22
    },
    "description": "Supercharge yourself, increasing damage and movement speed.",
    "behavior": "On cast:\n- Apply a self-buff for buffDuration seconds:\n - Outgoing damage multiplier: buffMult to all your damage events.\n - Movement speed multiplier: speedMult multiplicatively to base speed.\n- Recasting refreshes duration but does not stack (latest overwrites).\n- Play effects.hand on activation and apply a golden effects.ring around the caster; small camera shake effects.shake."
  },
  {
    "id": "surge_of_haste",
    "name": "Surge of Haste",
    "short": "Haste",
    "type": "buff",
    "cd": 22,
    "mana": 32,
    "buffMult": 1.15,
    "buffDuration": 7,
    "speedMult": 1.25,
    "atkSpeedMult": 1.6,
    "effects": {
      "impact": "0xfff07a",
      "ring": "0xffe16a",
      "hand": "0xffe16a",
      "shake": 0.24
    },
    "description": "A burst of speed and attack acceleration with a modest damage boost.",
    "behavior": "On cast:\n- Apply a self-buff for buffDuration seconds:\n - Outgoing damage multiplier: buffMult.\n - Movement speed multiplier: speedMult.\n - Attack/cast speed multiplier: atkSpeedMult applied to attack rate / cast time as appropriate.\n- Recasting refreshes duration; non-stacking with itself; independent from Overload unless your system restricts stacking categories.\n- Play effects.hand, golden effects.ring, and subtle effects.impact on the caster; light camera shake."
  },
  {
    "id": "fortify",
    "name": "Fortify",
    "short": "Fort",
    "type": "buff",
    "cd": 26,
    "mana": 28,
    "buffMult": 1.1,
    "buffDuration": 8,
    "defensePct": 0.35,
    "effects": {
      "impact": "0x88ffd0",
      "ring": "0x66ffc2",
      "hand": "0x88ffd0",
      "shake": 0.18
    },
    "description": "Bolster your defenses and slightly empower your attacks.",
    "behavior": "On cast:\n- Apply a self-buff for buffDuration:\n - Incoming damage reduction: defensePct (finalDamage = base * (1 - defensePct)).\n - Outgoing damage multiplier: buffMult.\n- Recasting refreshes duration and overwrites itself; does not stack multiplicatively with another Fortify.\n- Visuals: teal effects.hand, effects.impact, and effects.ring; minimal camera shake."
  },
  {
    "id": "storm_barrier",
    "name": "Storm Barrier",
    "short": "Barrier",
    "type": "shield",
    "cd": 18,
    "mana": 28,
    "duration": 6,
    "shieldPct": 0.45,
    "invulnDuration": 0.25,
    "effects": {
      "impact": "0x88ffd0",
      "ring": "0x66ffc2",
      "hand": "0x66ffc2",
      "shake": 0.22
    },
    "description": "Erect a barrier of storm energy that absorbs damage with a brief invulnerability.",
    "behavior": "On cast:\n- Grant the caster a damage-absorbing shield equal to shieldPct of max HP for duration seconds.\n- Additionally, apply brief invulnerability (ignore all damage) for invulnDuration starting at cast time.\n- The shield depletes from incoming damage (post-mitigation) and ends early if it reaches 0. The invulnerability and shield do not reflect damage.\n- Does not stack with another active shield of the same skill; recasting refreshes the shield value and timers.\n- Visuals: effects.hand, shimmering teal bubble (effects.ring), and effects.impact on cast; camera shake effects.shake."
  },
  {
    "id": "tempest_guard",
    "name": "Tempest Guard",
    "short": "Guard",
    "type": "shield",
    "cd": 26,
    "mana": 34,
    "duration": 5,
    "shieldPct": 0.6,
    "invulnDuration": 0.5,
    "effects": {
      "impact": "0xffe085",
      "ring": "0xffcf6a",
      "hand": "0xffe085",
      "shake": 0.28
    },
    "description": "A stronger but shorter guard with longer brief invulnerability.",
    "behavior": "On cast:\n- Apply a shield to the caster equal to shieldPct of max HP for duration.\n- Provide invulnerability for invulnDuration at cast start.\n- Shield ends early if depleted; recasting overwrites and refreshes. Does not stack with Storm Barrier unless your system allows different shield sources to coexist (default: last applied wins).\n- Visuals: warm golden effects.hand, effects.ring on caster, and effects.impact; moderate camera shake."
  },
  {
    "id": "lightning_dash",
    "name": "Lightning Dash",
    "short": "Dash",
    "type": "dash",
    "cd": 7,
    "mana": 16,
    "distance": 14,
    "effects": {
      "impact": "0x9fd8ff",
      "ring": "0x9fd8ff",
      "hand": "0x9fd8ff",
      "shake": 0.12
    },
    "description": "Instantly surge forward in the facing direction.",
    "behavior": "On cast:\n- Attempt to move the caster distance units along current facing over 0.1s (or instantly if your movement system supports teleport-like dashes).\n- Collision handling: stop at the last valid position before colliding with impassable geometry; do not pass through walls.\n- No damage or invulnerability inherently granted.\n- Visuals: streaked effects.ring trail from start to end and effects.impact flash at end; subtle camera shake."
  },
  {
    "id": "blink_strike",
    "name": "Blink Strike",
    "short": "Blink",
    "type": "blink",
    "cd": 12,
    "mana": 24,
    "range": 24,
    "effects": {
      "impact": "0xbfe9ff",
      "ring": "0xbfe9ff",
      "hand": "0xbfe9ff",
      "shake": 0.14
    },
    "description": "Teleport to a target location within range.",
    "behavior": "On cast:\n- Read the player's aim point; if the point is within range and on navigable ground, teleport the caster there instantly.\n- If aimed point is invalid or obstructed, snap to the nearest valid point within range along the aim direction; if none found, fail (no cost).\n- No damage or crowd control applied.\n- Visuals: effects.hand on start, faint vanish at source; effects.impact and small effects.ring at destination; slight camera shake."
  },
  {
    "id": "thunder_image",
    "name": "Thunder Image",
    "short": "Clone",
    "type": "clone",
    "cd": 22,
    "mana": 40,
    "duration": 7,
    "rate": 0.5,
    "radius": 26,
    "dmg": 18,
    "effects": {
      "impact": "0x9fd8ff",
      "ring": "0x9fd8ff",
      "hand": "0x9fd8ff",
      "shake": 0.2
    },
    "description": "Summon a stormy duplicate that auto-attacks nearby enemies.",
    "behavior": "On cast:\n- Spawn a stationary spectral clone at the caster's position lasting duration seconds. It is untargetable and does not block movement.\n- Every rate seconds, the clone searches for the nearest enemy within radius and LoS. If found, it fires a hitscan zap that deals dmg electric to that target.\n- Visuals: clone idles with a low-intensity effects.ring; on each attack fire a short effects.beam (engine's default for clone) and effects.impact on the target; small camera shake effects.shake on first hit only.\n- The clone despawns when duration ends."
  },
  {
    "id": "got_judgement",
    "name": "GoT' Judgement",
    "short": "Judg",
    "type": "nova",
    "cd": 42,
    "mana": 80,
    "radius": 28,
    "dmg": 165,
    "effects": {
      "ring": "0xffe085",
      "impact": "0xffc14d",
      "hand": "0xffd86a",
      "shake": 0.9
    },
    "description": "Unleash a devastating divine nova that obliterates nearby foes.",
    "behavior": "On cast:\n- Instantly deal dmg electric to all enemies within radius centered on caster. Ignores LoS.\n- Visuals: bright golden effects.hand, massive expanding effects.ring, and intense effects.impact on all enemies hit; strong camera shake effects.shake.\n- Consider applying brief hitstop on enemies (optional; not inherent)."
  },
  {
    "id": "maelstrom",
    "name": "Maelstrom",
    "short": "Mael",
    "type": "storm",
    "cd": 40,
    "mana": 72,
    "radius": 34,
    "strikes": 36,
    "dmg": 22,
    "duration": 9,
    "effects": {
      "ring": "0xa0e0ff",
      "impact": "0x80d0ff",
      "hand": "0x88ccff",
      "shake": 0.7
    },
    "description": "A colossal storm cell that saturates a wide area with lightning.",
    "behavior": "On cast:\n- Stationary storm centered at cast position for duration. Mark the area with a large effects.ring.\n- Strike scheduling via accumulator at rate = strikes / duration. Each strike prefers a random enemy within radius; else a random point.\n- Each strike deals dmg to enemies within strikeRadius = 3.0 units; play effects.impact and strong distance-attenuated camera shake effects.shake.\n- Ignores LoS."
  }
];

/**
 * Default loadout mapping stays close to the original Q/W/E/R
 */
export const DEFAULT_LOADOUT = ["chain_lightning", "lightning_bolt", "static_field", "thunderstorm"];
