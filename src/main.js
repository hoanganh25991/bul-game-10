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
import { initEnvironment } from "./environment.js";
import { distance2D, dir2D, now, clamp01 } from "./utils.js";
import { initPortals } from "./portals.js";
import { initI18n, setLanguage, getLanguage, t } from "./i18n.js";
import { initSplash } from "./splash.js";
import { initTouchControls } from "./touch.js";
import { SKILL_POOL, DEFAULT_LOADOUT } from "./skills_pool.js";
import { loadOrDefault, saveLoadout, resolveLoadout } from "./loadout.js";

/**
 * Minimal skill icon helper: returns a small emoji/SVG placeholder for a skill short name.
 * Keeps UI lightweight and avoids new asset dependencies.
 */
function getSkillIcon(short) {
  if (!short) return "—";
  const k = String(short).slice(0, 3).toLowerCase();
  const map = {
    chn: "⚡", // chain
    bol: "⚡", // bolt/chain-ish
    stc: "🔌", // static
    str: "⛈️", // storm
    bam: "🔋",
    nov: "✴️",
    aoe: "💥",
    "n/a": "⚡"
  };
  return map[k] || "⚡";
}

// ------------------------------------------------------------
// Bootstrapping world, UI, effects
// ------------------------------------------------------------
const { renderer, scene, camera, ground, cameraOffset, cameraShake } = initWorld();
const ui = new UIManager();
const effects = new EffectsManager(scene);

// Load environment preferences from localStorage (persist rain + density)
const _envPrefs = JSON.parse(localStorage.getItem("envPrefs") || "{}");
let envRainState = !!_envPrefs.rain;
let envDensityIndex = Number.isFinite(parseInt(_envPrefs.density, 10)) ? parseInt(_envPrefs.density, 10) : 1;

// Presets used by the density slider (kept in sync with index 0..2)
const ENV_PRESETS = [
  { treeCount: 20, rockCount: 10, flowerCount: 60, villageCount: 1 },
  { treeCount: 60, rockCount: 30, flowerCount: 120, villageCount: 1 },
  { treeCount: 140, rockCount: 80, flowerCount: 300, villageCount: 2 },
];

envDensityIndex = Math.min(Math.max(0, envDensityIndex), ENV_PRESETS.length - 1);
let env = initEnvironment(scene, Object.assign({}, ENV_PRESETS[envDensityIndex], { enableRain: envRainState }));

/* Initialize splash first (shows full-screen loader), then i18n */
initSplash();
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
// preserve original camera defaults
const _defaultCameraNear = camera.near || 0.1;
const _defaultCameraFov = camera.fov || 60;

/**
 * Toggle first-person mode and adjust camera projection to reduce clipping.
 * When enabled we use a tighter near plane and slightly wider FOV for a comfortable FPS feel.
 */
function setFirstPerson(enabled) {
  firstPerson = !!enabled;
  if (firstPerson) {
    camera.near = 0.01;
    camera.fov = 75;
    camera.updateProjectionMatrix();
    // Hide torso/head/cloak parts so arms remain visible in first-person
    try {
      if (typeof player !== "undefined" && player?.mesh?.userData?.fpHide) {
        player.mesh.userData.fpHide.forEach((o) => { if (o) o.visible = false; });
      }
      if (typeof heroBars !== "undefined" && heroBars?.container) {
        heroBars.container.visible = false;
      }
    } catch (e) {}
  } else {
    camera.near = _defaultCameraNear;
    camera.fov = _defaultCameraFov;
    camera.updateProjectionMatrix();
    // Restore visibility
    try {
      if (typeof player !== "undefined" && player?.mesh?.userData?.fpHide) {
        player.mesh.userData.fpHide.forEach((o) => { if (o) o.visible = true; });
      }
      if (typeof heroBars !== "undefined" && heroBars?.container) {
        heroBars.container.visible = true;
      }
    } catch (e) {}
  }
}

 // Settings handlers
 btnSettings?.addEventListener("click", () => settingsPanel?.classList.toggle("hidden"));
 btnCloseSettings?.addEventListener("click", () => settingsPanel?.classList.add("hidden"));

 // Hero open/close
 btnHeroScreen?.addEventListener("click", () => { renderHeroScreen(); heroScreen?.classList.remove("hidden"); });
 btnCloseHero?.addEventListener("click", () => heroScreen?.classList.add("hidden"));

 // Generic top-right screen-close icons (ensure any element with .screen-close closes its parent .screen)
 document.querySelectorAll(".screen-close").forEach((b) => {
   b.addEventListener("click", (e) => {
     const sc = e.currentTarget.closest(".screen");
     if (sc) sc.classList.add("hidden");
   });
 });

 // intro may be absent (we removed it), keep safe guard
 btnStart?.addEventListener("click", () => { introScreen?.classList.add("hidden"); });
