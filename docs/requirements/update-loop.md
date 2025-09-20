# Update Loop Orchestration — Functional Requirements

Scope
- Defines the per-frame sequencing of systems to ensure deterministic, smooth updates and rendering.

Main Loop
- Runs via requestAnimationFrame; compute dt and clamp to avoid large steps (e.g., max 0.05s).
- Per-frame order:
  1) Player update (regen, movement/attacks, aim state)
  2) Enemies update (AI: aggro/wander/attack, HP bars, death/XP grant)
  3) Camera update (follow, look-ahead, shake)
  4) World ground update (recenter, UV offset)
  5) HUD update (bars/text)
  6) Skills update (Static Field ticks, Thunderstorm strikes, cooldown UI)
  7) Minimap update (player/enemies/portals/village ring)
  8) Effects update (transient cleanup, fades, scales)
  9) Indicators update (selection/aim/debuff rings; hand micro-sparks)
  10) Portals update (ring spin, interactions handled via input)
  11) Village regen update (bonus regen in REST_RADIUS)
  12) Death/respawn check and handling
  13) Face enemy HP bars toward the camera (billboarding)
  14) Render scene

Clamping & Stability
- dt is clamped to prevent physics and animation spikes.
- Avoid expensive allocations inside the loop; dispose transient buffers on expiry.

Acceptance Criteria
- Systems behave consistently frame-to-frame with correct ordering (e.g., camera follows post-movement).
- No visible hitches due to unbounded dt; gameplay remains responsive.
- Transient effects are cleaned up automatically; no accumulation observed over time.
