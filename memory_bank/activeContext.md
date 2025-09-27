# Active Context

Purpose
This file captures the current work focus, recent changes, open questions, and immediate next steps. It is the single most frequently-updated document intended for agents (like Cline) or humans to quickly pick up where development left off.

Current focus (most recent work)
- Fixing and completing localization for Vietnamese (src/locales/vi.json).
  - Ensured skill names/shorts and maps keys exist.
  - Resolved JSON formatting errors and saved a valid vi.json.
- Uplift system (src/uplift.js) — popup and persistence implemented; ensure translations exist for uplift keys.
- Hero UI: skill, skillbook, and maps tabs (src/ui/hero/tabs/*.js) use translation keys; confirmed those keys are present in locales.
- Memory bank migration: renamed `docs` -> `memory-bank` and added projectbrief.md and productContext.md.

Recent changes (chronological)
- Renamed repository folder `docs` to `memory-bank` to act as a canonical "memory" location for agents.
- Added memory-bank/projectbrief.md and memory-bank/productContext.md.
- Repaired and completed src/locales/vi.json translations for skills, shorts, maps, uplift, and related UI strings.

Open/active issues and TODOs
- Verify runtime that switching to Vietnamese shows localized strings for:
  - Hero -> Skills tab
  - Hero -> Skillbook tab
  - Hero -> Maps tab (including synthesized endless map names/descriptions)
  - Uplift popup and applied messages
- Run a search for t("...") usages to ensure no translation keys remain missing. If missing keys are found, either:
  - Add translated strings to vi.json, or
  - Provide English fallbacks automatically (copy from en.json).
- Confirm no regressions were introduced by renaming docs -> memory-bank (CI, build steps, external references).
- Keep activeContext updated with any new decisions, feature toggles, or recently changed files.

Important recent files / where to look
- src/locales/vi.json — current Vietnamese translations (skill names & shorts, maps, uplift).
- src/locales/en.json — canonical English keys used as reference.
- src/ui/hero/tabs/skills.js
- src/ui/hero/tabs/book.js
- src/ui/hero/tabs/maps.js
- src/uplift.js

How to update this file
- Edit with short, actionable notes about what you changed and why.
- Record decisions, links to commits (if relevant), and commands to reproduce the current dev environment.
- Keep entries concise and date-stamped if recording long-running work.

Example quick entry
- 2025-09-26: Added missing vi locale keys for skills and maps; repaired JSON formatting. Next: search for remaining t() usages and add missing keys.
