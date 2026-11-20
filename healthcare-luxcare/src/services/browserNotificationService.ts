// Thông báo hệ điều hành qua Notification API — dùng khi web đang mở nhưng người dùng
// ở tab khác hoặc thu nhỏ cửa sổ. Trường hợp đóng hẳn tab do Web Push (pushService) đảm nhận.
export const browserNotificationService = {
  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
  },

  /** Xin quyền hiển thị thông báo nếu chưa hỏi; trả về trạng thái quyền hiện tại */
  async requestPermission(): Promise<NotificationPermission | "unsupported"> {
    if (!this.isSupported()) return "unsupported";
    if (Notification.permission === "default") {
      try {
        return await Notification.requestPermission();
      } catch {
        return Notification.permission;
      }
    }
    return Notification.permission;
  },

  show(title: string, options: { body?: string; tag?: string; onClick?: () => void }) {
    if (!this.isSupported() || Notification.permission !== "granted") return;
    try {
      const notification = new Notification(title, {
        body: options.body,
        tag: options.tag,
        icon: "/brand-icon.png",
      });
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    } catch (err) {
      // Một số nền tảng (Chrome Android) chỉ cho phép thông báo qua Service Worker
      console.warn("[browserNotification] Không thể hiển thị thông báo:", err);
    }
  },
};
