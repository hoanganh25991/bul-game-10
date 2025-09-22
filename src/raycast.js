import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

/**
 * Create reusable raycasting helpers bound to the given renderer/camera/scene objects.
 * Call updateMouseNDC(event) on mouse events before using the ray functions.
 *
 * enemiesMeshesProvider: () => THREE.Object3D[]   // should return alive enemies' root meshes
 * playerMesh: THREE.Object3D                      // root mesh for player
 */
export function createRaycast({ renderer, camera, ground, enemiesMeshesProvider, playerMesh }) {
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function updateMouseNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // Walk up parents to locate Enemy instance reference stored as userData.enemyRef
  function findEnemyFromObject(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.enemyRef) return o.userData.enemyRef;
      o = o.parent;
    }
    return null;
  }

  function raycastGround() {
    raycaster.setFromCamera(mouseNDC, camera);
    const pt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(GROUND_PLANE, pt)) return pt;
    return null;
  }

  function raycastEnemyOrGround() {
    raycaster.setFromCamera(mouseNDC, camera);
    const em = raycaster.intersectObjects(enemiesMeshesProvider(), true)[0];
    if (em) {
      const enemy = findEnemyFromObject(em.object);
      if (enemy) return { type: "enemy", enemy };
    }
    const p = raycastGround();
    if (p) return { type: "ground", point: p };
    return null;
  }

  function raycastPlayerOrEnemyOrGround() {
    raycaster.setFromCamera(mouseNDC, camera);
    // Prioritize enemies first so clicks overlapping player/enemy target enemy for basic attack
    const em = raycaster.intersectObjects(enemiesMeshesProvider(), true)[0];
    if (em) {
      const enemy = findEnemyFromObject(em.object);
      if (enemy) return { type: "enemy", enemy };
    }
    if (playerMesh) {
      const pm = raycaster.intersectObject(playerMesh, true)[0];
      if (pm) return { type: "player" };
    }
    const p = raycastGround();
    if (p) return { type: "ground", point: p };
    return null;
  }

  return {
    // state
    raycaster,
    mouseNDC,
    GROUND_PLANE,
    enemiesMeshesProvider,
    playerMesh,
    // helpers
    updateMouseNDC,
    findEnemyFromObject,
    raycastGround,
    raycastEnemyOrGround,
    raycastPlayerOrEnemyOrGround,
  };
}
