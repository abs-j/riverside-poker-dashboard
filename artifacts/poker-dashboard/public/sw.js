// Minimal offline support for the Riverside Poker Club app.
//
// - Hashed build assets and icons are cached after first use (cache-first).
// - Page navigations go to the network first and fall back to the cached app shell,
//   so the app still opens with a weak connection.
// - /api/* and anything cross-origin is never intercepted or stored: member data,
//   session cookies and live ledger responses stay out of the cache.

const CACHE = "poker-static-v1";
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("poker-") && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
            const cache = await caches.open(CACHE);
            await cache.put(SHELL, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(SHELL);
          if (cached) return cached;
          throw new Error("Offline and no cached app shell yet.");
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
