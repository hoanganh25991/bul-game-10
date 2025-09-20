# Utilities, Config, and Constants

Overview
- Centralizes runtime flags, tuning constants, and pure helper utilities used across modules.

config.js
- DEBUG: boolean derived from URL ?debug flag to enable developer conveniences.
- HERO_MODEL_URL: optional URL from ?model used to load an external GLTF hero model.

constants.js
- COLOR: palette for player/enemy, portals, HUD theming.
- WORLD: tuning values for world size, speeds, ranges, enemy counts, AI radii, damages, cooldowns.
- STATS_BASE: base HP/MP, regen, XP to level baseline.
- SKILLS: Q/W/E/R configuration including cooldowns, mana costs, radii, ranges, jump counts, durations, damage.
- VILLAGE_POS, REST_RADIUS: village center and regen ring radius.

utils.js
- worldToMinimap(x, z, centerX, centerZ, scale): map world XZ to minimap pixels (player-centered).
- clamp01(v), lerp(a, b, t), randRange(min, max).
- distance2D(a, b), dir2D(from, to): planar distance/direction helpers.
- now(): high-resolution time in seconds.
- makeNoiseTexture(size): returns a subtle CanvasTexture for the ground.

Usage Notes
- Constants are imported where needed to avoid duplication of tuning values.
- Utilities are pure and side-effect free; safe for unit tests.
- DEBUG flag is respected by input handling to enable dev-only interactions.

Extensibility
- Add new tuning under WORLD and reference them in consumers; avoid per-file magic numbers.
- Extend SKILLS when adding new abilities; use the same cooldown/mana patterns.
- Place additional math/transform helpers into utils.js to keep modules lean.
