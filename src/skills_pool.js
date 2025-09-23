/**
 * Zeus Skill Pool — Enhanced and diversified
 * Types supported by engine:
 * - "chain": chain lightning between enemies (range, jumps, jumpRange, dmg, optional slowFactor/slowDuration)
 * - "aoe": ground-targeted circular AOE (radius, dmg, optional slowFactor/slowDuration)
 * - "aura": toggle aura around player (radius, tick, dmg, duration, manaPerTick)
 * - "storm": random strikes in radius over duration (radius, strikes, dmg, duration)
 * - "beam": instant single-target zap to nearest enemy in range (range, dmg)
 * - "nova": instant radial burst around player (radius, dmg)
 * - "heal": restore HP instantly (heal)
 * - "mana": restore MP instantly (restore)
 * - "buff": timed self buff (buffMult, buffDuration, optional speedMult, atkSpeedMult, defensePct)
 * - "dash": quick dash forward (distance)
 * - "blink": teleport toward direction/point (range)
 * - "clone": summon a thunder image that periodically zaps nearby foes (duration, rate, radius, dmg)
 * - "shield": temporary damage reduction, optional brief invulnerability (duration, shieldPct/defensePct, invulnDuration)
 *
 * Numbers are tuned to create distinct identities:
 *  - Some big-impact long-cooldown nukes
 *  - Strong utility/defense with meaningful tradeoffs
 *  - Movement/tempo tools (dash/blink/haste)
 *  - Sustains (heal/mana) with pacing
 */
