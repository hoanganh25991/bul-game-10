# Portals, Recall, Respawn (portals.js + main.js)

Responsibilities
- Manage village and return portals, recall freezing, teleportation, ring animation, and respawn flow messaging.

Portals System (portals.js)
- initPortals(scene): initializes and returns an object with:
  - getVillagePortal(): current village portal handle { group, ring, linkTo?, radius }
  - getReturnPortal(): current return portal handle or null
  - ensureVillagePortal(): idempotent creator for the fixed village portal near VILLAGE_POS
  - recallToVillage(player, setCenterMsg):
    - Spawns or refreshes a return portal at player position
    - Links return <-> village portals
    - Sets player.frozen = true and shows center message prompt
  - handleFrozenPortalClick(raycast, camera, player, clearCenterMsg): boolean
    - While frozen, clicking the portal (or near it) teleports to village
    - Clears frozen state and center message on success
  - teleportToPortal(dest, player): utility to move player to a portal and clear orders
  - update(dt): spins portal rings each frame (visual feedback)

Data & Geometry
- createPortalMesh(color) (from meshes.js) returns:
  - group: THREE.Group (ring + base, positioned slightly above ground)
  - ring: THREE.Mesh (Torus) that rotates over time for feedback
- Village portal: distinct color (COLOR.village), positioned near VILLAGE_POS
- Return portal: distinct color (COLOR.portal), created on recall, positioned at player location

Frozen Interaction (Recall Flow)
- On B key:
  - recallToVillage() is invoked and sets player.frozen = true with a prompt message
- While frozen:
  - Mouse clicks are restricted to portal interaction via handleFrozenPortalClick
  - Successful click teleports to village and unfreezes the player

Respawn Flow (main.js)
- On player death:
  - onDeath callback sets a respawn timer and shows “You died. Respawning…”
- On timer expiry:
  - Player is resurrected at VILLAGE_POS with HP/MP restored
  - Brief invulnerability window is applied (invulnUntil)
  - Orders and targets are cleared; center message removed

Integration
- initPortals(scene) called once in main.js; the returned object is passed to UI for minimap markers.
- Portals.update(dt) is called each frame by main.js (ring animation).
- UIManager.updateMinimap() queries getVillagePortal() and getReturnPortal() to draw markers.

Behavior Parity
- Recall freezing, portal linking, teleportation proximity, and respawn behavior mirror the original monolithic code.
- No tuning changes introduced.
