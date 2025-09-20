# Camera & Movement (world.js + main.js)

Responsibilities
- Update player movement and facing based on orders and target proximity.
- Smooth, top‑down camera follow with small look‑ahead and optional shake.
- Keep ground plane recentred and textured to simulate an endless world.

Movement (main.js)
- Orders
  - Right‑click ground: player.moveTarget = point, player.target = null.
  - Right‑click enemy: player.target = enemy, player.moveTarget = null.
  - Attack‑move (A then left‑click ground): player.attackMove = true; player.moveTarget = point.
- Steering
  - Toward target: if distance > WORLD.attackRange * 0.95, move toward target; else attempt basic attack.
  - Toward moveTarget: move until within ~0.6 units, then clear moveTarget.
  - Turn: slerp yaw toward intended direction with player.turnSpeed.
  - Idle facing: if had a target recently, slerp to lastFacingYaw briefly (lastFacingUntil).
- Stop
  - S: clears moveTarget, attackMove, and target; sets holdUntil ~0.4s to avoid immediate re‑acquire.
- Constraints
  - Keep y at ≈1.1 for the player mesh.
  - Brace squash (brief vertical scale) on basic attack (braceUntil window).

Camera (world.js)
- updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake)
  - Target position = player.pos + cameraOffset + lookAhead, where lookAhead = lastMoveDir * small scalar.
  - Lerp camera.position toward target (1 - pow(0.001, dt)).
  - If now < cameraShake.until, add small random offsets scaled by cameraShake.mag.
  - camera.lookAt(player.x, 1, player.z).
- cameraOffset default: (0, 45, 28) for top‑down/angled view.

Ground (world.js)
- updateGridFollow(ground, player)
  - ground.position.x/z = player.x/z.
  - If material map exists: offset map UVs by (player.x * 0.0004, player.z * 0.0004) and mark needsUpdate.

Data Flow
- lastMoveDir is tracked by main.js during movement to feed camera look‑ahead each frame.
- cameraShake is updated by skill strikes (R) and decays via timestamp comparison.

Integration
- Movement and facing run before the camera update in the main loop.
- Ground follow runs after camera update and before HUD/Minimap updates.

Behavior Parity
- Movement thresholds, turn damping, look‑ahead scaling, y clamp, and shake magnitudes match the original monolithic implementation.
