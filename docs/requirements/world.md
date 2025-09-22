# World & Rendering — Functional Requirements

Scope
- Top-down RTS-like experience rendered via Three.js in a single WebGL canvas.
- All logic in-browser; ES module script.

Rendering and Scene
- Use Three.js to create:
  - WebGLRenderer({ antialias: true, alpha: true }) sized to window, pixel ratio clamped to 2.
  - Scene with transparent background (null).
  - PerspectiveCamera (FOV 60) with far plane ≥ 2000.
- Lighting:
  - HemisphereLight and DirectionalLight with modest intensities for stylized look.

World Ground
- Render a ground plane using a subtle (noise) texture.
- Simulate endless world by:
  - Recentering ground under the player.
  - Offsetting texture UVs over time for parallax feel.

Responsiveness
- Canvas resizes with window, maintaining camera aspect.

Non-Functional (World-specific)
- Performance: keep frame times smooth; minimize allocations per frame.
- Textures: small anisotropy to keep sampling inexpensive.

Villages & Roads
- Villages appear as the player travels far from origin. Each new village increases in size/complexity and includes a named gate and a persistent green portal.
- A protective fence ring surrounds the village to prevent enemies entering; fence pillars connect with multiple lines.
- Roads are curved and connect between villages; on entering a new village, a road from the previous village is established.

World Maps & Gating
- The world is organized into maps (MAP 1, MAP 2, ...).
- Unlocking: new maps open when the hero reaches defined strength thresholds (e.g., level milestones).
- Travel: the player may move between unlocked maps; higher maps feature stronger enemies and distinct color/model variants.
- UI: current map is visible on the Hero screen; after certain levels, auto‑advance to the next map is allowed.

Acceptance Criteria
- On load, renderer/scene/camera are present with the top-down angle.
- Ground plane is visible with a subtle noise texture.
- As player moves, the ground recenters and UV offsets change to simulate an endless world.
- Resizing the browser window updates canvas size and camera aspect without distortion.
- A visible fence ring around villages blocks enemy entry; portals are present at villages.
- Curved roads are present and connect visited villages (a road is established when entering a new village).
