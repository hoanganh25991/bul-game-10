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

Acceptance Criteria
- On load, renderer/scene/camera are present with the top-down angle.
- Ground plane is visible with a subtle noise texture.
- As player moves, the ground recenters and UV offsets change to simulate an endless world.
- Resizing the browser window updates canvas size and camera aspect without distortion.
