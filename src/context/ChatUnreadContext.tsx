/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { socketService } from "../services/socketService";
import { internalChatService } from "../services/internalChatService";

interface ChatUnreadContextValue {
  totalUnread: number;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({ totalUnread: 0 });

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}

/**
 * Theo dõi tổng số tin nhắn chat nội bộ chưa đọc trên toàn app, độc lập với
 * việc ChatTab có đang mount hay không — dùng cho tiêu đề tab / favicon badge.
 */
export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const currentUserId = userProfile?.uid;
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || !currentUserId) {
      setUnreadByRoom({});
      return;
    }

    let cancelled = false;
    internalChatService
      .getRooms()
      .then((rooms) => {
        if (cancelled) return;
        const initial: Record<string, number> = {};
        rooms.forEach((room) => {
          if (room.unreadCount) initial[room._id] = room.unreadCount;
        });
        setUnreadByRoom(initial);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, currentUserId]);

  useEffect(() => {
    if (!user || !currentUserId) return;

    const unsubscribeNewMessage = socketService.on("internal_new_message", (data: any) => {
      const msg = data?.message;
      const roomId = data?.roomId as string | undefined;
      if (!msg || !roomId) return;
      const senderId = msg.senderId && typeof msg.senderId === "object" ? msg.senderId._id : msg.senderId;

      setUnreadByRoom((prev) => {
        if (senderId === currentUserId) {
          if (!prev[roomId]) return prev;
          const next = { ...prev };
          delete next[roomId];
          return next;
        }
        return { ...prev, [roomId]: (prev[roomId] || 0) + 1 };
      });
    });

    const unsubscribeRead = socketService.on(
      "internal_messages_read",
      (data: { roomId: string; userId: string }) => {
        if (data.userId !== currentUserId) return;
        setUnreadByRoom((prev) => {
          if (!prev[data.roomId]) return prev;
          const next = { ...prev };
          delete next[data.roomId];
          return next;
        });
      }
    );

    const unsubscribeRoomDeleted = socketService.on("internal_room_deleted", (data: { roomId: string }) => {
      setUnreadByRoom((prev) => {
        if (!(data.roomId in prev)) return prev;
        const next = { ...prev };
        delete next[data.roomId];
        return next;
      });
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeRead();
      unsubscribeRoomDeleted();
    };
  }, [user, currentUserId]);

  const totalUnread = useMemo(
    () => Object.values(unreadByRoom).reduce((sum: number, n: number) => sum + n, 0),
    [unreadByRoom]
  );

  const value = useMemo(() => ({ totalUnread }), [totalUnread]);

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}