// use the setter so projection updates correctly
btnCamera?.addEventListener("click", () => { setFirstPerson(!firstPerson); });

langVi?.addEventListener("click", () => setLanguage("vi"));
langEn?.addEventListener("click", () => setLanguage("en"));

// Environment controls (Settings panel)
// - #envRainToggle : checkbox to enable rain
// - #envDensity : range [0..2] for sparse / default / dense world
const envRainToggle = document.getElementById("envRainToggle");
const envDensity = document.getElementById("envDensity");
// Initialize controls from stored prefs
if (envRainToggle) {
  envRainToggle.checked = !!envRainState;
  envRainToggle.addEventListener("change", (ev) => {
    envRainState = !!ev.target.checked;
    if (env && typeof env.toggleRain === "function") env.toggleRain(envRainState);
    // persist
    localStorage.setItem("envPrefs", JSON.stringify({ rain: envRainState, density: envDensityIndex }));
  });
}
if (envDensity) {
  // set initial slider value (clamped)
  envDensity.value = Math.min(Math.max(0, envDensityIndex), ENV_PRESETS.length - 1);
  envDensity.addEventListener("input", (ev) => {
    const v = parseInt(ev.target.value, 10) || 1;
    envDensityIndex = Math.min(Math.max(0, v), ENV_PRESETS.length - 1);
    const preset = ENV_PRESETS[envDensityIndex];
    // Recreate environment with new density while preserving rain state
    try { if (env && env.root && env.root.parent) env.root.parent.remove(env.root); } catch (e) {}
    env = initEnvironment(scene, Object.assign({}, preset, { enableRain: envRainState }));
    // persist
    localStorage.setItem("envPrefs", JSON.stringify({ rain: envRainState, density: envDensityIndex }));
  });
}

// Selection/aim indicators
/* Load and apply saved loadout so runtime SKILLS.Q/W/E/R reflect player's choice */
let currentLoadout = loadOrDefault(SKILL_POOL, DEFAULT_LOADOUT);

/**
 * Apply an array of 4 skill ids to the SKILLS mapping (mutates exported SKILLS).
 */
function applyLoadoutToSKILLS(loadoutIds) {
  const idMap = new Map(SKILL_POOL.map((s) => [s.id, s]));
  const keys = ["Q", "W", "E", "R"];
  for (let i = 0; i < 4; i++) {
    const id = loadoutIds[i];
    const def = idMap.get(id);
    if (def) {
      // shallow copy to avoid accidental shared references
      SKILLS[keys[i]] = Object.assign({}, def);
    }
  }
}

/**
 * Update the skillbar labels to reflect the active SKILLS mapping.
 */
function updateSkillBarLabels() {
    try {
    const map = { Q: "#btnSkillQ", W: "#btnSkillW", E: "#btnSkillE", R: "#btnSkillR" };
    for (const k of Object.keys(map)) {
      const el = document.querySelector(map[k]);
      if (!el) continue;
      const def = SKILLS[k] || {};
      // icon (emoji/SVG placeholder)
      const iconEl = el.querySelector(".icon");
      if (iconEl) iconEl.textContent = getSkillIcon(def.short || def.name);
      // name / short label
      const nameEl = el.querySelector(".name");
      if (nameEl) nameEl.textContent = def.short || def.name || nameEl.textContent;
      const keyEl = el.querySelector(".key");
      if (keyEl) keyEl.textContent = k;
      // accessibility: set button title to skill name if available
      if (def.name) el.title = def.name;
    }

    // Update central basic button icon (larger visual)
    try {
      const basicBtn = document.getElementById("btnBasic");
      if (basicBtn) {
        const icon = basicBtn.querySelector(".icon");
        if (icon) icon.textContent = getSkillIcon("atk");
        basicBtn.title = basicBtn.title || "Basic Attack";
      }
    } catch (e) {
      // ignore
    }

  } catch (err) {
    console.warn("updateSkillBarLabels error", err);
  }
}

/**
 * Persist and apply a new loadout.
 */
function setLoadoutAndSave(ids) {
  const resolved = resolveLoadout(SKILL_POOL, ids, DEFAULT_LOADOUT);
  currentLoadout = resolved;
  applyLoadoutToSKILLS(currentLoadout);
  saveLoadout(currentLoadout);
  updateSkillBarLabels();
}

