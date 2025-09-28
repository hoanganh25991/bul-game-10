// Simple PWA Service Worker for GoT RPG
// - Versioned cache name for rollout/cleanup
// - Precache core shell files (kept intentionally small)
// - Runtime cache: cache-first for same-origin GET, network-first for navigations
// - Cleans up old versions on activate

const VERSION = "v1.0.0-20250927";
const CACHE_NAME = `got-rpg-${VERSION}`;

// Keep this list small to avoid heavy installs. Runtime caching will cover the rest.
/** Subpath-safe asset list: resolve relative to SW scope during install */
const CORE_ASSET_PATHS = [
  "./",
  "index.html",
  "manifest.json",
  "lock-zoom.js",
  // CSS
  "css/style.css",
  "css/landscape.css",
  "css/hero.css",
  "css/hud.css",
  "css/panels.css",
  "css/skills.css",
  "css/splash.css",
  "css/mobile.css",
  // Main entry
  "src/main.js"
];

// Utility: cache a request/response clone safely
async function putRuntime(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (_) {}
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const urls = CORE_ASSET_PATHS.map((p) => new URL(p, self.registration.scope).toString());
      await cache.addAll(urls);
    } catch (e) {
      // Ignore partial failures; runtime caching can fill gaps
    } finally {
      // Take control ASAP
      await self.skipWaiting();
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith("got-rpg-")) {
            return caches.delete(key);
          }
        })
      );
    } catch (_) {}
    await self.clients.claim();
  })());
});

// Fetch strategy:
// - Navigations: network-first, fallback to cache (so updates load when online)
// - Same-origin GET assets: cache-first, then network and cache a copy
// - Other methods/origins: passthrough network
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Ignore non-GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: prefer fresh
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        // Optionally, cache the document
        try { await putRuntime(CACHE_NAME, req, fresh.clone()); } catch (_) {}
        return fresh;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(new URL("index.html", self.registration.scope));
        return cached || new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // Same-origin static assets: cache-first
  if (sameOrigin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        // Only cache successful, basic (opaque=false) or opaques if desired
        if (fresh && (fresh.status === 200 || fresh.type === "opaque")) {
          try { await cache.put(req, fresh.clone()); } catch (_) {}
        }
        return fresh;
      } catch (e) {
        // Last resort: return something if available
        return cached || new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  // Cross-origin: try network, fallback to cache if we cached it before
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      return res;
    } catch (_) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      throw _;
    }
  })());
});

// Optional: listen for messages to force update cycle
self.addEventListener("message", (event) => {
  if (!event || !event.data) return;
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