export const SKILL_POOL = [
  // Core lightning kit — refined
  {
    id: "chain_lightning",
    name: "Chain Lightning",
    short: "Chain",
    type: "chain",
    cd: 5,
    mana: 22,
    range: 45,
    jumps: 5,
    jumpRange: 24,
    dmg: 24,
    slowFactor: 0.25,
    slowDuration: 0.9,
  },
  {
    id: "lightning_bolt",
    name: "Lightning Bolt",
    short: "Bolt",
    type: "aoe",
    cd: 8,
    mana: 34,
    radius: 16,
    dmg: 35,
    slowFactor: 0.45,
    slowDuration: 1.5,
  },
  {
    id: "static_field",
    name: "Static Field",
    short: "Static",
    type: "aura",
    cd: 15,
    mana: 0,
    radius: 14,
    tick: 0.7,
    dmg: 8,
    duration: 10,
    manaPerTick: 2,
  },
  {
    id: "thunderstorm",
    name: "Thunderstorm",
    short: "Storm",
    type: "storm",
    cd: 22,
    mana: 55,
    radius: 30,
    strikes: 22,
    dmg: 20,
    duration: 7,
  },

  // Beams / Novas
  {
    id: "zeus_bolt",
    name: "Zeus Bolt",
    short: "Bolt+",
    type: "beam",
    cd: 2.5,
    mana: 14,
    range: 36,
    dmg: 22,
  },
  {
    id: "ion_nova",
    name: "Ion Nova",
    short: "Nova",
    type: "nova",
    cd: 12,
    mana: 26,
    radius: 14,
    dmg: 30,
  },

  // Auras (variants)
  {
    id: "overcharge_aura",
    name: "Overcharge Aura",
    short: "O-Chg",
    type: "aura",
    cd: 18,
    mana: 0,
    radius: 12,
    tick: 0.5,
    dmg: 6,
    duration: 9,
    manaPerTick: 2.5,
  },
  {
    id: "crackling_field",
    name: "Crackling Field",
    short: "C-Field",
    type: "aura",
    cd: 14,
    mana: 0,
    radius: 13,
    tick: 0.6,
    dmg: 7,
    duration: 8,
    manaPerTick: 2,
  },
  {
    id: "static_overload",
    name: "Static Overload",
    short: "Over",
    type: "aura",
    cd: 16,
    mana: 0,
    radius: 15,
    tick: 0.55,
    dmg: 9,
    duration: 9,
    manaPerTick: 3,
  },

  // Beams and tools
  {
    id: "ball_lightning",
    name: "Ball Lightning",
    short: "Ball",
    type: "beam",
    cd: 2.2,
    mana: 16,
    range: 48,
    dmg: 20,
  },
  {
    id: "arc_spear",
    name: "Arc Spear",
    short: "Spear",
    type: "beam",
    cd: 3.2,
    mana: 18,
    range: 52,
    dmg: 28,
  },
  {
    id: "shockwave",
    name: "Shockwave",
    short: "Shock",
    type: "beam",
    cd: 2.8,
    mana: 15,
    range: 40,
    dmg: 24,
  },

  // Storm variants
  {
    id: "sky_wrath",
    name: "Sky Wrath",
    short: "Wrath",
    type: "storm",
    cd: 18,
    mana: 42,
    radius: 24,
    strikes: 14,
    dmg: 18,
    duration: 5.5,
  },
  {
    id: "thunderdome",
    name: "Thunderdome",
    short: "Dome",
    type: "storm",
    cd: 24,
    mana: 60,
    radius: 32,
    strikes: 28,
    dmg: 18,
    duration: 8,
  },
  {
    id: "ion_storm",
    name: "Ion Storm",
    short: "Ion",
    type: "storm",
    cd: 20,
    mana: 50,
    radius: 28,
    strikes: 20,
    dmg: 19,
    duration: 6.5,
  },

  // AOEs — control and burst
  {
    id: "tempest_ring",
    name: "Tempest Ring",
    short: "Ring",
    type: "aoe",
    cd: 10,
    mana: 32,
    radius: 18,
    dmg: 32,
    slowFactor: 0.4,
    slowDuration: 1.2,
  },
  {
    id: "storm_pulse",
    name: "Storm Pulse",
    short: "Pulse",
    type: "nova",
    cd: 9,
    mana: 22,
    radius: 12,
    dmg: 24,
  },
  {
    id: "magneto_burst",
    name: "Magneto Burst",
    short: "Burst",
    type: "aoe",
    cd: 11,
    mana: 36,
    radius: 17,
    dmg: 34,
    slowFactor: 0.5,
    slowDuration: 1.3,
  },
  {
    id: "static_prison",
    name: "Static Prison",
    short: "Prison",
    type: "aoe",
    cd: 16,
    mana: 38,
    radius: 14,
    dmg: 18,
    slowFactor: 0.7,
    slowDuration: 2.8,
  },

  // Chains — variants and control
  {
    id: "thundersurge",
    name: "Thundersurge",
    short: "Surge",
    type: "chain",
    cd: 6,
    mana: 26,
    range: 42,
    jumps: 4,
    jumpRange: 22,
    dmg: 28,
    slowFactor: 0.2,
    slowDuration: 1.0,
  },
  {
    id: "forked_lightning",
    name: "Forked Lightning",
    short: "Fork",
    type: "chain",
    cd: 7,
    mana: 24,
    range: 40,
    jumps: 6,
    jumpRange: 20,
    dmg: 20,
    slowFactor: 0.15,
    slowDuration: 1.2,
  },

  // Sustain / Utility
  {
    id: "thunder_mend",
    name: "Thunder Mend",
    short: "Heal",
    type: "heal",
    cd: 14,
    mana: 24,
    heal: 55
  },
  {
    id: "divine_mend",
    name: "Divine Mend",
    short: "Mend+",
    type: "heal",
    cd: 30,
    mana: 40,
    heal: 160
  },
  {
    id: "storm_sip",
    name: "Storm Sip",
    short: "Mana",
    type: "mana",
    cd: 12,
    mana: 0,
    restore: 40
  },
  {
    id: "mana_well",
    name: "Mana Well",
    short: "Well",
    type: "mana",
    cd: 28,
    mana: 0,
    restore: 120
  },

  // Buffs — damage, haste, fortify
  {
    id: "overload_buff",
    name: "Overload",
    short: "Buff",
    type: "buff",
    cd: 20,
    mana: 30,
    buffMult: 1.4,
    buffDuration: 8,
    speedMult: 1.35
  },
  {
    id: "surge_of_haste",
    name: "Surge of Haste",
    short: "Haste",
    type: "buff",
    cd: 22,
    mana: 32,
    buffMult: 1.15,
    buffDuration: 7,
    speedMult: 1.25,
    atkSpeedMult: 1.6
  },
  {
    id: "fortify",
    name: "Fortify",
    short: "Fort",
    type: "buff",
    cd: 26,
    mana: 28,
    buffMult: 1.1,
    buffDuration: 8,
    defensePct: 0.35
  },

  // Shields — new defensive archetype
  {
    id: "storm_barrier",
    name: "Storm Barrier",
    short: "Barrier",
    type: "shield",
    cd: 18,
    mana: 28,
    duration: 6,
    shieldPct: 0.45,
    invulnDuration: 0.25
  },
  {
    id: "tempest_guard",
    name: "Tempest Guard",
    short: "Guard",
    type: "shield",
    cd: 26,
    mana: 34,
    duration: 5,
    shieldPct: 0.6,
    invulnDuration: 0.5
  },

  // Mobility
  {
    id: "lightning_dash",
    name: "Lightning Dash",
    short: "Dash",
    type: "dash",
    cd: 7,
    mana: 16,
    distance: 14
  },
  {
    id: "blink_strike",
    name: "Blink Strike",
    short: "Blink",
    type: "blink",
    cd: 12,
    mana: 24,
    range: 24
  },

  // Companion/clone
  {
    id: "thunder_image",
    name: "Thunder Image",
    short: "Clone",
    type: "clone",
    cd: 22,
    mana: 40,
    duration: 7,
    rate: 0.5,
    radius: 26,
    dmg: 18
  },

  // Big-impact long cooldowns — nukes/supers
  {
    id: "zeus_judgement",
    name: "Zeus' Judgement",
    short: "Judg",
    type: "nova",
    cd: 42,
    mana: 80,
    radius: 28,
    dmg: 165
  },
  {
    id: "maelstrom",
    name: "Maelstrom",
    short: "Mael",
    type: "storm",
    cd: 40,
    mana: 72,
    radius: 34,
    strikes: 36,
    dmg: 22,
    duration: 9
  },
];

/**
 * Default loadout mapping stays close to the original Q/W/E/R
 */
export const DEFAULT_LOADOUT = ["chain_lightning", "lightning_bolt", "static_field", "thunderstorm"];
