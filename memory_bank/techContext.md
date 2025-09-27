# Technical Context

Purpose
Document the technologies, frameworks, development setup, and technical constraints used by the project so agents (Cline) and engineers can reproduce, extend, and reason about the codebase.

Core technologies
- Language: JavaScript (ES2020+), plain ES modules.
- Markup & styles: HTML5, CSS3 (multiple css files under `css/`).
- 3D: Three.js used where 3D is required (kept isolated).
- Runtime: Browser (desktop + mobile).
- No required build step — project is runnable by opening `index.html` or serving statically.

Repository structure (high level)
- index.html — single entry/launcher for the demo/game.
- src/ — application source code (modules)
  - src/main.js — bootstrapping and wiring
  - src/i18n.js — translation helper (t)
  - src/skills_pool.js — skill definitions and metadata
  - src/skills.js — skill behaviors
  - src/maps.js — map manager and generation
  - src/uplift.js — uplift persistence and popup
  - src/ui/ — DOM UI renderers and panels
- src/locales/ — translation files
  - en.json — canonical English strings
  - vi.json — Vietnamese translations (completed)
- css/ — visual stylesheets

Development / run instructions
- Quick local preview (no build):
  - Open `index.html` in a browser (drag file or use `open index.html` on macOS).
  - Recommended: serve via a local static server to avoid CORS/local-file restrictions:
    - Python 3: `python -m http.server 8000`
    - Node (if installed): `npx serve .` or `npx http-server`
  - Then open `http://localhost:8000` (or appropriate port).
- Dependency management:
  - The project intentionally avoids heavy dependencies. If you add dependencies, prefer lightweight modules and document them in this file.

Tooling (recommended)
- Code editor: VSCode (used by the maintainer).
- Linting / formatting: Not enforced by repo; keep consistent style. When modifying JSON locale files, ensure valid JSON (no trailing commas).
- Git: Use `git` for history; renames were done with `git mv` where possible to preserve history.

Locale & i18n notes
- `src/i18n.js` exposes a `t(key)` function that loads translations from `src/locales/{lang}.json`.
- English (`en.json`) is canonical — when adding keys, add to `en.json` first, then to other locale files.
- UI modules call `t('skills.names.<id>')`, `t('skills.shorts.<id>')`, and `t('maps.*')`. Ensure keys exist in both `en.json` and `vi.json`.

Persistence & storage
- localStorage is used for light persistence:
  - `upliftChoices_v1` — uplift choices
  - loadout and other preferences use small helper functions in respective modules.
- Avoid large payloads in localStorage and namespace keys.

Testing & debugging tips
- Use browser DevTools console for runtime errors (uncaught exceptions, missing keys).
- To find missing translations, search codebase for `t(` occurrences and compare with keys in `src/locales/en.json`.
- To simulate uplift popup: call `promptBasicUpliftIfNeeded({ level: 5 })` from the console (or set player.level to milestone and call the function).
- To inspect SKILL_POOL: open `src/skills_pool.js` in editor to see skill IDs that must map to translation keys.

Notes for contributors
- When adding features, document any required runtime configurations and new translation keys in `memory-bank/` files.
- Add new persistent keys to a central list (suggested `src/config.js`) and document them in this file.
