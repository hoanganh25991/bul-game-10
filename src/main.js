// Zeus RPG — Modular Orchestrator
// This refactor splits the original monolithic file into modules per system.
// Behavior is preserved; tuning values unchanged.

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { DEBUG } from "./config.js";
import { COLOR, WORLD, SKILLS, VILLAGE_POS, REST_RADIUS } from "./constants.js";
import { initWorld, updateCamera, updateGridFollow, addResizeHandler } from "./world.js";
import { UIManager } from "./ui.js";
import { Player, Enemy, getNearestEnemy, handWorldPos } from "./entities.js";
import { EffectsManager, createGroundRing } from "./effects.js";
import { SkillsSystem } from "./skills.js";
import { createRaycast } from "./raycast.js";
import { createHouse, createHeroOverheadBars } from "./meshes.js";
import { distance2D, dir2D, now, clamp01 } from "./utils.js";
import { initPortals } from "./portals.js";
import { initI18n, setLanguage, getLanguage } from "./i18n.js";
import { initTouchControls } from "./touch.js";

// ------------------------------------------------------------
// Bootstrapping world, UI, effects
// ------------------------------------------------------------
const { renderer, scene, camera, ground, cameraOffset, cameraShake } = initWorld();
const ui = new UIManager();
const effects = new EffectsManager(scene);

// Initialize i18n (default Vietnamese)
initI18n();

// Settings and overlay elements
const btnSettings = document.getElementById("btnSettings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const settingsPanel = document.getElementById("settingsPanel");
const btnHeroScreen = document.getElementById("btnHeroScreen");
const btnCloseHero = document.getElementById("btnCloseHero");
const heroScreen = document.getElementById("heroScreen");
const introScreen = document.getElementById("introScreen");
const btnStart = document.getElementById("btnStart");
const btnCamera = document.getElementById("btnCamera");
const langVi = document.getElementById("langVi");
const langEn = document.getElementById("langEn");
let firstPerson = false;

// Settings handlers
btnSettings?.addEventListener("click", () => settingsPanel?.classList.toggle("hidden"));
btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));
btnHeroScreen?.addEventListener("click", () => heroScreen?.classList.remove("hidden"));
btnCloseHero?.addEventListener("click", () => heroScreen?.classList.add("hidden"));
btnStart?.addEventListener("click", () => { introScreen?.classList.add("hidden"); });
btnCamera?.addEventListener("click", () => { firstPerson = !firstPerson; });

langVi?.addEventListener("click", () => setLanguage("vi"));
langEn?.addEventListener("click", () => setLanguage("en"));

// Selection/aim indicators
const aimPreview = createGroundRing(SKILLS.W.radius - 0.15, SKILLS.W.radius + 0.15, 0x9fd8ff, 0.35);
aimPreview.visible = false;
effects.indicators.add(aimPreview);

const attackPreview = createGroundRing(0.55, 0.75, 0xffb3b3, 0.6);
attackPreview.visible = false;
effects.indicators.add(attackPreview);

const selectionRing = createGroundRing(0.9, 1.05, 0x7cc4ff, 0.55);
selectionRing.visible = true;
effects.indicators.add(selectionRing);

// Center message helpers wired to UI
const setCenterMsg = (t) => ui.setCenterMsg(t);
const clearCenterMsg = () => ui.clearCenterMsg();

// ------------------------------------------------------------
// Entities and Game State
// ------------------------------------------------------------
const player = new Player();
scene.add(player.mesh);

// Hero overhead HP/MP bars
const heroBars = createHeroOverheadBars();
player.mesh.add(heroBars.container);

// Respawn/death messaging
player.onDeath = () => {
  player.deadUntil = now() + 3;
  setCenterMsg("You died. Respawning...");
  player.aimMode = false;
  player.aimModeSkill = null;
  player.moveTarget = null;
  player.target = null;
};

