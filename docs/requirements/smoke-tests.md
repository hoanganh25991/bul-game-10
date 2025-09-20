# Test Checklist (Smoke)

Load & Bootstrap
- Load index.html
  - Renderer canvas visible, transparent background.
  - Hero and ground are rendered.
  - Enemies spawn around the village.
  - HUD and minimap are visible.

Basic Controls
- Right‑click ground: player moves; arrives and stops near the point.
- Right‑click enemy: player targets enemy; attacks when in range.
- S: player stops and briefly avoids re‑acquiring targets.
- A then left‑click enemy: player attacks.
- A then left‑click ground: player attack‑moves toward point.

Skills
- Q near enemies: chain beams jump across multiple enemies; HP decreases per hit.
- W aim mode: aim ring follows mouse; left‑click casts; enemies in radius are damaged and slowed (slow ring visible).
- E toggle: periodic strikes appear around player; MP drains per tick; stops when out of MP or time ends.
- R: random strikes occur over time; nearby enemies take damage; small camera shake visible.

Portals & Recall
- B: return portal spawns; player is frozen and message prompts to click portal.
- Click return portal (or near it): teleports to village; player unfreezes; portals appear on minimap.
- Village ring: while standing inside, HP/MP regen noticeably faster.

Death & Respawn
- Allow player to die: center message shows; after short delay, respawn at village with full HP/MP and brief invulnerability.

UI & Minimap
- HUD values (HP/MP/XP/Level) update in real time.
- Cooldown wedges animate; numbers count down; brief flash when ready.
- Minimap shows player at center, enemies as red dots, village ring, and portals as squares.

Window
- Resize browser: canvas resizes and camera aspect remains correct.

Stability
- No errors in browser console during normal gameplay sessions.
