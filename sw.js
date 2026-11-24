// Service worker: only shows push notifications (no caching).
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json() } catch (_) { d = { title: "Life of Pige", body: e.data ? e.data.text() : "" } }
  e.waitUntil(self.registration.showNotification(d.title || "Life of Pige", {
    body: d.body || "", icon: "icon-180.png", badge: "icon-180.png", tag: d.tag || "streak", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) if ("focus" in c) return c.focus();
    return clients.openWindow(e.notification.data.url || "./");
  }));
});