// Enemies
const enemies = [];
for (let i = 0; i < WORLD.enemyCount; i++) {
  const angle = Math.random() * Math.PI * 2;
  const r = WORLD.enemySpawnRadius * (0.4 + Math.random() * 0.8);
  const pos = new THREE.Vector3(
    VILLAGE_POS.x + Math.cos(angle) * r,
    0,
    VILLAGE_POS.z + Math.sin(angle) * r
  );
  const e = new Enemy(pos);
  e.mesh.userData.enemyRef = e;
  scene.add(e.mesh);
  enemies.push(e);
}

let selectedUnit = player;

// Village visuals
const houses = [
  (() => { const h = createHouse(); h.position.set(8, 0, -8); scene.add(h); return h; })(),
  (() => { const h = createHouse(); h.position.set(-10, 0, 10); scene.add(h); return h; })(),
  (() => { const h = createHouse(); h.position.set(-16, 0, -12); scene.add(h); return h; })(),
];

const villageRing = new THREE.Mesh(
  new THREE.RingGeometry(REST_RADIUS - 0.4, REST_RADIUS, 32),
  new THREE.MeshBasicMaterial({ color: COLOR.village, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
);
villageRing.rotation.x = -Math.PI / 2;
villageRing.position.copy(VILLAGE_POS);
scene.add(villageRing);

// Portals/Recall
const portals = initPortals(scene);

// ------------------------------------------------------------
// Skills system (cooldowns, abilities, storms) and UI
// ------------------------------------------------------------
const skills = new SkillsSystem(player, enemies, effects, ui.getCooldownElements());

// Touch controls (joystick + skill wheel)
const touch = initTouchControls({ player, skills, effects, aimPreview, attackPreview });

// ------------------------------------------------------------
// Raycasting
// ------------------------------------------------------------
const raycast = createRaycast({
  renderer,
  camera,
  ground,
  enemiesMeshesProvider: () => enemies.filter((en) => en.alive).map((en) => en.mesh),
  playerMesh: player.mesh,
});

// ------------------------------------------------------------
// UI: cooldowns are updated by skills; HUD and minimap updated in loop
// ------------------------------------------------------------

// ------------------------------------------------------------
// Input Handling
// ------------------------------------------------------------
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

let lastMouseGroundPoint = new THREE.Vector3();
renderer.domElement.addEventListener("mousemove", (e) => {
  raycast.updateMouseNDC(e);
  const p = raycast.raycastGround();
  if (p) {
    lastMouseGroundPoint.copy(p);
    if (player.aimMode && player.aimModeSkill === "W") {
      aimPreview.visible = true;
      aimPreview.position.set(p.x, 0.02, p.z);
    }
  } else if (player.aimMode && player.aimModeSkill === "W") {
    aimPreview.visible = false;
  }

  // Attack aim pointer behavior
  if (player.aimMode && player.aimModeSkill === "ATTACK") {
    raycast.raycaster.setFromCamera(raycast.mouseNDC, camera);
    const em = raycast.raycaster.intersectObjects(raycast.enemiesMeshesProvider(), true)[0];
    if (em) {
      const enemy = (function findEnemyFromObject(obj) {
        let o = obj;
        while (o) {
          if (o.userData && o.userData.enemyRef) return o.userData.enemyRef;
          o = o.parent;
        }
        return null;
      })(em.object);
    if (enemy) {
        const ep = enemy.pos();
        attackPreview.visible = true;
        attackPreview.position.set(ep.x, 0.02, ep.z);
      }
    } else if (p) {
      attackPreview.visible = true;
      attackPreview.position.set(p.x, 0.02, p.z);
    } else {
      attackPreview.visible = false;
    }
  } else {
    attackPreview.visible = false;
  }
});

renderer.domElement.addEventListener("mousedown", (e) => {
  raycast.updateMouseNDC(e);
  if (e.button === 2) { // Right click: move / attack
    if (player.frozen) {
      portals.handleFrozenPortalClick(raycast, camera, player, clearCenterMsg);
      return;
    }
    const obj = raycast.raycastEnemyOrGround();
    if (obj && obj.type === "enemy") {
      player.target = obj.enemy;
      player.moveTarget = null;
      effects.spawnTargetPing(obj.enemy);
    } else {
      const p = raycast.raycastGround();
      if (p) {
        player.moveTarget = p.clone();
        player.target = null;
        effects.spawnMovePing(p);
      }
    }
  } else if (e.button === 0) { // Left click: select or aim-confirm
    const obj = raycast.raycastPlayerOrEnemyOrGround();

    if (player.frozen) {
      portals.handleFrozenPortalClick(raycast, camera, player, clearCenterMsg);
      return;
    }

    if (player.aimMode) {
      // Aim confirm for targeted skills
      if (player.aimModeSkill === "W") {
        const p = raycast.raycastGround();
        if (p) {
          skills.castW_AOE(p);
          effects.spawnMovePing(p, 0x9fd8ff);
        }
      } else if (player.aimModeSkill === "ATTACK") {
        if (obj && obj.type === "enemy") {
          player.target = obj.enemy;
          player.moveTarget = null;
          player.attackMove = false;
          skills.tryBasicAttack(player, obj.enemy);
          effects.spawnTargetPing(obj.enemy);
        } else {
          const p = raycast.raycastGround();
          if (p) {
            player.moveTarget = p.clone();
            player.attackMove = true;
            player.target = null;
            effects.spawnMovePing(p);
          }
        }
      }
      aimPreview.visible = false;
      attackPreview.visible = false;
      renderer.domElement.style.cursor = "default";
      player.aimMode = false;
      player.aimModeSkill = null;
    } else {
      // Standard select logic
      if (obj && obj.type === "player") {
        selectedUnit = player;
      } else if (obj && obj.type === "enemy") {
        selectedUnit = obj.enemy;
      } else if (obj && obj.type === "ground" && DEBUG && obj.point) {
        selectedUnit = player;
        if (!player.frozen) {
          player.moveTarget = obj.point.clone();
          player.target = null;
          effects.spawnMovePing(obj.point);
        }
      } else {
        selectedUnit = player;
      }
    }
  }
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "a") {
    // Attack aim: click enemy to set target, or ground to attack-move
    player.aimMode = true;
    player.aimModeSkill = "ATTACK";
    renderer.domElement.style.cursor = "crosshair";
  } else if (k === "q") {
    skills.castQ_ChainLightning();
  } else if (k === "w") {
    player.aimMode = true;
    player.aimModeSkill = "W";
    aimPreview.visible = true;
    if (lastMouseGroundPoint) {
      aimPreview.position.set(lastMouseGroundPoint.x, 0.02, lastMouseGroundPoint.z);
    }
    renderer.domElement.style.cursor = "crosshair";
  } else if (k === "e") {
    skills.castE_StaticField();
  } else if (k === "r") {
    skills.castR_Thunderstorm();
  } else if (k === "b") {
    portals.recallToVillage(player, setCenterMsg);
  } else if (k === "s") {
    stopPlayer();
  } else if (k === "escape") {
    // Cancel aim mode
    player.aimMode = false;
    player.aimModeSkill = null;
    aimPreview.visible = false;
    renderer.domElement.style.cursor = "default";
  }
});

// ------------------------------------------------------------
// Systems Update Loop
// ------------------------------------------------------------
let lastMoveDir = new THREE.Vector3(0, 0, 0);
let lastT = now();

function animate() {
  requestAnimationFrame(animate);
  const t = now();
  const dt = Math.min(0.05, t - lastT);
  lastT = t;

  // Mobile joystick drive movement
  if (typeof touch !== "undefined" && touch?.getMoveDir) {
    const joy = touch.getMoveDir();
    if (joy.active && !player.frozen && !player.aimMode) {
      const ahead = 26;
      const px = player.pos().x + joy.x * ahead;
      const pz = player.pos().z + joy.y * ahead;
      player.moveTarget = new THREE.Vector3(px, 0, pz);
      player.attackMove = false;
      player.target = null;
    }
  }

  updatePlayer(dt);
  updateEnemies(dt);
  if (firstPerson) {
    const head = player.pos().clone(); head.y = 1.6;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion).normalize();
    const target = head.clone().add(forward.multiplyScalar(5));
    camera.position.lerp(head, 1 - Math.pow(0.001, dt));
    camera.lookAt(target);
  } else {
    updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake);
  }
  updateGridFollow(ground, player);
  ui.updateHUD(player);
  skills.update(t, dt, cameraShake);
  ui.updateMinimap(player, enemies, portals);
  effects.update(t, dt);
  updateIndicators(dt);
  portals.update(dt);
  updateVillageRest(dt);
  updateDeathRespawn();

  // Billboard enemy hp bars to face camera
  enemies.forEach((en) => {
    if (!en.alive) return;
    if (en.hpBar && en.hpBar.container) en.hpBar.container.lookAt(camera.position);
  });

  // Update hero overhead bars and billboard to camera
  if (heroBars) {
    const hpRatio = clamp01(player.hp / player.maxHP);
    const mpRatio = clamp01(player.mp / player.maxMP);
    heroBars.hpFill.scale.x = Math.max(0.001, hpRatio);
    heroBars.mpFill.scale.x = Math.max(0.001, mpRatio);
    heroBars.container.lookAt(camera.position);
  }

  renderer.render(scene, camera);
}
animate();

