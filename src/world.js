import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { makeNoiseTexture } from "./utils.js";
import { WORLD } from "./constants.js";

export function getTargetPixelRatio() {
  // Read render quality preference (persisted). Default to "high".
  // Values: "low" | "medium" | "high" | (fallback: dynamic)
  let quality = "high";
  try {
    const prefs = JSON.parse(localStorage.getItem("renderPrefs") || "{}");
    if (prefs && typeof prefs.quality === "string") quality = prefs.quality;
  } catch (_) {}

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // Dynamic Resolution Scaling multiplier (set at runtime by main loop). Defaults to 1.0.
  const drs = (typeof window !== "undefined" && typeof window.__drsScale === "number" && window.__drsScale > 0) ? window.__drsScale : 1;

  let base;
  if (quality === "low") {
    base = 1.0;
  } else if (quality === "medium") {
    base = 1.0;
  } else if (quality === "high") {
    // Cap to 2x to avoid excessive GPU cost on ultra-high DPI
    base = Math.min(dpr, 2);
  } else {
    base = 2.0;
  }

  // Apply DRS and clamp to safe bounds for mobile GPUs.
  const result = Math.max(0.6, Math.min(2.0, base * drs));
  return result;
}

/**
 * Initialize renderer, scene, camera, lights, and ground.
 * Appends renderer canvas to document.body.
 */
export function initWorld() {
  const prefs = (() => { try { return JSON.parse(localStorage.getItem("renderPrefs") || "{}"); } catch (_) { return {}; } })();
  const q = typeof prefs.quality === "string" ? prefs.quality : "high";
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: q === "high",
      alpha: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
      stencil: false,
      depth: true
    });
  } catch (e) {
    // Fallback if context creation fails due to driver/flag quirks
    try {
      renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false });
    } catch (e2) {}
  }
  if (!renderer) {
    // Last-resort minimal context
    renderer = new THREE.WebGLRenderer();
  }
  // GPU-friendly defaults (reduce overhead, keep colors correct)
  try {
    if (renderer.debug) renderer.debug.checkShaderErrors = false;
  } catch (_) {}
  try { renderer.outputColorSpace = THREE.SRGBColorSpace; } catch (_) {}
  try { renderer.toneMapping = THREE.NoToneMapping; } catch (_) {}
  try { renderer.shadowMap.enabled = false; } catch (_) {}
  try { renderer.physicallyCorrectLights = false; } catch (_) {}
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(getTargetPixelRatio());
  document.body.prepend(renderer.domElement);
  // Ensure the WebGL canvas sits at the bottom of the stacking order so DOM overlays appear above it.
  try {
    const c = renderer.domElement;
    c.style.position = "fixed";
    c.style.left = "0";
    c.style.top = "0";
    c.style.width = "100%";
    c.style.height = "100%";
    c.style.zIndex = "0";        // overlays like .guide-overlay use a much higher z-index (e.g., 9999)
    c.style.pointerEvents = "auto";

    // Start the canvas hidden with a dark background to avoid a white flash on slow devices.
    // It will be revealed when the renderer produces its first frame (main.js will dispatch 'game-render-ready').
    try {
      c.style.opacity = "0";
      c.style.transition = "opacity 220ms linear";
      c.style.background = "#000";
    } catch (e) {}

    // Ensure renderer clear color is dark as a fallback.
    try {
      if (typeof renderer.setClearColor === "function") {
        renderer.setClearColor(0x000000, 1);
      }
    } catch (e) {}
  } catch (_) {}

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  const cameraOffset = new THREE.Vector3(0, 45, 28);
  camera.position.copy(cameraOffset);
  camera.lookAt(0, 0, 0);

  // Lights
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x0b1120, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(40, 80, 40);
  scene.add(dir);

  // Ground
  const groundTex = makeNoiseTexture(256);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(80, 80);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    new THREE.MeshStandardMaterial({
      emissive: 0x060e1c,
      side: THREE.DoubleSide,
      map: groundTex,
      metalness: 0.0,
      roughness: 1.0,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const cameraShake = { mag: 0, until: 0 };

  return { renderer, scene, camera, ground, cameraOffset, cameraShake };
}

/**
 * Smooth follow camera with slight look-ahead and optional shake.
 * lastMoveDir: THREE.Vector3
 * cameraOffset: THREE.Vector3
 * cameraShake: { mag: number, until: number }
 */
export function updateCamera(camera, player, lastMoveDir, dt, cameraOffset, cameraShake) {
  // look-ahead based on last movement (reduced to avoid speed illusion)
  const lookAhead = lastMoveDir.clone().multiplyScalar(2);
  const base = player.pos().clone().add(cameraOffset).add(new THREE.Vector3(lookAhead.x, 0, lookAhead.z));

  // camera shake
  let targetPos = base;
  const nowT = performance.now() / 1000;
  if (nowT < (cameraShake.until || 0)) {
    const s = cameraShake.mag || 0;
    targetPos = base.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * s,
        (Math.random() - 0.5) * s * 0.5,
        (Math.random() - 0.5) * s
      )
    );
  }

  camera.position.lerp(targetPos, 1 - Math.pow(0.001, dt)); // smooth follow
  camera.lookAt(player.pos().x, 1, player.pos().z);
}

/**
 * Recenter ground under the player to simulate an endless world, with subtle parallax.
 */
export function updateGridFollow(ground, player) {
  const p = player.pos();
  ground.position.x = p.x;
  ground.position.z = p.z;
  if (ground.material && ground.material.map) {
    // Offset scroll does not require re-upload; avoid forcing needsUpdate each frame
    ground.material.map.offset.set(p.x * 0.0004, p.z * 0.0004);
  }
}

/**
 * Attach window resize handling to keep renderer/camera in sync.
 */
export function updateEnvironmentFollow(env, player) {
  if (!env || !env.root || !player || !player.pos) return;
  const p = player.pos();
  const half = (WORLD.groundSize * 0.5 - 6) || 244;
  const margin = Math.min(half * 0.25, 80); // recenter when nearing edge, keep a safety margin
  const dx = p.x - env.root.position.x;
  const dz = p.z - env.root.position.z;
  if (Math.abs(dx) > (half - margin) || Math.abs(dz) > (half - margin)) {
    env.root.position.x = p.x;
    env.root.position.z = p.z;
  }
}

export function addResizeHandler(renderer, camera) {
  function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(getTargetPixelRatio());
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}
