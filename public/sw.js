/* Service Worker cho Web Push của iGen ERP — nhận thông báo tin nhắn mới kể cả khi đã đóng tab web */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "iGen ERP", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "iGen ERP — Thông báo mới";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/brand-icon.png",
      badge: "/brand-icon.png",
      tag: payload.tag || "igen-erp",
      data: { url: payload.url || "/tro-chuyen" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/tro-chuyen";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
