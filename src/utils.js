import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// Maps world XZ to minimap pixels centered on (centerX, centerZ)
export function worldToMinimap(x, z, centerX, centerZ, scale = 0.8) {
  const px = 100 + (x - centerX) * scale;
  const pz = 100 + (z - centerZ) * scale;
  return { x: px, y: pz };
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function dir2D(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

export function now() {
  return performance.now() / 1000;
}

// Subtle dark noise texture for ground
export function makeNoiseTexture(size = 256) {
  // Reduce texture size and anisotropy on mobile to save bandwidth/fillrate
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const effSize = isMobile ? Math.max(64, Math.min(192, size)) : size;

  const c = document.createElement("canvas");
  c.width = c.height = effSize;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(effSize, effSize);

  for (let i = 0; i < img.data.length; i += 4) {
    // Neutral grayscale noise (revert from blue tint)
    const v = 24 + Math.floor(Math.random() * 26);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  // Explicit filtering to ensure good minification with repeat; keep mipmaps on to reduce shimmer.
  tex.generateMipmaps = true;
  try {
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
  } catch (_) {}
  // Lower anisotropy on mobile; higher on desktop is fine
  try { tex.anisotropy = isMobile ? 1 : 4; } catch (_) {}
  try { tex.colorSpace = THREE.SRGBColorSpace; } catch (_) {}
  tex.needsUpdate = true;
  return tex;
}

// Seeded RNG utilities
export function hashStringToInt(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRNG(seed = 0) {
  let t = (typeof seed === "number" ? seed >>> 0 : hashStringToInt(String(seed))) >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), 1 | x);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRange(rng, min, max) {
  return min + (max - min) * rng();
}
