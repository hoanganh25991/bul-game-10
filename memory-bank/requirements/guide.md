# Guide — Functional Requirements

Scope
- An in-game, non-blocking guided overlay to highlight key UI elements and describe their functions.
- Walks the player through buttons and HUD areas without obscuring the gameplay/UI beneath.
- Usable at any time via the Guide button.

Steps (default sequence)
- Settings (btnSettingsScreen)
- Hero (btnHeroScreen)
- Camera Toggle (btnCamera)
- Portal (btnPortal)
- Mark Location (btnMark)
- Skills (skillWheel or btnBasic)
- HUD (stats or hud)
- Joystick (joystick or joyKnob)
- Notes:
  - Steps without a matching element are skipped at runtime (robust to layout changes).
  - The highlight box and hand pointer are positioned around the target element.

Overlay Behavior
- Focus Ring:
  - A visible highlight rectangle surrounds the target element (with padding).
  - A hand indicator is placed near the bottom-right of the focus area.
- Tooltip:
  - Shows a title and description near the highlighted element.
  - Positions intelligently above/below and clamps within the viewport.
- Non-blocking:
  - The overlay does not prevent viewing underlying UI; it avoids covering the entire screen with an opaque blocker.
  - If the Settings panel is open when the Guide starts, it is temporarily closed to prevent covering underlying UI.
  - After the Guide finishes or is closed, the Settings panel re-opens automatically if it was closed by the Guide.
- Resizing:
  - On window resize/orientation change, the focus rectangle and tooltip reflow around the current target.

Navigation
- Controls:
  - Previous / Next buttons navigate steps.
  - Close icon exits immediately.
  - On the last step, the Next button label becomes Done.
- Keyboard:
  - Optional keyboard navigation may be supported by the overlay implementation.

i18n
- All labels, titles, descriptions resolve via i18n with fallback to built-in strings:
  - Titles/Descriptions per step: guide.[key].title | guide.[key].desc (keys: settings, hero, camera, portal, mark, skills, hud, joystick)
  - Navigation labels: guide.nav.previous | guide.nav.next | guide.nav.done | guide.nav.close
- The overlay should re-apply translations after locale load to update visible text.

Accessibility
- Overlay root has role="dialog" and aria-modal="true".
- Close button has an accessible label (guide.nav.close).
- Ensure focus management does not trap the user; overlay is informational and non-blocking.

Acceptance Criteria
- When starting the Guide while Settings is open, the Settings panel is closed for clarity and is reopened after exiting the Guide.
- The highlight focus box appears around each step’s target element with a visible outline; the underlying element remains visible.
- Tooltip shows localized title and description; falls back to default strings if a translation bundle is not yet loaded.
- Previous/Next/Done/Close controls work; on the last step, Next shows Done and exits when pressed.
- Resizing the window repositions the highlight and tooltip correctly without visual misalignment.
