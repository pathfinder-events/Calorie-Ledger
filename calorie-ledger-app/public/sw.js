// This app doesn't need offline support, and aggressive caching kept
// serving stale versions after deploys. So this service worker now does
// almost nothing: it's registered (required for the app to be
// "installable" as a PWA) but every request just goes straight to the
// network -- no caching, no stale files, ever.
const CACHE = "calorie-ledger-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up every cache from previous versions of this service worker.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Intentionally not calling event.respondWith() -- this lets the
  // browser handle every request completely normally, with no service
  // worker caching layer involved at all.
});
