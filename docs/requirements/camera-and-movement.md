# Camera & Movement — Functional Requirements

Scope
- Player movement and facing behavior.
- Camera follow, look‑ahead, and lightweight shake.

Player Movement
- Move Commands:
  - Right‑click ground sets moveTarget.
  - Right‑click enemy sets target and clears moveTarget.
  - Arrow keys and virtual joystick: continuous movement in the intended direction; releasing stops near‑immediately (~0.1s).
- Movement Toward Targets:
  - If target exists and is alive:
    - If distance > attackRange * 0.95, move toward target.
    - Else attempt basic attack (respects attack cooldown).
  - If moveTarget exists:
    - Move until within ~0.6 units, then clear moveTarget.
- Facing:
  - While moving, smoothly slerp yaw toward movement direction using configured turnSpeed.
  - While stationary with a valid target, slerp to face the target; briefly persist last facing for a short time window when target is lost.
- Stop:
  - Pressing S clears current orders (moveTarget, attackMove, target) and applies a short holdUntil to suppress immediate re‑acquisition.

Camera Follow
- Top‑down/angled view:
  - Camera maintains a fixed offset above/behind the player.
  - Apply a small look‑ahead based on recent movement to hint direction.
- Smoothing:
  - Camera position lerps toward target location each frame for smooth follow behavior.
  - Camera looks at the player position with a small Y offset.
- Shake:
  - Short, lightweight shake on larger lightning strikes; intensity decays quickly.

Ground Scrolling (Endless Feel)
- Recenter the ground plane to the player’s XZ.
- Offset ground texture UVs slightly with movement to enhance the endless‑world illusion.

Acceptance Criteria
- Player moves precisely to right‑clicked ground points and stops within a small tolerance.
- Player chases targets until in attack range, then attacks; stops pursuing if target dies/clears.
- Facing transitions are smooth both during movement and while stationary.
- Pressing S reliably cancels orders and briefly prevents auto‑acquire.
- Camera follows smoothly with subtle look‑ahead and exhibits small shakes during major strikes.
- Releasing arrow keys/virtual joystick stops movement within ~0.1s.
- Ground recenters and UV offsets update while the player moves.