// ------------------------------------------------------------
// Helpers and per-system updates
// ------------------------------------------------------------
function teleportToPortal(dest) {
  if (!dest) return;
  const to = dest.group.position.clone();
  to.y = 0;
  player.mesh.position.copy(to).add(new THREE.Vector3(1.5, 0, 0));
  player.moveTarget = null;
  player.target = null;
}

function stopPlayer() {
  // cancel movement/attack orders
  player.moveTarget = null;
  player.attackMove = false;
  player.target = null;
  // cancel aim modes
  if (player.aimMode) {
    player.aimMode = false;
    player.aimModeSkill = null;
    aimPreview.visible = false;
    attackPreview.visible = false;
    renderer.domElement.style.cursor = "default";
  }
  // brief hold to prevent instant re-acquire
  player.holdUntil = now() + 0.4;
}

function updatePlayer(dt) {
  // Regen
  player.hp = Math.min(player.maxHP, player.hp + player.hpRegen * dt);
  player.mp = Math.min(player.maxMP, player.mp + player.mpRegen * dt);
  player.idlePhase += dt;

  // Dead state
  if (!player.alive) {
    player.mesh.position.y = 1.1;
    return;
  }

  // Freeze: no movement
  if (player.frozen) {
    player.mesh.position.y = 1.1;
    return;
  }

  // Auto-acquire nearest enemy if idle and in range (skip briefly after Stop)
  if (!player.moveTarget && (!player.target || !player.target.alive) && (!player.holdUntil || now() >= player.holdUntil)) {
    const nearest = getNearestEnemy(player.pos(), WORLD.attackRange + 0.5, enemies);
    if (nearest) player.target = nearest;
  }

  // Attack-move: while moving, if an enemy comes close, switch to attack
  if (player.attackMove) {
    const nearest = getNearestEnemy(player.pos(), 14, enemies);
    if (nearest) {
      player.target = nearest;
      player.attackMove = false;
    }
  }

  // Movement towards target or moveTarget
  let moveDir = null;
  if (player.target && player.target.alive) {
    const d = distance2D(player.pos(), player.target.pos());
    if (d > WORLD.attackRange * 0.95) {
      moveDir = dir2D(player.pos(), player.target.pos());
    } else {
      // in range: attempt basic attack
      skills.tryBasicAttack(player, player.target);
    }
  } else if (player.moveTarget) {
    const d = distance2D(player.pos(), player.moveTarget);
    if (d > 0.6) {
      moveDir = dir2D(player.pos(), player.moveTarget);
    } else {
      player.moveTarget = null;
    }
  }

  if (moveDir) {
    player.mesh.position.x += moveDir.x * player.speed * dt;
    player.mesh.position.z += moveDir.z * player.speed * dt;

    // Rotate towards movement direction smoothly
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    const euler = new THREE.Euler(0, targetYaw, 0);
    const q = new THREE.Quaternion().setFromEuler(euler);
    player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * dt));

    // record move direction for camera look-ahead
    lastMoveDir.set(moveDir.x, 0, moveDir.z);
  } else {
    // stationary: face current target if any
    if (player.target && player.target.alive) {
      const v = dir2D(player.pos(), player.target.pos());
      const targetYaw = Math.atan2(v.x, v.z);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetYaw, 0));
      player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 1.5 * dt));
      player.lastFacingYaw = targetYaw;
      player.lastFacingUntil = now() + 0.6;
    } else if (player.lastFacingUntil && now() < player.lastFacingUntil) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.lastFacingYaw || 0, 0));
      player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 0.8 * dt));
    }
    // decay look-ahead
    lastMoveDir.multiplyScalar(Math.max(0, 1 - dt * 3));
  }

  // Keep y at ground
  player.mesh.position.y = 1.1;

  // Idle glow pulse and brief brace squash
  const ud = player.mesh.userData || {};
  if (ud.handLight) ud.handLight.intensity = 1.2 + Math.sin((player.idlePhase || 0) * 2.2) * 0.22;
  if (ud.thunderOrb && ud.thunderOrb.material) {
    ud.thunderOrb.material.emissiveIntensity = 2.2 + Math.sin((player.idlePhase || 0) * 2.2) * 0.35;
  }
  if (player.braceUntil && now() < player.braceUntil) {
    const n = Math.max(0, (player.braceUntil - now()) / 0.18);
    player.mesh.scale.set(1, 0.94 + 0.06 * n, 1);
  } else {
    player.mesh.scale.set(1, 1, 1);
  }
}