/**
 * Render the hero screen skill picker UI into #heroSkillsList
 * - shows hero info, current 4-slot loadout, and the full skill pool
 * - click a slot to select it, then click a skill to assign; or click Assign on a skill
 */
function renderHeroScreen() {
  const container = document.getElementById("heroSkillsList");
  if (!container) return;
  container.innerHTML = "";

  // Hero basic info
  const info = document.createElement("div");
  info.className = "hero-info";
  info.innerHTML = `<div>${t("hero.info.level")}: ${player.level || 1}</div><div>${t("hero.info.hp")}: ${Math.floor(player.hp)}/${player.maxHP}</div><div>${t("hero.info.mp")}: ${Math.floor(player.mp)}/${player.maxMP}</div>`;
  container.appendChild(info);

  // Loadout slots (Q W E R)
  const keys = ["Q", "W", "E", "R"];
  const slotsWrap = document.createElement("div");
  slotsWrap.className = "loadout-slots";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "loadout-slot";
    slot.dataset.slotIndex = String(i);
    const skillId = currentLoadout[i];
    const skillDef = SKILL_POOL.find((s) => s.id === skillId);
    slot.innerHTML = `<div class="slot-key">${keys[i]}</div>
                      <div class="skill-icon">${getSkillIcon(skillDef ? skillDef.short : null)}</div>
                      <div class="slot-short">${skillDef ? skillDef.short : "—"}</div>
                      <div class="slot-name">${skillDef ? skillDef.name : t("hero.slot.empty")}</div>
                      <button class="slot-clear">${t("hero.slot.clear")}</button>`;
    slotsWrap.appendChild(slot);
  }
  container.appendChild(slotsWrap);

  // Skill pool list
  const poolWrap = document.createElement("div");
  poolWrap.className = "skill-pool";
  SKILL_POOL.forEach((s) => {
    const el = document.createElement("div");
    el.className = "skill-pool-item";
    el.dataset.skillId = s.id;
    el.innerHTML = `<div class="skill-icon">${getSkillIcon(s.short)}</div><div class="skill-name">${s.name}</div><button class="assign">${t("hero.assign")}</button>`;
    poolWrap.appendChild(el);
  });
  const poolHeader = document.createElement("div");
  poolHeader.className = "skill-pool-header";
  poolHeader.textContent = t("hero.pool");
  container.appendChild(poolHeader);
  container.appendChild(poolWrap);

  // Interaction handling
  let selectedSlotIndex = null;
  slotsWrap.querySelectorAll(".loadout-slot").forEach((slotEl) => {
    slotEl.addEventListener("click", () => {
      slotsWrap.querySelectorAll(".loadout-slot").forEach((s) => s.classList.remove("selected"));
      slotEl.classList.add("selected");
      selectedSlotIndex = parseInt(slotEl.dataset.slotIndex, 10);
    });
    const clearBtn = slotEl.querySelector(".slot-clear");
    clearBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      currentLoadout[parseInt(slotEl.dataset.slotIndex, 10)] = null;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen();
    });
  });

  poolWrap.querySelectorAll(".skill-pool-item").forEach((itemEl) => {
    const skillId = itemEl.dataset.skillId;
    itemEl.addEventListener("click", () => {
      const slotToAssign = selectedSlotIndex !== null ? selectedSlotIndex : 0;
      currentLoadout[slotToAssign] = skillId;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen();
    });
    const btn = itemEl.querySelector(".assign");
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const slotToAssign = selectedSlotIndex !== null ? selectedSlotIndex : 0;
      currentLoadout[slotToAssign] = skillId;
      setLoadoutAndSave(currentLoadout);
      renderHeroScreen();
    });
  });

  // Actions (reset)
  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const resetBtn = document.createElement("button");
  resetBtn.textContent = t("hero.slot.reset");
  resetBtn.addEventListener("click", () => {
    currentLoadout = DEFAULT_LOADOUT.slice();
    setLoadoutAndSave(currentLoadout);
    renderHeroScreen();
  });
  actions.appendChild(resetBtn);
  container.appendChild(actions);
}

