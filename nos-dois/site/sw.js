// Nós Dois: guarda a "casca" do app para abrir mesmo sem internet. Nunca guarda /api.
const CACHE = "nos-dois-v5";
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (e.request.mode === "navigate") {
    // Só a casca do app ("/") vai para o cache; /admin, /privacidade e /termos nunca tomam o lugar dela.
    if (u.pathname !== "/" && u.pathname !== "/index.html") return;
    e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); return r; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

// Avisos: quando o outro responde, deixa recado, vota… o servidor manda um push cifrado.
// Se o app estiver aberto na tela, só pede para ele sincronizar (o pop-up aparece lá dentro).
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const vis = cs.filter((c) => c.visibilityState === "visible");
    if (vis.length) { vis.forEach((c) => c.postMessage({ type: "nd-sync" })); return; }
    return self.registration.showNotification(d.title || "Nós Dois", {
      body: d.body || "Tem novidade no espaço de vocês.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag || "nos-dois",
      renotify: true,
      data: { view: d.view || "home" },
    });
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const view = (e.notification.data && e.notification.data.view) || "home";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin);
    if (c) { c.postMessage({ type: "nd-open", view }); return c.focus(); }
    return self.clients.openWindow("/#ver-" + encodeURIComponent(view));
  }));
});
