import { getAccessToken } from "./authService";

// Chuyển VAPID public key (base64url) sang Uint8Array cho PushManager
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Đăng ký Web Push qua Service Worker — nhận thông báo cả khi đã đóng tab web
export const pushService = {
  isSupported(): boolean {
    return "serviceWorker" in navigator && "PushManager" in window;
  },

  async subscribe(): Promise<void> {
    try {
      if (!this.isSupported()) return;
      if (Notification.permission !== "granted") return;

      const registration = await navigator.serviceWorker.register("/sw.js");

      const keyRes = await fetch("/api/v1/push/public-key", {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      if (!keyRes.ok) return; // Server chưa cấu hình VAPID — bỏ qua trong im lặng
      const keyJson = await keyRes.json();
      const publicKey: string | undefined = keyJson?.data?.publicKey;
      if (!publicKey) return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ subscription, userAgent: navigator.userAgent }),
      });
    } catch (err) {
      console.warn("[pushService] Không thể đăng ký Web Push:", err);
    }
  },

  async unsubscribe(): Promise<void> {
    try {
      if (!this.isSupported()) return;
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;

      await fetch("/api/v1/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    } catch (err) {
      console.warn("[pushService] Không thể hủy đăng ký Web Push:", err);
    }
  },
};