function updateEnemies(dt) {
  enemies.forEach((en) => {
    if (!en.alive) return;
    const toPlayer = player.alive ? distance2D(en.pos(), player.pos()) : Infinity;
    if (toPlayer < WORLD.aiAggroRadius) {
      // chase player
      const d = toPlayer;
      if (d > WORLD.aiAttackRange) {
        const v = dir2D(en.pos(), player.pos());
        const spMul = en.slowUntil && now() < en.slowUntil ? en.slowFactor || 0.5 : 1;
        en.mesh.position.x += v.x * en.speed * spMul * dt;
        en.mesh.position.z += v.z * en.speed * spMul * dt;
        // face
        const yaw = Math.atan2(v.x, v.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
        en.mesh.quaternion.slerp(q, 0.2);
      } else {
        // Attack
        const t = now();
        if (t >= (en.nextAttackReady || 0)) {
          en.nextAttackReady = t + WORLD.aiAttackCooldown;
          // Visual
          const from = en.pos().clone().add(new THREE.Vector3(0, 1.4, 0));
          const to = player.pos().clone().add(new THREE.Vector3(0, 1.2, 0));
          effects.spawnBeam(from, to, 0xff8080, 0.09);
          // Damage
          player.takeDamage(WORLD.aiAttackDamage);
        }
      }
    } else {
      // Wander around their spawn origin
      if (!en.moveTarget || Math.random() < 0.005) {
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * WORLD.aiWanderRadius;
        en.moveTarget = en.pos().clone().add(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r));
      }
      const d = distance2D(en.pos(), en.moveTarget);
      if (d > 0.8) {
        const v = dir2D(en.pos(), en.moveTarget);
        const spMul = en.slowUntil && now() < en.slowUntil ? en.slowFactor || 0.5 : 1;
        en.mesh.position.x += v.x * en.speed * spMul * 0.6 * dt;
        en.mesh.position.z += v.z * en.speed * spMul * 0.6 * dt;
      }
    }

    // keep y
    en.mesh.position.y = 1.0;

    // Update HP bar
    en.updateHPBar();

    // Death cleanup and XP grant
    if (!en.alive && !en._xpGranted) {
      en._xpGranted = true;
      player.gainXP(30);
    }
  });
}

