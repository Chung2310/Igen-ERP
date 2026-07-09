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

  useEffect(() => {
    const handleNewNotificationToast = (e: Event) => {
      const customEvent = e as CustomEvent<WebNotification>;
      const newNotif = customEvent.detail;

      if (!newNotif || !newNotif._id) return;

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

      // 3. Tạo thông báo tin nhắn chat ảo
      const chatNotif: WebNotification = {
        _id: `chat-${message._id}-${Date.now()}`,
        title: message.senderName || "Tin nhắn mới",
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
          let bgColor = "bg-white/95 dark:bg-slate-900/95";
          let borderColor = "border-slate-200/80 dark:border-slate-800/80";
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
                iconBg = "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400";
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
              onClick={() => handleToastClick(t)}
              className={`animate-notification-toast flex items-start gap-3 p-4 rounded-2xl border ${borderColor} ${bgColor} shadow-2xl backdrop-blur-md pointer-events-auto cursor-pointer hover:scale-[1.02] hover:shadow-3xl transition-all duration-200 select-none group`}
            >
              {/* Icon hiển thị phân loại thông báo */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm`}>
                <Icon className="h-5.5 w-5.5" />
              </div>

              {/* Nội dung text thông báo */}
              <div className="flex-1 min-w-0 font-sans">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t.title}
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                  {t.body}
                </p>
                <span className="mt-1.5 block font-mono text-[9px] text-slate-400 dark:text-slate-500">
                  Vừa xong
                </span>
              </div>

              {/* Nút đóng thông báo nhanh */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(t._id);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer shrink-0 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-850"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
