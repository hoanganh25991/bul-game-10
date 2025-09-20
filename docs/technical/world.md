# World & Rendering (world.js)

Responsibilities
- Initialize renderer, scene, camera, lights, and ground plane.
- Maintain camera follow with look‑ahead and optional shake.
- Simulate endless world by recentring ground and offsetting UVs.
- Handle window resize events.

Key APIs
- initWorld(): initializes and returns:
  - renderer: THREE.WebGLRenderer({ antialias: true, alpha: true })
  - scene: transparent background (null)
  - camera: THREE.PerspectiveCamera(60, aspect, 0.1, 2000)
  - ground: PlaneGeometry(500, 500) with CanvasTexture noise
  - cameraOffset: Vector3(0, 45, 28)
  - cameraShake: { mag: number, until: number }
- updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake):
  - Smoothly lerps position toward player + offset (+ small look‑ahead based on last movement).
  - Applies lightweight shake when cameraShake.until > now.
  - Always looks at player with a small Y height.
- updateGridFollow(ground, player):
  - Reposition ground to player XZ and scroll texture map offset for parallax.
- addResizeHandler(renderer, camera):
  - Subscribes to window.resize and keeps renderer size and camera aspect up to date.

Implementation Notes
- Pixel ratio clamped to 2 to balance sharpness and performance.
- Lights: HemisphereLight + DirectionalLight provide a stylized look.
- Ground texture uses a small anisotropy to keep sampling inexpensive.

Integration
- initWorld() is called once from main.js; its return values are shared with other modules.
- updateCamera and updateGridFollow are called every frame in the main loop (after player/enemy updates, before render).
- addResizeHandler is called once at startup; clean‑up function is returned if needed.

Behavior Parity
- Matches original setup: transparent background, same FOV and camera offset, same light intensities and ground characteristics.
