# Leveling, Experience, and Progression

This document explains the hero leveling system, experience (XP) flow, stat scaling, and enemy balancing. The goal is to enable an endless play loop where the hero steadily grows stronger while enemies scale to maintain challenge.

## Overview

- Each killed enemy grants XP to the hero.
- When XP crosses the current `xpToLevel` threshold, the hero levels up.
- Leveling increases core stats (HP, MP, regen) and base damage.
- The XP threshold increases after each level to stretch progression across time.
- Enemies scale with hero level (HP and damage) and respawn to maintain density.
- UI HUD reflects current Level and XP.

## Key Files

- Runtime logic:
  - `src/entities.js` (Player.gainXP, Enemy scaling and respawn helper)
  - `src/main.js` (enemy spawn, death → XP grant, respawn schedule)
  - `src/skills.js` (basic attack and some skills damage coupling to hero level)
  - `src/ui/hud.js` (HUD bars, level indicator, level-up feedback)
- Tuning knobs:
  - `src/constants.js` (`STATS_BASE`, `WORLD`, `SCALING`)

## Tuning Knobs

Defined in `src/constants.js`:

- WORLD
  - `basicAttackDamage` (baseline hero base damage)
  - `enemyRespawnDelay` (seconds before a dead enemy respawns)
- STATS_BASE (hero starting stats)
  - `hp`, `mp`, `hpRegen`, `mpRegen`, `xpToLevel`
- SCALING
  - `xpGrowth` (multiplier applied to `xpToLevel` on each level up)
  - `hero.hpGrowth`, `hero.mpGrowth`, `hero.hpRegenGrowth`, `hero.mpRegenGrowth`
  - `hero.baseDamageGrowth` (basic attack growth per level)
  - `hero.skillDamageGrowth` (optional skill growth per level; applied where enabled)
  - `enemy.hpGrowthPerLevel`, `enemy.dmgGrowthPerLevel`

## Hero Progression

- Initial stats are taken from `STATS_BASE`.
- On level up (`Player.gainXP`):
  - `level += 1`
  - HP/MP are multiplied by growth factors and refilled to max
  - Regen rates are multiplied by growth factors
  - `baseDamage` is multiplied by `SCALING.hero.baseDamageGrowth`
  - `xpToLevel` is multiplied by `SCALING.xpGrowth`
- Level-up UI:
  - Dispatches a global event `player-levelup` so HUD/UX can animate or provide feedback.

### Damage

- Basic attack damage uses `player.baseDamage` which scales with hero level.
- Skills:
  - Damage can optionally be scaled via `SCALING.hero.skillDamageGrowth`.
  - The project currently applies level scaling to Chain (Q) and Beam-type skills.
  - AOE/Nova/Aura/Storm use fixed base numbers to maintain predictable crowd control pacing and avoid runaway burst. This is a tuning decision and can be revisited by applying `scaleSkillDamage()` uniformly.

## XP Flow

- Each `Enemy` has `xpOnDeath` proportional to its max HP.
- In `updateEnemies`, on death:
  - SFX/visuals play
  - The player receives `player.gainXP(enemy.xpOnDeath)`
  - The enemy is scheduled to respawn after `WORLD.enemyRespawnDelay` seconds

## Enemy Scaling and Respawn

- At creation and respawn, enemies scale with hero level:
  - HP: multiplied by `SCALING.enemy.hpGrowthPerLevel^(level-1)`
  - Damage: multiplied by `SCALING.enemy.dmgGrowthPerLevel^(level-1)`
- Respawn:
  - Enemies are scheduled to respawn to keep density up
  - Respawned enemies roll new base HP and re-derive `xpOnDeath` from current HP
  - Spawn positions respect a minimum distance from village (`REST_RADIUS`) and within `WORLD.enemySpawnRadius`

## Balancing Guidance

- Lengthen progression: increase `SCALING.xpGrowth` or `STATS_BASE.xpToLevel`
- Make hero sturdier: increase `hero.hpGrowth`, `hero.mpGrowth`, regen growth, or base `STATS_BASE` values
- Increase hero offensive growth: increase `hero.baseDamageGrowth` (and optionally `hero.skillDamageGrowth`)
- Tougher enemies: increase `enemy.hpGrowthPerLevel` and/or `enemy.dmgGrowthPerLevel`
- Density and flow: adjust `WORLD.enemyCount`, `WORLD.enemyRespawnDelay`, and spawn radius

## UI/UX

- HUD already displays Level, HP/MP, and XP progress (`src/ui/hud.js`).
- On level up, HUD animates and skills briefly glow for feedback.

## Extending

- To apply skill damage scaling to all skills:
  - Replace direct `SK.dmg` calls with `scaleSkillDamage(SK.dmg)`.
- To add different XP sources (e.g., objectives), call `player.gainXP(amount)`.
- To decouple scaling from hero level (e.g., time-based difficulty), add a global progression factor and replace `level` inputs accordingly.
