# HUD & Minimap — Functional Requirements

Scope
- 2D UI elements for player stats and skill cooldowns.
- Minimap (200x200 canvas) centered on the player showing nearby world actors.

HUD
- Bars and text for:
  - HP, MP: bar widths reflect current ratios; text shows current/max values.
  - XP: bar reflects progress toward level-up; text shows current/required XP.
  - Level: displayed as a numeric value.
- Skill Cooldowns:
  - One overlay per skill (Q/W/E/R).
  - Shows a conic-gradient wedge representing remaining cooldown and a numeric countdown.
  - Brief “ready” flash effect when a skill comes off cooldown.
  - When countdown reaches 0, hide the numeric label (no "0.0" displayed).

Minimap
- 200x200 canvas rendering:
  - Background panel with subtle frame.
  - Player-centered coordinate space.
  - Village ring drawn relative to player’s center using REST_RADIUS.
  - Portals: show village portal and return portal as small squares.
  - Enemies: draw small red markers for each alive enemy.
  - Player: small blue dot at the center.
- Mapping:
  - worldToMinimap(x, z, centerX, centerZ, scale) converts world XZ to canvas coordinates.
  - Default scale ~0.8 pixels per world unit.

Layout
- Top-right button group contains Settings and Hero buttons.
- Minimap is positioned below this top-right button group.
- A Portal button is shown above the skills radial on the right; consistent styling across desktop/mobile.

Screens
- All major screens are full-screen overlays:
  - Splash/Intro
  - Settings
  - Hero (directly accessible)

Center Messages
- Overlay text for critical states such as:
  - Death (“You died. Respawning…” until respawn completes).
  - Recall/Portals (“Click the portal to travel to the village”) while frozen.

Acceptance Criteria
- HUD bars and text update continuously to match player HP/MP/XP and Level.
- Cooldown overlays animate down with wedge and countdown text; show a short flash when ready.
- Minimap displays village ring, portals, enemies, and player relative to player-centered view.
- Center message shows during death/respawn delay and recall freeze; hides appropriately afterward.
