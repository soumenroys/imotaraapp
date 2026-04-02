// Imotara Service Worker — offline-first PWA (#24)
// Strategy:
//   • Static assets (JS/CSS/fonts/images): cache-first
//   • Navigation (HTML pages): network-first, fall back to cache
//   • API routes (/api/*): network-only (never cache AI/remote calls)

const CACHE_NAME = "imotara-v1";

// App-shell resources to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/chat",
  "/grow",
  "/history",
  "/settings",
  "/site.webmanifest",
  "/favicon.ico",
  "/android-chrome-192.png",
  "/android-chrome-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = { title: "Imotara", body: "How are you feeling today?", icon: "/android-chrome-192.png", url: "/chat" };
  try { if (event.data) data = { ...data, ...JSON.parse(event.data.text()) }; } catch { /* use defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: "/android-chrome-192.png",
      data: { url: data.url },
      tag: "imotara-nudge",   // replace previous nudge, don't stack
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/chat";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ─── Fetch caching ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API routes or non-GET requests
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return; // let browser handle normally
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/static/") ||
    /\.(png|jpg|jpeg|svg|ico|webp|woff2?|ttf|otf)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // Navigation / HTML: network-first, fall back to cache
  if (request.mode === "navigate" || request.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }
});
