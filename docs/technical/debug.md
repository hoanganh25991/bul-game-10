# Debug Parameters

Overview
- The prototype supports simple URL parameters to help development and testing without changing code or tuning values.

Flags
- ?debug=1
  - Enables developer convenience for faster iteration.
  - Behavior:
    - Left-click on ground issues a move command when not in an aim mode and not frozen (recall).
  - Scope: Input convenience only; no balance changes.

Model Injection
- ?model=URL
  - Attempts to load an external GLTF/GLB model for the hero (GoT) using GLTFLoader.
  - On success:
    - Placeholder geometry is hidden.
    - The model is auto-scaled so that its height is approximately 2.2 world units.
  - Notes:
    - The URL must be publicly accessible or served by your local server (respect CORS).
    - Meshes in the model are set to cast/receive shadows where applicable.

Usage Examples
- http://localhost:8000/?debug=1
- http://localhost:8000/?model=/assets/got.glb
- http://localhost:8000/?debug=1&model=https://example.com/hero.glb

Behavior Parity
- Debug flags are optional and do not change game tuning or mechanics.
- They only add developer conveniences and optional visuals for iteration.
