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

i18n.js
- Dynamic localization loader for UI strings.
- Loads JSON bundles from src/locales/en.json and src/locales/vi.json at runtime.
- Persists the selected language to localStorage under key "lang".
- Fallback behavior: until a bundle is loaded, i18n returns the key string itself.

Persistence (localStorage)
- Keys and semantics:
  - lang: "en" | "vi" — selected language code.
  - player.level: number — latest persisted player level.
  - player.xp: number — current XP toward next level.
  - maps.unlocked: JSON array of unlocked map IDs (e.g., ["MAP1","MAP2"]).
  - marks: JSON array of user-placed flags/teleport markers.
  - envPrefs: JSON { rain: boolean, density: number (ENV_PRESETS index), rainLevel: 0|1|2 } — environment options.
  - renderPrefs: JSON { zoom: number (0.6..1.6), quality: "low" | "medium" | "high" } — rendering options; quality applied on reload.
  - audioPrefs: JSON { music: boolean, sfx: boolean } — audio enablement flags.
- Behavior:
  - Level/XP are saved on change and restored on boot if present.
  - Unlocked maps and marks are restored to preserve world continuity.

Usage Notes
- Constants are imported where needed to avoid duplication of tuning values.
- Utilities are pure and side-effect free; safe for unit tests.
- DEBUG flag is respected by input handling to enable dev-only interactions.
- i18n.js lazily loads language packs and persists the selection (localStorage "lang"); default language is Vietnamese ("vi") if none is stored.
- Core progression (player.level/xp), unlocked maps, user marks, environment preferences (envPrefs), rendering preferences (renderPrefs: zoom, quality), and audio preferences (audioPrefs) persist in localStorage to maintain long-term play across sessions.
- Quality preference changes are applied on page reload and are gated by an in-game confirmation overlay from the Settings screen.

Extensibility
- Add new tuning under WORLD and reference them in consumers; avoid per-file magic numbers.
- Extend SKILLS when adding new abilities; use the same cooldown/mana patterns.
- Place additional math/transform helpers into utils.js to keep modules lean.
