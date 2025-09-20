# Update Loop (main.js)

Responsibilities
- Drive the game’s per-frame sequencing with requestAnimationFrame.
- Maintain stable timing by clamping dt to avoid large steps.
- Call each subsystem in a deterministic order to preserve behavior.

Timing
- requestAnimationFrame(animate) schedules the next frame.
- lastT stores the previous timestamp; dt = min(0.05, t - lastT) clamps delta time to 50 ms max.
- Use now() helper (performance.now()/1000) for timestamps in seconds.

Per-Frame Order (as implemented)
1) updatePlayer(dt)
   - Regen, aim states, movement/steering, basic attack attempts.
   - Auto-acquire nearest target when idle; respect holdUntil post-Stop.
   - Attack-move switching to nearest threat.
   - Idle pulse/brace squash visuals. Y locked to ≈1.1.
2) updateEnemies(dt)
   - Aggro/wander/attack logic; slow debuffs; HP bar updates; XP grant on death.
3) updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake)
   - Smooth follow with small look-ahead; optional shake.
4) updateGridFollow(ground, player)
   - Recenter ground and offset UVs for endless-world feel.
5) ui.updateHUD(player)
   - Bars and text values for HP/MP/XP/Level.
6) skills.update(t, dt, cameraShake)
   - Static Field ticks, Thunderstorm strikes, cooldown UI updates.
7) ui.updateMinimap(player, enemies, portals)
   - Draw player, enemies, village ring, portals on 200x200 canvas.
8) effects.update(t, dt)
   - Fade/scale transient visuals; dispose expired meshes/buffers.
9) updateIndicators(dt)
   - Selection/aim/debuff rings, hand micro-sparks when any skill is ready.
10) portals.update(dt)
    - Spin portal rings for feedback.
11) updateVillageRest(dt)
    - Bonus regen inside village ring.
12) updateDeathRespawn()
    - Handle respawn timing, reset state, brief invulnerability.
13) Billboard enemy HP bars toward camera (lookAt).
14) renderer.render(scene, camera)

Data Flow
- lastMoveDir is updated in updatePlayer and used for camera look-ahead.
- cameraShake is mutated by R strikes in SkillsSystem and read by updateCamera.
- Selection and aim rings live under effects.indicators.

Performance Notes
- Avoid allocations in hot loops; transient buffers are cleaned by EffectsManager.
- dt clamp prevents physics/animation spikes after tab suspensions or large stalls.

Behavior Parity
- The ordering above mirrors the original monolithic implementation to ensure the same timing and visuals.
