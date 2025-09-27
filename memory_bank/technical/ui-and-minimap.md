# HUD & Minimap (ui/hud.js)

Responsibilities
- Bind and update 2D HUD elements (HP/MP/XP bars and texts, Level).
- Expose cooldown overlay elements for the skills system.
- Render the 200x200 minimap centered on the player.
- Provide center message helpers for critical states.

UIManager
- constructor()
  - Queries and stores DOM references:
    - HP/MP/XP bars: #hpFill, #mpFill, #xpFill
    - HP/MP/XP text: #hpText, #mpText, #xpText
    - Level: #levelValue
    - Cooldowns: #cdQ, #cdW, #cdE, #cdR
    - Minimap: #minimap (2D canvas)
    - Center message: #deathMsg (used for death/recall messages)
- getCooldownElements(): { Q, W, E, R, Basic }
  - Returned object is passed to SkillsSystem so it can render cooldown wedges and countdowns.
- setCenterMsg(text: string)
  - Shows center overlay text for the player (e.g., death/recall).
- clearCenterMsg()
  - Hides the center overlay.
- updateHUD(player)
  - Calculates HP/MP/XP ratios and updates bar widths and numeric text.
  - Updates level text.
- updateMinimap(player, enemies, portals, villages)
  - Clears the 200x200 canvas and draws:
    - Background and frame.
    - Village rings:
      - The origin village ring (using REST_RADIUS) relative to the player-centered view.
      - Additional rings for discovered dynamic villages via villages.listVillages(), each with its own radius and center.
    - Village and return portals as small squares (if present).
    - Enemies as small red squares (alive only).
    - Player dot at center.
  - Uses worldToMinimap(x, z, centerX, centerZ, scale~0.8) from utils.
  - Pulls portals from an initPortals(scene) instance via:
    - portals.getVillagePortal()
    - portals.getReturnPortal()

Integration
- UIManager (src/ui/hud.js) is created once in main.js. UI screens live under src/ui/* (guide, settings, hero).
- SkillsSystem is constructed with UIManager.getCooldownElements() to render cooldowns each frame.
- updateHUD and updateMinimap are called from the main loop every frame after the world state updates.
- Center messages are triggered by gameplay events:
  - Death (respawn countdown)
  - Recall prompt (frozen until portal click)

Behavior Parity
- Bars, texts, cooldown wedge overlays, and minimap visuals match the original monolithic implementation.
- No gameplay tuning changes are introduced by UI modularization.
