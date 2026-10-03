/* HabitFlow service worker: push notifications, notification actions, offline app shell. */
const SHELL_CACHE = "habitflow-shell-v1";
const CONFIG_CACHE = "habitflow-config";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("habitflow-shell") && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for pages, cache-first for hashed assets. API calls are never cached.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  if (url.pathname.startsWith("/assets/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// The page tells us where the API lives (it may be on another origin).
self.addEventListener("message", (event) => {
  if (event.data?.type === "config" && event.data.apiBase) {
    caches.open(CONFIG_CACHE).then((c) => c.put("/__config", new Response(JSON.stringify({ apiBase: event.data.apiBase }))));
  }
});

async function apiBase() {
  try {
    const res = await (await caches.open(CONFIG_CACHE)).match("/__config");
    if (res) return (await res.json()).apiBase;
  } catch (_) {
    /* ignore */
  }
  return self.location.origin;
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "HabitFlow", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "HabitFlow", {
      body: data.body || "",
      tag: data.tag,
      renotify: !!data.tag,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      vibrate: [80, 40, 80],
      actions: data.actions || [],
      data: { url: data.url || "/", ...(data.data || {}) },
    }),
  );
});

async function focusOrOpen(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if ("focus" in c) {
      await c.focus();
      c.postMessage({ type: "navigate", url });
      return;
    }
  }
  await self.clients.openWindow(url);
}

async function broadcastRefresh() {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  all.forEach((c) => c.postMessage({ type: "refresh" }));
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();

  if ((event.action === "done" || event.action === "snooze") && data.token) {
    event.waitUntil(
      (async () => {
        try {
          const res = await fetch(`${await apiBase()}/api/push/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: data.token, action: event.action }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "Request failed");
          await self.registration.showNotification(
            event.action === "done" ? "✅ Nice work!" : "⏰ Snoozed for 10 minutes",
            {
              body:
                event.action === "done"
                  ? body.target > 1
                    ? `${n.title.replace(/\s*\(.*\)$/, "")}: ${body.count}/${body.target}`
                    : `${n.title} checked off. Streak protected 🔥`
                  : "We'll remind you again shortly.",
              tag: n.tag,
              icon: "/icon-192.png",
              silent: true,
            },
          );
          broadcastRefresh();
        } catch (err) {
          await self.registration.showNotification("Couldn't update habit", { body: String(err.message || err), icon: "/icon-192.png" });
        }
      })(),
    );
    return;
  }
  event.waitUntil(focusOrOpen(data.url || "/"));
});
