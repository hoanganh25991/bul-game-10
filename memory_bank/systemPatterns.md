# System Patterns

Purpose
Document the high-level architecture, key technical decisions, and recurring design patterns in the repository so agents (Cline) and engineers can quickly understand how components relate and where to make changes.

Overview
- Language / platform: Vanilla JavaScript (ES modules), CSS, HTML. Minimal build required — app runs by opening `index.html`.
- Runtime: Browser (desktop + mobile), uses DOM as primary UI layer with some 3D powered by Three.js where needed.
- Data-driven content: Skills, maps, entities are declared as data (arrays/objects) and consumed by generic renderers (e.g., SKILL_POOL, MapManager).
- Local persistence: localStorage for player preferences and uplift/loadout state.

Key modules and responsibilities
- src/main.js
  - App initialization and wiring: sets up game loop, scene, and registers UI hooks.
- src/ui/*
  - UI rendering and event wiring (DOM-only). Tabs and panels live under `src/ui/hero/tabs/` and are responsible for localized labels via `t()` from `src/i18n.js`.
  - Important files:
    - src/ui/hero/tabs/skills.js — Render skills tab (loadout + pool + assign bar)
    - src/ui/hero/tabs/book.js — Skillbook and detail preview
    - src/ui/hero/tabs/maps.js — Map list and load-more logic
    - src/ui/skillbar.js — HUD skill bar rendering & icon helpers
- src/skills_pool.js
  - Data source for `SKILL_POOL` (skill definitions). Keep skill metadata here (id, name, short, type, cd, mana, dmg, radius, etc.).
- src/skills.js
  - Skill runtime behaviors and application (casting, preview hooks).
- src/maps.js / MapManager (mapManager)
  - Base map data & deterministic endless generation; exposes getCurrentIndex, setCurrent, listMaps, emojiForIndex, getUnlockedMax.
- src/entities.js, src/world.js, src/villages.js
  - Game entities, spawn logic, world/worldstate – used by combat and map systems.
- src/uplift.js
  - Uplift choices UI and persistence; exports getters like getBasicUplift, getUpliftSummary, and the popup `promptBasicUpliftIfNeeded`.
- src/i18n.js
  - Provides `t()` translation helper to read keys from `src/locales/*.json`. UI modules always call `t('...')` and expect locale files to contain matching keys.

Design patterns & conventions
- Data-driven rendering
  - UI lists are rendered from arrays (e.g., SKILL_POOL, maps list). Add/modify items by changing data, not UI code.
- Defensive DOM manipulation
  - Try/catch around DOM writes in UI code to tolerate partial rendering in constrained environments.
- Localized keys
  - All human-facing text in UI modules is retrieved via `t("...")` keys rather than inline strings. Locale files live in `src/locales/{en.json,vi.json}`.
- Non-intrusive persistence
  - localStorage keys are namespaced (e.g., `upliftChoices_v1`) and read/written through small helper functions (load/save) to centralize format changes.
- Minimal dependencies
  - Prefer no external dependencies. Use Three.js only for 3D rendering (kept isolated).
- Immutable-ish update flow for state
  - When updating loadouts or choices, functions create shallow copies to avoid accidental mutation of shared references (see loadout handling in `src/ui/hero/tabs/skills.js`).
- Event-driven signals
  - Modules dispatch DOM events or call global hooks to notify other systems (e.g., `window.dispatchEvent(new Event('loadout-changed'))`).

Testing & validation patterns
- Maintain small utility helper functions in `src/utils.js` for deterministic behavior (random seeds, deterministic synthesizeMap).
- Validate locale completeness by searching for `t(` usages and ensuring keys exist in `src/locales/en.json` (canonical) and translated files (vi.json).
- Use quick smoke tests: open `index.html`, switch languages, and interact with Hero -> Skills / Skillbook / Maps / Uplift popup flows.

Where to add new patterns
- If adding new domain data (e.g., weapons, items), follow existing pattern:
  - Add data file (e.g., `src/items_pool.js`) exporting a canonical array.
  - Add UI renderer in `src/ui/*` referencing `t()` keys for names/shorts/descriptions.
  - Provide translations in `src/locales/en.json` and other locales.
- If adding new persistent player prefs, add getter/setter helper and namespace key in a central place (e.g., `src/config.js` or small `src/storage.js`).

Notes for agents (Cline)
- Prefer small, localized edits over large rewrites — preserve public APIs and behavior.
- When patching locale files, ensure valid JSON (parseable) and add only the needed keys; prefer copying from `en.json` as fallback.
- When editing UI modules, update only dependent rendering code and avoid changing core game loop logic located in `src/main.js` or `src/world.js` unless necessary.

Links / files to inspect for architecture decisions
- src/main.js
- src/i18n.js
- src/skills_pool.js
- src/skills.js
- src/maps.js
- src/uplift.js
- src/ui/hero/tabs/*.js
- src/entities.js / src/world.js
