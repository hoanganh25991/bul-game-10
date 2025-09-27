# UI Screens & Overlays (Settings, Guide, Hero Preview)

Scope
- Consolidates technical details for UI screens and in-game overlays implemented under `src/ui/*`.
- Covers:
  - Settings screen (tabs, sliders with numeric badges, quality confirm overlay, persistence)
  - Guide overlay (non-blocking guide with i18n and Settings auto-close/reopen)
  - Hero Skills Preview overlay (key-assign UI replacing native prompts and preview flow)

Modules
- Settings: `src/ui/settings/index.js`
- Guide: `src/ui/guide.js`
- Hero Preview: `src/ui/hero/preview.js`
- i18n helpers: `src/i18n.js` (`t`, `loadLocale`, `getLanguage`)

Settings Screen

setupSettingsScreen({ t, startInstructionGuide, elements, environment, render, audioCtl })
- Entrypoint that wires the Settings screen controls.
- Parameters:
  - t: translation function (defaults to `i18n.t`)
  - startInstructionGuide: callback to start the Guide overlay
  - elements: optional DOM references to buttons/panel
  - environment: adapter with `getState()`, `setState()`, `ENV_PRESETS`, `initEnvironment()`, `toggleRain()`, `setRainLevel()`, `updateEnvironmentFollow()`
  - render: adapter with `getQuality()`, `baseCameraOffset`, `cameraOffset`
  - audioCtl: adapter with `getMusicEnabled()`, `setMusicEnabled()`, `getSfxEnabled()`, `setSfxEnabled()`, and `audio` methods

ensureSettingsTabs(settingsPanel, t, startInstructionGuide)
- Creates a tab bar and splits existing `.row` elements into three panels:
  - General: language selection and instructions
  - Environment: rain toggle, environment density, rain density, zoom, quality
  - Controls: informational row placeholder
- Applies i18n to the panel once tabs are built.
- Uses dataset guard (`tabsReady=1`) to avoid rebuilding.

Environment controls (initEnvironmentControls)
- Rain Toggle (`#envRainToggle`)
  - Toggles rain on/off. If on, reapplies rain level.
  - Persists in `envPrefs.rain`.
- Environment Density (`#envDensity`)
  - Slider UI scale: 1..10 (numeric badge displayed).
  - Maps to `ENV_PRESETS` index [0..N-1].
  - Applies on commit via `change` event (no live drag).
  - Rebuilds environment with selected preset, then reattaches follow.
  - Persists in `envPrefs.density`.
- Rain Density (`#rainDensity`)
  - Slider UI scale: 1..10 (numeric badge).
  - Maps to discrete rain level 0..2.
  - Applies on commit via `change` event.
  - Persists in `envPrefs.rainLevel`.
- Persistence:
  - `localStorage["envPrefs"] = { rain, density, rainLevel }`.

Rendering controls
- Zoom (`#zoomSlider`) — initZoomControl(render)
  - Slider UI scale: 1..10 (numeric badge).
  - Maps to camera scalar ∈ [0.6 .. 1.6].
  - Applies on commit (change) by scaling `render.baseCameraOffset` into `render.cameraOffset`.
  - Persists to `renderPrefs.zoom`.
- Quality (`#qualitySelect`) — initQualitySelect(render, t)
  - Options: "high" | "medium" | "low".
  - Changing selection does NOT apply immediately.
  - Shows in-game confirm overlay via `showReloadConfirm(t)`:
    - i18n keys: `settings.render.reloadTitle`, `settings.render.reloadDesc` (fallback `settings.render.reloadPrompt`), buttons `btn.cancel`, `btn.yes`.
    - Backdrop click and Escape cancel; Enter confirms.
  - On confirm Yes:
    - Persist `renderPrefs.quality = nextQ`.
    - Reload page (`window.location.reload()`).
  - On cancel:
    - Revert `<select>` to previous value.
- Persistence:
  - `localStorage["renderPrefs"] = { zoom, quality }`.

Confirm Modal (Settings)
- `showReloadConfirm(t)`: DOM overlay with translucent backdrop and compact dialog box.
- Style is native to the game (no `window.confirm`), keyboard accessible (Escape, Enter), and localized.

Slider Value Badge
- `attachSliderValueDisplay(inputEl, format)` appends a small numeric badge next to range inputs.
- Updates on `input` and `change` events; used by Zoom, Env Density, Rain Density.

Guide Overlay

startInstructionGuide()
- Builds a non-blocking overlay that highlights key UI elements with:
  - Focus rectangle around the element
  - Hand pointer near the focus rectangle
  - Tooltip with title and description, plus Prev/Next/Done/Close controls
- i18n:
  - Uses `t("guide.nav.previous" | "guide.nav.next" | "guide.nav.done" | "guide.nav.close")`
  - For each step, uses `t("guide.[key].title")` and `t("guide.[key].desc")` with fallback to built-in strings if translation not loaded yet.
  - After `loadLocale(getLanguage())` resolves, the overlay re-applies translations.
- Steps (auto-skip if element not found):
  - settings, hero, camera, portal, mark, skills, hud, joystick.
- Non-blocking behavior and Settings integration:
  - If Settings is open, it is temporarily closed when starting the Guide to reveal underlying UI.
  - A callback is stored (`window.__guideAfterCloseAction`) to reopen Settings after the Guide closes.
- Resize handling:
  - On window resize/orientation change, recomputes positions and reflows tooltip.

Hero Skills Preview Overlay

initHeroPreview(skills, { heroScreen })
- Wraps `skills.previewSkill` to present an in-game overlay rather than using native prompts.
- Key selection overlay (`showKeySelectOverlay(def)`):
  - Grid of Q/W/E/R buttons, with keyboard shortcuts (Q/W/E/R) and Escape to cancel.
  - Shows current skill names beneath keys when available.
- Preview/cast flow:
  - Fades out Hero Screen.
  - Shows a compact top-centered countdown overlay:
    - Countdown duration = remaining cooldown of the chosen key plus 2 seconds (ceiling).
    - When done, persists assignment (`persistAssignment`) and casts the selected key (`skills.castSkill(key)`).
    - Displays a brief "⚡ Casted!" confirmation.
  - Fades Hero Screen back in.
- Persistence:
  - Saves the chosen skill binding into the loadout via `saveLoadout` (`DEFAULT_LOADOUT` conventions).
  - Dispatches `loadout-changed` event and refreshes runtime labels if exposed by host (`window.updateSkillBarLabels`).
- Notes:
  - Overlay strings are currently inline; can be localized by wiring `t()` similar to Settings/Guide.

i18n Integration
- Settings and Guide are localized using `i18n.t`.
- Guide text auto-updates after locale load via `loadLocale(getLanguage())`.
- Extend Hero Preview overlays to use i18n for full localization parity.

Accessibility
- Guide overlay root marks `role="dialog"` and `aria-modal="true"`.
- Confirm overlay supports keyboard (Escape cancels, Enter confirms).
- Overlays avoid blocking the entire viewport so underlying UI remains visible for context.

Acceptance Checklist
- Settings: Sliders display numeric badges; Zoom persists on commit; Quality change shows confirm, persists on Yes, and reloads; Cancel reverts selection.
- Guide: Starts even if Settings is open, temporarily closes Settings, and reopens it on exit; highlights are visible; text is localized; navigation works; reflows on resize.
- Hero Preview: Native prompt replaced by in-game key selection overlay; countdown + cast sequence executes; binding is persisted and reflected in UI.
