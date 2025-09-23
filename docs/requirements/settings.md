# Settings — Functional Requirements

Scope
- Centralized screen for runtime options organized by tabs:
  - General: language and instructions
  - Environment: rain toggle, environment density, rain density
  - Rendering: zoom and quality
  - Controls: informational (no bindings UI yet)
- Launchable via the Settings button in the top-right cluster.

Tabs
- Three tabs are shown in a tab bar: General, Environment, Controls.
- Clicking a tab switches the visible panel without rebuilding content.

Environment
- Rain Toggle:
  - Turns rain VFX on/off at runtime.
  - If enabled, rain level can be adjusted.
- Environment Density:
  - Slider UI scale 1..10 with a numeric badge displayed next to the slider.
  - Maps 1..10 to ENV_PRESETS index [0..N-1] (non-linear by preset count).
  - Applies on commit (change event), not on live drag.
  - Recreates the environment from the selected preset, then reattaches follow behavior.
- Rain Density:
  - Slider UI scale 1..10 with a numeric badge displayed next to the slider.
  - Maps 1..10 to rain level 0..2 (discrete).
  - Applies on commit (change event), not on live drag.

Rendering
- Zoom:
  - Slider UI scale 1..10 with a numeric badge displayed next to the slider.
  - Maps 1..10 to a camera scalar in [0.6 .. 1.6].
  - Applies on commit (change event), not on live drag.
- Quality (High / Medium / Low):
  - Changing the selection does not apply immediately.
  - Show a native in-game confirm overlay:
    - Title: i18n "settings.render.reloadTitle"
    - Desc: i18n "settings.render.reloadDesc" (or "settings.render.reloadPrompt")
    - Buttons: i18n "btn.cancel" and "btn.yes"
  - If user selects Yes:
    - Persist the chosen quality to localStorage (renderPrefs.quality)
    - Reload the page (window.location.reload()) to apply fully
  - If user selects Cancel:
    - Revert the select box to the previous value
  - No dynamic quality switching logic is required or implemented.

Audio
- Music and SFX toggles persist and apply immediately (outside the scope of this change but present in UI).

Persistence
- envPrefs in localStorage:
  - { rain: boolean, density: number (ENV_PRESETS index), rainLevel: 0|1|2 }
- renderPrefs in localStorage:
  - { zoom: number (0.6..1.6), quality: "low" | "medium" | "high" }
- Preferences are loaded on boot and used to initialize UI controls and state.

i18n
- Labels and overlay texts use i18n where available:
  - settings.tabs.general | settings.tabs.environment | settings.tabs.controls
  - settings.env.rain | settings.env.density | settings.env.rainDensity
  - settings.render.zoom | settings.render.quality
  - settings.render.reloadTitle | settings.render.reloadDesc | settings.render.reloadPrompt
  - btn.cancel | btn.yes

Acceptance Criteria
- Sliders for Zoom, Environment Density, and Rain Density all display a numeric value beside the slider.
- Density and Rain level apply on commit (change), not during drag.
- Zoom updates on commit and persists the chosen zoom to localStorage.
- Selecting a different Quality always prompts with an in-game confirm overlay.
  - On Yes: quality preference is saved and the game reloads.
  - On Cancel: no change is saved and the select reverts to its previous state.
- All relevant labels and overlay texts resolve via i18n (fall back to keys only if the language file is not yet loaded).
