import React, { useState, useEffect } from "react";
import { X, Package, Briefcase, GraduationCap, Bell, MessageSquare } from "lucide-react";
import { WebNotification, notificationService } from "../../services/notificationService";
import { playChatNotificationSound } from "../chat/chatSound";
import { useAuth } from "../../context/AuthContext";
import { socketService } from "../../services/socketService";

interface NotificationToastContainerProps {
  onNavigate?: (tab: any, subTab?: string) => void;
}

export function NotificationToastContainer({ onNavigate }: NotificationToastContainerProps) {
  const { userProfile } = useAuth();
  const [toasts, setToasts] = useState<WebNotification[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t._id !== id));
  };

  const handleToastClick = async (toast: WebNotification) => {
    // Đóng popup trước
    removeToast(toast._id);

    // Gọi API cập nhật trạng thái đã đọc ở background (chỉ cho thông báo database thật)
    if (!toast._id.startsWith("chat-")) {
      try {
        await notificationService.markAsRead(toast._id);
        // Gửi event để Header biết cần reload danh sách hoặc cập nhật số lượng unread
        window.dispatchEvent(new Event("notification-mutation"));
      } catch (err) {
        console.error("Lỗi khi đánh dấu đã đọc từ toast click:", err);
      }
    }

    // Điều hướng trang nếu có action định sẵn
    if (toast.action && onNavigate) {
      onNavigate(toast.action.tab, toast.action.subTab);
    }
  };

  // Helper để hiển thị thông báo native của hệ điều hành qua HTML5 Notification API
  const showNativeNotification = (title: string, body: string, actionToast: WebNotification) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      // Chỉ kích hoạt khi người dùng đang không active tab này
      if (document.hidden || !document.hasFocus()) {
        try {
          const nativeNotif = new Notification(title, {
            body: body,
            icon: "/favicon.ico",
            tag: actionToast._id,
          });

          nativeNotif.onclick = () => {
            window.focus();
            handleToastClick(actionToast);
          };
        } catch (err) {
          console.error("Lỗi khi hiển thị thông báo native:", err);
        }
      }
    }
  };

  // Yêu cầu quyền gửi thông báo từ trình duyệt khi mount component
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch((err) => {
          console.warn("Không thể xin quyền thông báo hệ thống:", err);
        });
      }
    }
  }, []);

  useEffect(() => {
    const handleNewNotificationToast = (e: Event) => {
      const customEvent = e as CustomEvent<WebNotification>;
      const newNotif = customEvent.detail;

      if (!newNotif || !newNotif._id) return;

      // 1. Gửi thông báo hệ thống (Native OS Notification) nếu tab không focus
      showNativeNotification(newNotif.title, newNotif.body, newNotif);

      // 2. Đồng thời hiện toast thông thường trong giao diện web
      setToasts((prev) => {
        // Tránh trùng lặp
        if (prev.some((t) => t._id === newNotif._id)) return prev;

        // Phát âm thanh báo khi có thông báo mới
        try {
          playChatNotificationSound();
        } catch (err) {
          console.warn("Không thể phát âm thanh thông báo:", err);
        }

        // Tự động tắt sau 6 giây
        setTimeout(() => {
          removeToast(newNotif._id);
        }, 6000);

        return [...prev, newNotif];
      });
    };

    window.addEventListener("new_notification_toast", handleNewNotificationToast);
    return () => {
      window.removeEventListener("new_notification_toast", handleNewNotificationToast);
    };
  }, []);

  // Đăng ký lắng nghe sự kiện chat socket toàn cục
  useEffect(() => {
    if (!userProfile) return;

    const handleNewChatMessage = (data: { roomId: string; message: any; roomUpdate: any }) => {
      if (!data || !data.message) return;
      const { message, roomId } = data;

      // 1. Kiểm tra xem tin nhắn có phải của người khác gửi không
      const senderId = message.senderId?._id || message.senderId;
      if (senderId === userProfile.uid) return;

      // 2. Không hiển thị popup nếu người dùng đang ở phòng chat đó và trình duyệt đang được focus
      const activeRoomId = sessionStorage.getItem("activeRoomId");
      if (roomId === activeRoomId && document.hasFocus()) return;

      // Check if current user is mentioned (either via @all or personal mention)
      const isMentioned = message.content && (
        message.content.includes("@all") ||
        message.content.includes("@Tất cả") ||
        message.content.includes("@tất cả") ||
        (userProfile.displayName && message.content.includes(`@${userProfile.displayName}`))
      );

      const title = isMentioned
        ? `📢 [Nhắc đến bạn] ${message.senderName || "Tin nhắn mới"}`
        : (message.senderName || "Tin nhắn mới");

      // 3. Tạo thông báo tin nhắn chat ảo
      const chatNotif: WebNotification = {
        _id: `chat-${message._id}-${Date.now()}`,
        title,
        body: message.content || (message.attachments?.length > 0 ? "📎 Đã gửi một tệp đính kèm" : "Tin nhắn mới"),
        type: "he-thong",
        companyCode: userProfile.companyCode || "",
        recipientUid: userProfile.uid,
        read: false,
        action: {
          tab: "TRÒ CHUYỆN",
        },
        createdAt: new Date().toISOString(),
      };

      // 1. Gửi thông báo hệ thống (Native OS Notification) nếu tab không focus
      showNativeNotification(chatNotif.title, chatNotif.body, chatNotif);

      // 2. Đồng thời hiện toast thông thường trong giao diện web
      setToasts((prev) => {
        if (prev.some((t) => t._id === chatNotif._id)) return prev;

        try {
          playChatNotificationSound();
        } catch (err) {
          console.warn("Không thể phát âm thanh thông báo chat:", err);
        }

        setTimeout(() => {
          removeToast(chatNotif._id);
        }, 6000);

        return [...prev, chatNotif];
      });
    };

    const unsub = socketService.on("internal_new_message", handleNewChatMessage);
    return () => {
      unsub();
    };
  }, [userProfile]);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Khối CSS tự động tiêm vào trang để chạy hiệu ứng trượt mượt mà */}
      <style>{`
        @keyframes slideInFromRight {
          0% {
            transform: translateX(120%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-notification-toast {
          animation: slideInFromRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className="fixed bottom-6 right-6 z-100 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          let iconBg = "bg-slate-100 text-slate-600";
          let Icon = Bell;

          const isChat = t._id.startsWith("chat-");

          if (isChat) {
            iconBg = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400";
            Icon = MessageSquare;
          } else {
            switch (t.type) {
              case "kho":
                iconBg = "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";
                Icon = Package;
                break;
              case "task":
                iconBg = "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400";
                Icon = Briefcase;
                break;
              case "training":
                iconBg = "bg-primary-container text-on-primary-container";
                Icon = GraduationCap;
                break;
              case "he-thong":
                iconBg = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                Icon = Bell;
                break;
            }
          }

          return (
            <div
              key={t._id}
              className="animate-notification-toast pointer-events-auto flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 text-on-surface shadow-lg transition-shadow duration-200 hover:shadow-xl"
            >
              <button
                type="button"
                onClick={() => void handleToastClick(t)}
                aria-label={`Xem thông báo: ${t.title}`}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 font-sans">
                  <span className="line-clamp-1 text-balance text-xs font-bold leading-snug text-on-surface">{t.title}</span>
                  <span className="mt-1 line-clamp-2 text-pretty text-xs leading-relaxed text-on-surface-variant">{t.body}</span>
                  <span className="mt-1.5 block text-xs text-on-surface-variant">Vừa xong</span>
                </span>
              </button>

              {/* Nút đóng thông báo nhanh */}
              <button
                type="button"
                aria-label={`Đóng thông báo: ${t.title}`}
                onClick={() => removeToast(t._id)}
                className="shrink-0 cursor-pointer rounded-full p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
