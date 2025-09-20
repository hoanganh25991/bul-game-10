# Input & Raycasting (raycast.js + main.js input)

Responsibilities
- Provide reusable raycasting helpers for ground, player, and enemy selection.
- Implement mouse/keyboard input to drive RTS-like controls and aim modes.

Raycast Helper (raycast.js)
- createRaycast({ renderer, camera, ground, enemiesMeshesProvider, playerMesh })
  - Returns:
    - raycaster: THREE.Raycaster
    - mouseNDC: THREE.Vector2 (normalized device coords)
    - GROUND_PLANE: horizontal plane (y=0)
    - enemiesMeshesProvider: () => Object3D[] (alive enemy meshes)
    - playerMesh: Object3D (root player mesh)
    - updateMouseNDC(e): compute NDC from mouse event
    - findEnemyFromObject(obj): walk parents to resolve enemyRef
    - raycastGround(): world point on GROUND_PLANE under mouse
    - raycastEnemyOrGround(): enemy first, else ground
    - raycastPlayerOrEnemyOrGround(): player, else enemy, else ground
- Enemy resolution
  - Enemies must set mesh.userData.enemyRef = enemyInstance at spawn.

Input Handling (main.js)
Mouse
- Right-click (context menu disabled on canvas):
  - If player.frozen (recall), only allow portal interaction via portals.handleFrozenPortalClick.
  - Else:
    - If enemy under cursor: set player.target; clear moveTarget; spawn target ping.
    - Else if ground: set moveTarget; clear target; spawn move ping.
- Left-click:
  - If player.frozen: portals.handleFrozenPortalClick and return.
  - If in aim mode:
    - W: confirm ground point and cast W (spawn move ping in light-blue).
    - ATTACK: confirm enemy (immediate basic attack) or ground (attack-move).
    - After confirm, exit aim mode and reset cursor.
  - Else selection:
    - Select player on player hit.
    - Select enemy on enemy hit (info only).
    - With ?debug=1 and ground hit: move player (dev convenience).
    - Default selection is player.

Keyboard
- A: enter “ATTACK” aim mode; crosshair cursor.
- Q/W/E/R: cast skills (W enters aim mode with visible preview).
- B: recall (spawns return portal, freezes player, prompt message).
- S: stop (clear orders, short holdUntil to suppress re-acquire).
- Esc: cancel aim mode (hide preview and reset cursor).

Aim Previews
- W: ground ring follows raycastGround while in aim mode.
- ATTACK: ring follows hovered enemy (or ground point).

Integration Notes
- enemiesMeshesProvider filters enemies by alive state and maps to root meshes.
- Cursor is set to crosshair during aim modes for visual feedback.
- Selection and aim preview rings live in effects.indicators; selection color depends on team.

Behavior Parity
- Mirrors original monolithic selection, aim, and input semantics without changing tuning or order of checks.
