# Input & Raycasting (raycast.js + main.js input)

Responsibilities
- Provide reusable raycasting helpers for ground, player, and enemy selection.
- Implement mouse/keyboard/touch input, including virtual joystick, skill radial, and updated aim/placement flows.

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
    - For touch AOE placement: the skill button acts as a mini-joystick to set direction/offset; confirm on release.
    - After confirm/cancel, exit aim mode and reset cursor.
  - Else selection:
    - Select player on player hit.
    - Select enemy on enemy hit (info only).
    - With ?debug=1 and ground hit: move player (dev convenience).
    - Default selection is player.

Keyboard
- A: Basic attack. Auto-targets nearest enemy in range; hold to repeat when off cooldown.
- Q/W/E/R: Cast skills (W enters placement preview).
- Space: Quick cast — attempts to cast all ready skills once (respects placement/requirements).
- Arrow Keys: Move the player (↑/↓/←/→), in addition to mouse/joystick.
- B: Recall (spawns/refreshes return portal; freezes player; prompt message).
- S: Stop (clear orders; short holdUntil to suppress re-acquire).
- Esc: Cancel aim mode (hide W preview and reset cursor).

Aim Previews
- W: ground ring follows raycastGround while in aim mode; on touch, the W button can be dragged slightly (mini-joystick) to position AOE before release.
- Basic attack aim mode removed; A triggers immediate basic attack without a preview.

Integration Notes
- enemiesMeshesProvider filters enemies by alive state and maps to root meshes.
- Cursor is set to crosshair during aim modes for visual feedback.
- Selection and aim preview rings live in effects.indicators; selection color depends on team.

Behavior Parity
- Mirrors original monolithic selection, aim, and input semantics without changing tuning or order of checks.