function updateIndicators(dt) {
  // Selection ring: follow currently selected unit
  if (selectedUnit && selectedUnit.alive) {
    selectionRing.visible = true;
    const p = selectedUnit.pos();
    selectionRing.position.set(p.x, 0.02, p.z);
    const col = selectedUnit.team === "enemy" ? 0xff6060 : 0x7cc4ff;
    selectionRing.material.color.setHex(col);
  } else {
    selectionRing.visible = false;
  }

  // Subtle rotation for aim ring for feedback
  if (aimPreview.visible) {
    aimPreview.rotation.z += dt * 0.6;
  }
  if (attackPreview.visible) {
    attackPreview.rotation.z += dt * 0.6;
  }

  // Slow debuff indicator rings
  const t = now();
  enemies.forEach((en) => {
    const slowed = en.slowUntil && t < en.slowUntil;
    if (slowed) {
      if (!en._slowRing) {
        const r = createGroundRing(0.6, 0.9, 0x66aaff, 0.7);
        effects.indicators.add(r);
        en._slowRing = r;
      }
      const p = en.pos();
      en._slowRing.position.set(p.x, 0.02, p.z);
      en._slowRing.visible = true;
    } else if (en._slowRing) {
      effects.indicators.remove(en._slowRing);
      en._slowRing.geometry.dispose?.();
      en._slowRing = null;
    }
  });

  // Hand charged micro-sparks when any skill is ready
  const anyReady = !(skills.isOnCooldown("Q") && skills.isOnCooldown("W") && skills.isOnCooldown("E") && skills.isOnCooldown("R"));
  if (anyReady && (window.__nextHandSparkT ?? 0) <= t) {
    const from = handWorldPos(player);
    const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6));
    effects.spawnElectricBeam(from, to, 0x9fd8ff, 0.06, 5, 0.2);
    window.__nextHandSparkT = t + 0.5 + Math.random() * 0.5;
  }
}

function updateVillageRest(dt) {
  const d = distance2D(player.pos(), VILLAGE_POS);
  if (d <= REST_RADIUS) {
    // bonus regen while at village
    player.hp = Math.min(player.maxHP, player.hp + 8 * dt);
    player.mp = Math.min(player.maxMP, player.mp + 10 * dt);
  }
}

function updateDeathRespawn() {
  const t = now();
  if (!player.alive && player.deadUntil && t >= player.deadUntil) {
    // Respawn at village
    player.alive = true;
    player.mesh.visible = true;
    player.mesh.position.copy(VILLAGE_POS).add(new THREE.Vector3(1.5, 0, 0));
    player.hp = player.maxHP;
    player.mp = player.maxMP;
    player.moveTarget = null;
    player.target = null;
    player.invulnUntil = now() + 2;
    clearCenterMsg();
  }
}

// ------------------------------------------------------------
// Window resize
// ------------------------------------------------------------
addResizeHandler(renderer, camera);

// ------------------------------------------------------------
// Align player start facing village center
// ------------------------------------------------------------
(function initFace() {
  const v = dir2D(player.pos(), VILLAGE_POS);
  const yaw = Math.atan2(v.x, v.z);
  player.mesh.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
})();