// Apply initial loadout so SKILLS are correct for subsequent UI/effects
applyLoadoutToSKILLS(currentLoadout);
updateSkillBarLabels();

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
  if (e.button === 2) { // Right click: move / select (no auto-attack/move)
    if (player.frozen) {
      portals.handleFrozenPortalClick(raycast, camera, player, clearCenterMsg);
      return;
    }
    const obj = raycast.raycastEnemyOrGround();
    if (obj && obj.type === "enemy") {
      // Select enemy manually instead of auto-targeting/auto-attacking.
      selectedUnit = obj.enemy;
      effects.spawnTargetPing(obj.enemy);
    } else {
      const p = raycast.raycastGround();
      if (p) {
        // Manual move order; do not enable auto-attack.
        player.moveTarget = p.clone();
        player.target = null;
        player.attackMove = false;
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
          skills.castSkill("W", p);
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
    skills.castSkill("Q");
  } else if (k === "w") {
    player.aimMode = true;
    player.aimModeSkill = "W";
    aimPreview.visible = true;
    if (lastMouseGroundPoint) {
      aimPreview.position.set(lastMouseGroundPoint.x, 0.02, lastMouseGroundPoint.z);
    }
    renderer.domElement.style.cursor = "crosshair";
  } else if (k === "e") {
    skills.castSkill("E");
  } else if (k === "r") {
    skills.castSkill("R");
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
  if (firstPerson && typeof player !== "undefined") {
    // Compute world positions for left/right hand anchors (fall back to approximations)
    const ud = player.mesh.userData || {};
    const left = new THREE.Vector3();
    const right = new THREE.Vector3();
    if (ud.leftHandAnchor && ud.handAnchor) {
      ud.leftHandAnchor.getWorldPosition(left);
      ud.handAnchor.getWorldPosition(right);
    } else if (player.mesh.userData && player.mesh.userData.handAnchor) {
      const p = player.pos();
      left.set(p.x - 0.4, p.y + 1.15, p.z + 0.25);
      right.set(p.x + 0.4, p.y + 1.15, p.z + 0.25);
    } else {
      const p = player.pos();
      left.set(p.x - 0.4, p.y + 1.15, p.z);
      right.set(p.x + 0.4, p.y + 1.15, p.z);
    }

    // Midpoint between hands, and forward vector from player orientation
    const mid = left.clone().add(right).multiplyScalar(0.5);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.mesh.quaternion).normalize();

    // Position camera slightly behind the hands (negative forward) so both hands are visible in front
    const desiredPos = mid.clone().add(forward.clone().multiplyScalar(-0.45)).add(new THREE.Vector3(0, 0.05, 0));
    camera.position.lerp(desiredPos, 1 - Math.pow(0.001, dt));

    // Look ahead a bit so view feels natural
    const lookTarget = mid.clone().add(forward.clone().multiplyScalar(1.5));
    camera.lookAt(lookTarget);
  } else {
    updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake);
  }
  updateGridFollow(ground, player);
  ui.updateHUD(player);
  skills.update(t, dt, cameraShake);
  ui.updateMinimap(player, enemies, portals);
  effects.update(t, dt);
  if (env && typeof env.update === "function") env.update(t, dt);
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

  // Auto-acquire nearest enemy if idle and in range (disabled — manual control)
  // Automatic target acquisition was removed so the player fully controls targeting and attacking.
  /*
  if (!player.moveTarget && (!player.target || !player.target.alive) && (!player.holdUntil || now() >= player.holdUntil)) {
    const nearest = getNearestEnemy(player.pos(), WORLD.attackRange + 0.5, enemies);
    if (nearest) player.target = nearest;
  }
  */

  // Attack-move: user-initiated attack-move is respected but automatic acquisition/auto-attack is disabled.
  if (player.attackMove) {
    // Intentionally left blank to avoid auto-acquiring targets while attack-moving.
    // Player must explicitly initiate attacks (e.g. press 'a' then click an enemy).
  }

  // Movement towards target or moveTarget
  let moveDir = null;
  if (player.target && player.target.alive) {
    const d = distance2D(player.pos(), player.target.pos());
    // Do NOT auto-move or auto-basic-attack when a target is set.
    // If the player explicitly used attack-move (player.attackMove) then allow moving toward the target.
    if (player.attackMove && d > WORLD.attackRange * 0.95) {
      moveDir = dir2D(player.pos(), player.target.pos());
    } else {
      // Otherwise, only auto-face the target when nearby (no auto-attack).
      if (d <= WORLD.attackRange * 1.5) {
        const v = dir2D(player.pos(), player.target.pos());
        const targetYaw = Math.atan2(v.x, v.z);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, targetYaw, 0));
        player.mesh.quaternion.slerp(q, Math.min(1, player.turnSpeed * 1.5 * dt));
        player.lastFacingYaw = targetYaw;
        player.lastFacingUntil = now() + 0.6;
      }
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
          player.takeDamage(en.attackDamage);
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
      player.gainXP(en.xpOnDeath);
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
