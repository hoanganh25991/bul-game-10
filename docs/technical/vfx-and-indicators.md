# VFX & Indicators (effects.js + meshes.js portions)

Responsibilities
- Create and manage short‑lived electric visual effects and ground indicators.
- Provide reusable ring meshes for selection, aim previews, debuff indicators, and pings.
- Handle timed cleanup (fade, scale) and resource disposal to avoid leaks.

Key Constructs
- EffectsManager (stateful)
  - constructor(scene: THREE.Scene)
    - Creates two groups added to the scene:
      - transient: short‑lived line meshes (beams, flashes, spheres)
      - indicators: rings and persistent indicator meshes (selection, aim, debuff)
    - Maintains an internal queue of timed entries: { obj, until, fade?, mat?, scaleRate? }
  - spawnMovePing(point, color?)
  - spawnTargetPing(entity, color?)
  - showNoTargetHint(player, radius)
  - spawnBeam(from, to, color?, life?)
  - spawnElectricBeam(from, to, color?, life?, segments?, amplitude?)
    - Jagged path with optional short fork on longer spans.
  - spawnElectricBeamAuto(from, to, color?, life?)
    - Multi‑pass beams; segment count/opacity scale with distance to simulate thickness.
  - spawnArcNoisePath(from, to, color?, life?, passes?)
  - spawnHitDecal(center)
  - spawnStrike(point, radius?, color?)
    - Vertical strike + short radial sparks.
  - spawnHandFlash(player)
    - Brief emissive sphere at GoT’ right hand.
  - update(t, dt)
    - Fades materials (if fade=true), applies scaleRate expansion, removes expired entries from scene, and disposes geometry.
- createGroundRing(innerR, outerR, color, opacity?)
  - Reusable ring mesh factory for selection, aim previews, debuffs, and pings.

Micro‑Sparks (Hand Ready State)
- When any skill is off cooldown (ready), small arcing micro‑sparks are spawned intermittently around GoT’ hand.

Integration
- EffectsManager is created once and shared across systems via main.js.
- Selection and aim preview rings are created in main.js and added to effects.indicators.
- SkillsSystem calls into EffectsManager for visual feedback on each cast and tick.
- Indicators (slow rings) are managed during updateIndicators(dt) in main.js using createGroundRing().

Performance & Cleanup
- All transient meshes are queued with expiry timestamps and faded/removed automatically in EffectsManager.update().
- Geometry/materials are disposed on removal to prevent memory growth.
- Avoid per‑frame allocations in hot paths; reuse vectors where possible.

Behavior Parity
- Beams, strikes, rings, fade/scale timings, and micro‑spark cadence mirror the original monolithic implementation.
