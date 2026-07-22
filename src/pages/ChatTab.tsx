import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Volume2,
  VolumeX,
  ChevronDown,
  Send,
  Image as ImageIcon,
  File as FileIcon,
  X,
  Users,
  Settings,
  MoreVertical,
  LogOut,
  Trash2,
  Paperclip,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Info,
  Camera,
  Crown,
  ShieldCheck,
  Edit3,
  Save,
  Pin,
  Copy,
  CornerUpLeft,
  Share2,
  Smile,
  Mic,
  StopCircle,
  Video,
  Cloud,
  Bot,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useChatUnread } from "../context/ChatUnreadContext";
import { authService } from "../services/authService";
import { socketService } from "../services/socketService";
import {
  internalChatService,
  ChatRoom,
  ChatMessage,
  ChatAttachment,
} from "../services/internalChatService";
import { UserProfile } from "../types";
import { LinkPreviewCard } from "../components/chat/LinkPreviewCard";
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from "../components/chat/chatData";
import { CHAT_SOUND_MUTED_KEY, playChatNotificationSound } from "../components/chat/chatSound";
import { toast } from "./Toast";


export default function ChatTab() {
  const { userProfile } = useAuth();
  const { markRoomRead } = useChatUnread();
  const currentUserId = userProfile?.uid || "";
  const companyCode = userProfile?.companyCode || "SYSTEM";

  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [companyUsers, setCompanyUsers] = useState<UserProfile[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Pagination State
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const [jumpingToMessage, setJumpingToMessage] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const hasMoreMessagesRef = useRef(true);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    hasMoreMessagesRef.current = hasMoreMessages;
  }, [hasMoreMessages]);

  // Lightbox Preview State
  const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserResults, setShowUserResults] = useState(false);

  // Message Composer
  const [messageInput, setMessageInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Sticker Picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [activeEmojiCategoryTab, setActiveEmojiCategoryTab] = useState(0);

  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Video Recording
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Typing status
  const [typingUsers, setTypingUsers] = useState<{ [roomId: string]: string[] }>({});
  const typingTimeoutRef = useRef<{ [roomId: string]: NodeJS.Timeout }>({});
  const isTypingSentRef = useRef(false);

  // Modals / Dropdowns / Sidebars
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupAvatar, setGroupAvatar] = useState("");
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [membersToAdd, setMembersToAdd] = useState<string[]>([]);

  // Group Settings State
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [savingGroupSettings, setSavingGroupSettings] = useState(false);
  const groupAvatarUploadRef = useRef<HTMLInputElement>(null);

  // New Features State
  const [replyingMessage, setReplyingMessage] = useState<ChatMessage | null>(null);
  const [sharingMessage, setSharingMessage] = useState<ChatMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => localStorage.getItem(CHAT_SOUND_MUTED_KEY) === "1");
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const draftsRef = useRef<Record<string, string>>({});

  // Custom Confirmation Modal State & Helper
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => {
    setConfirmModal({
      ...options,
      isOpen: true,
    });
  };

  // Ứng viên @mention (chỉ trong nhóm, loại trừ chính mình)
  const mentionCandidates = React.useMemo(() => {
    if (!mention || !activeRoom || !activeRoom.isGroup) return [] as any[];
    const q = mention.query.toLowerCase();
    const members = activeRoom.members
      .map((m: any) => m.userId)
      .filter((u: any) => u && String(u._id) !== currentUserId && u.uid !== currentUserId && (u.displayName || "").toLowerCase().includes(q));

    const showAllOption = "all".includes(q) || "tất cả".includes(q) || "tat ca".includes(q) || q === "";
    if (showAllOption) {
      const allCandidate = {
        _id: "all",
        displayName: "all",
        photoURL: "",
        isSpecialAll: true
      };
      return [allCandidate, ...members].slice(0, 6);
    }
    return members.slice(0, 6);
  }, [mention, activeRoom, currentUserId]);

  // Regex nhận diện "@Tên thành viên" để tô sáng trong tin nhắn
  const mentionRegex = React.useMemo(() => {
    if (!activeRoom) return null;
    const names = activeRoom.members
      .map((m: any) => m.userId?.displayName)
      .filter(Boolean)
      .map((n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (activeRoom.isGroup) {
      names.push("all", "Tất cả", "tất cả");
    }

    names.sort((a: string, b: string) => b.length - a.length);
    if (names.length === 0) return null;
    return new RegExp("@(" + names.join("|") + ")", "gi");
  }, [activeRoom]);

  // Tô sáng các @mention thành viên trong một đoạn văn bản (không chứa URL)
  const renderTextWithMentions = (text: string, onDark: boolean): React.ReactNode => {
    if (!mentionRegex) return text;
    const myName = userProfile?.displayName;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    mentionRegex.lastIndex = 0;
    while ((m = mentionRegex.exec(text)) !== null) {
      if (m.index > last) nodes.push(text.slice(last, m.index));
      const isMentionAll = ["all", "tất cả"].includes(m[1].toLowerCase());
      const cls =
        m[1] === myName || isMentionAll
          ? "bg-amber-300/80 text-amber-950 font-bold"
          : onDark
            ? "bg-white/25 text-white"
            : "bg-indigo-100 text-indigo-700";
      nodes.push(
        <span key={`mt-${m.index}`} className={`rounded px-1 font-semibold ${cls}`}>
          {m[0]}
        </span>
      );
      last = m.index + m[0].length;
      if (m.index === mentionRegex.lastIndex) mentionRegex.lastIndex++;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  };

  // Render nội dung tin nhắn: biến URL thành link bấm được + tô sáng @mention
  const renderMessageContent = (content: string, onDark: boolean): React.ReactNode => {
    const urlRe = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRe);
    return parts.map((part, idx) => {
      if (/^https?:\/\//.test(part)) {
        // Tách dấu câu bám cuối URL để không nuốt vào link
        const match = part.match(/^(.*?)([.,;:!?)\]}"']*)$/);
        const url = match ? match[1] : part;
        const trailing = match ? match[2] : "";
        return (
          <React.Fragment key={`u-${idx}`}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`underline break-all hover:opacity-80 ${onDark ? "text-white font-medium" : "text-indigo-600"}`}
            >
              {url}
            </a>
            {trailing}
          </React.Fragment>
        );
      }
      return <React.Fragment key={`t-${idx}`}>{renderTextWithMentions(part, onDark)}</React.Fragment>;
    });
  };
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);

  // Zalo-like Search States & Handlers
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchMessageQuery, setSearchMessageQuery] = useState("");
  const [searchMessageType, setSearchMessageType] = useState<"text" | "link" | "file" | "media" | "all">("all");
  const [searchMessageResults, setSearchMessageResults] = useState<ChatMessage[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);

  // Trigger search when query or type changes
  useEffect(() => {
    if (!activeRoom || !showSearchPanel) return;

    const delayDebounceFn = setTimeout(() => {
      performMessageSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchMessageQuery, searchMessageType, activeRoom?._id, showSearchPanel]);

  const performMessageSearch = async () => {
    if (!activeRoom) return;
    try {
      setSearchingMessages(true);
      const results = await internalChatService.searchMessages(
        activeRoom._id,
        searchMessageQuery,
        searchMessageType
      );
      setSearchMessageResults(results);
    } catch (error: any) {
      console.error("Lỗi tìm kiếm tin nhắn:", error);
    } finally {
      setSearchingMessages(false);
    }
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-indigo-100/40", "ring-4", "ring-indigo-500/20", "transition-all", "duration-500");
      setTimeout(() => {
        el.classList.remove("bg-indigo-100/40", "ring-4", "ring-indigo-500/20");
      }, 2000);
    } else {
      toast.info("Tin nhắn chưa được tải ở khung chat chính. Bạn có thể xem nhanh nội dung ở bảng bên cạnh.");
    }
  };

  // Nhảy tới tin nhắn — tự tải thêm tin cũ (phân trang) nếu tin chưa nằm trong danh sách đã tải
  const jumpToMessage = async (msgId: string) => {
    if (document.getElementById(`msg-${msgId}`)) {
      scrollToMessage(msgId);
      return;
    }
    if (!activeRoom || jumpingToMessage) return;

    setJumpingToMessage(true);
    try {
      let found = messagesRef.current.some((m) => m._id === msgId);
      let attempts = 0;
      while (!found && hasMoreMessagesRef.current && attempts < 15) {
        attempts++;
        const oldest = messagesRef.current[0];
        if (!oldest) break;
        const older = await internalChatService.getMessages(activeRoom._id, 30, oldest.createdAt);
        if (older.length < 30) {
          hasMoreMessagesRef.current = false;
          setHasMoreMessages(false);
        }
        if (older.length === 0) break;
        const merged = [...[...older].reverse(), ...messagesRef.current];
        messagesRef.current = merged;
        setMessages(merged);
        found = merged.some((m) => m._id === msgId);
      }

      // Chờ DOM render rồi cuộn tới
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      if (document.getElementById(`msg-${msgId}`)) {
        scrollToMessage(msgId);
      } else {
        toast.info("Không tìm thấy tin nhắn trong lịch sử trò chuyện.");
      }
    } catch {
      toast.error("Đã xảy ra lỗi khi tải tin nhắn trong lịch sử trò chuyện.");
    } finally {
      setJumpingToMessage(false);
    }
  };


  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Tự động co giãn chiều cao ô nhập theo nội dung (tối đa ~6 dòng)
  useEffect(() => {
    const el = messageInputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  }, [messageInput]);

  // Fetch Rooms & Users on Mount
  useEffect(() => {
    fetchRooms();
    fetchCompanyUsers();
  }, [companyCode]);

  // Socket event listeners
  useEffect(() => {
    if (!socketService.isConnected()) return;

    // Listen for new messages
    const unsubscribeNewMsg = socketService.on(
      "internal_new_message",
      (data: { roomId: string; message: ChatMessage; roomUpdate: ChatRoom }) => {
        const msgSenderId =
          data.message.senderId && typeof data.message.senderId === "object"
            ? data.message.senderId._id
            : data.message.senderId;
        const isMyMessage = msgSenderId === currentUserId;
        const isActiveRoom = !!activeRoom && activeRoom._id === data.roomId;

        // Cập nhật danh sách phòng ngay lập tức (đẩy phòng vừa có tin nhắn lên đầu + đếm chưa đọc)
        setRooms((prevRooms) => {
          const existing = prevRooms.find((r) => r._id === data.roomId);
          const filtered = prevRooms.filter((r) => r._id !== data.roomId);
          const prevUnread = existing?.unreadCount || 0;
          const unreadCount = isActiveRoom || isMyMessage ? 0 : prevUnread + 1;
          const nextRoom = { ...data.roomUpdate, unreadCount };
          return sortRoomsList([nextRoom, ...filtered]);
        });

        // Phát âm báo khi tin nhắn của người khác đến (phòng khác đang mở hoặc tab ẩn)
        if (!isMyMessage && (!isActiveRoom || document.hidden) && localStorage.getItem(CHAT_SOUND_MUTED_KEY) !== "1") {
          playChatNotificationSound();
        }

        // Nếu là phòng đang mở, thêm tin nhắn vào màn hình
        if (activeRoom && activeRoom._id === data.roomId) {
          setMessages((prevMsgs) => {
            // Tránh trùng lặp tin nhắn
            if (prevMsgs.some((m) => m._id === data.message._id)) return prevMsgs;

            // Nếu tin nhắn là của chính mình gửi, thử tìm xem có tin nhắn tạm (temp-) nào trong danh sách không
            const msgSenderId = data.message.senderId && typeof data.message.senderId === "object"
              ? data.message.senderId._id
              : data.message.senderId;
            const isMyMessage = msgSenderId === currentUserId;

            if (isMyMessage) {
              const hasTemp = prevMsgs.some((m) => m._id.startsWith("temp-"));
              if (hasTemp) {
                // Thay thế tin nhắn tạm đầu tiên bằng tin nhắn thực tế từ socket
                let swapped = false;
                return prevMsgs.map((m) => {
                  if (!swapped && m._id.startsWith("temp-")) {
                    swapped = true;
                    return data.message;
                  }
                  return m;
                });
              }
            }

            return [...prevMsgs, data.message];
          });
          // Đánh dấu đã đọc trên server
          internalChatService.markAsRead(data.roomId);
          markRoomRead(data.roomId);
          // Chỉ tự cuộn nếu là tin của mình hoặc đang ở gần đáy; nếu không → tăng đếm tin mới
          if (isMyMessage || isNearBottomRef.current) {
            scrollToBottom("smooth");
          } else {
            setNewMsgCount((c) => c + 1);
          }
        }
      }
    );

    // Listen for room updates (e.g. group name, avatar, member changes)
    const unsubscribeRoomUpdate = socketService.on("internal_room_updated", (updatedRoom: ChatRoom) => {
      setRooms((prevRooms) => {
        const index = prevRooms.findIndex((r) => r._id === updatedRoom._id);
        if (index === -1) {
          return sortRoomsList([updatedRoom, ...prevRooms]);
        }
        const next = [...prevRooms];
        next[index] = updatedRoom;
        return sortRoomsList(next);
      });

      if (activeRoom && activeRoom._id === updatedRoom._id) {
        setActiveRoom(updatedRoom);
      }
    });

    // Listen for room deletions
    const unsubscribeRoomDeleted = socketService.on("internal_room_deleted", (data: { roomId: string }) => {
      setRooms((prevRooms) => prevRooms.filter((r) => r._id !== data.roomId));
      if (activeRoom && activeRoom._id === data.roomId) {
        setActiveRoom(null);
        setMessages([]);
        setShowRoomDetails(false);
        toast.error("Cuộc trò chuyện này đã bị giải tán hoặc bạn đã bị xóa khỏi nhóm.");
      }
    });

    // Listen for read receipts
    const unsubscribeReadReceipt = socketService.on(
      "internal_messages_read",
      (data: { roomId: string; userId: string }) => {
        if (activeRoom && activeRoom._id === data.roomId) {
          setMessages((prevMsgs) =>
            prevMsgs.map((m) => {
              if (!m.readBy.includes(data.userId)) {
                return { ...m, readBy: [...m.readBy, data.userId] };
              }
              return m;
            })
          );
        }
      }
    );

    // Listen for typing indicators
    const unsubscribeTyping = socketService.on(
      "internal_typing_status",
      (data: { roomId: string; userId: string; displayName: string; isTyping: boolean }) => {
        setTypingUsers((prev) => {
          const currentTyping = prev[data.roomId] || [];
          if (data.isTyping) {
            if (currentTyping.includes(data.displayName)) return prev;
            return { ...prev, [data.roomId]: [...currentTyping, data.displayName] };
          } else {
            return { ...prev, [data.roomId]: currentTyping.filter((name) => name !== data.displayName) };
          }
        });
      }
    );

    // Listen for user presence changes (online/offline status check)
    const unsubscribePresence = socketService.on(
      "user_presence_change",
      (data: { userId: string; status: "online" | "offline" }) => {
        // 1. Cập nhật danh sách companyUsers (dành cho ô tìm kiếm)
        setCompanyUsers((prevUsers) =>
          prevUsers.map((u) => (u.uid === data.userId ? { ...u, status: data.status } : u))
        );

        // 2. Cập nhật danh sách rooms (cột bên trái)
        setRooms((prevRooms) =>
          prevRooms.map((r) => {
            if (r.isGroup) return r;
            return {
              ...r,
              members: r.members.map((m) => {
                const mId = m.userId._id || m.userId.uid || m.userId;
                if (mId === data.userId) {
                  return {
                    ...m,
                    userId: {
                      ...m.userId,
                      status: data.status,
                    },
                  };
                }
                return m;
              }),
            };
          })
        );

        // 3. Cập nhật phòng đang mở (activeRoom)
        setActiveRoom((prevRoom) => {
          if (!prevRoom) return null;
          return {
            ...prevRoom,
            members: prevRoom.members.map((m) => {
              const mId = m.userId._id || m.userId.uid || m.userId;
              if (mId === data.userId) {
                return {
                  ...m,
                  userId: {
                    ...m.userId,
                    status: data.status,
                  },
                };
              }
              return m;
            }),
          };
        });
      }
    );

    // Listen for deleted messages
    const unsubscribeMessageDeleted = socketService.on(
      "internal_message_deleted",
      (data: { roomId: string; messageId: string; message: ChatMessage; roomUpdate: ChatRoom }) => {
        if (activeRoom && activeRoom._id === data.roomId) {
          setMessages((prevMsgs) =>
            prevMsgs.map((m) => (m._id === data.messageId ? data.message : m))
          );
        }
        setRooms((prevRooms) =>
          prevRooms.map((r) => (r._id === data.roomUpdate._id ? data.roomUpdate : r))
        );
        if (activeRoom && activeRoom._id === data.roomUpdate._id) {
          setActiveRoom(data.roomUpdate);
        }
      }
    );

    // Cập nhật reaction realtime
    const unsubscribeReaction = socketService.on(
      "internal_message_reaction",
      (data: { roomId: string; messageId: string; message: ChatMessage }) => {
        if (activeRoom && activeRoom._id === data.roomId) {
          setMessages((prevMsgs) =>
            prevMsgs.map((m) => (m._id === data.messageId ? { ...m, reactions: data.message.reactions } : m))
          );
        }
      }
    );

    // Cập nhật tin nhắn đã sửa realtime
    const unsubscribeEdited = socketService.on(
      "internal_message_edited",
      (data: { roomId: string; messageId: string; message: ChatMessage }) => {
        if (activeRoom && activeRoom._id === data.roomId) {
          setMessages((prevMsgs) =>
            prevMsgs.map((m) =>
              m._id === data.messageId ? { ...m, content: data.message.content, editedAt: data.message.editedAt } : m
            )
          );
        }
      }
    );

    return () => {
      unsubscribeNewMsg();
      unsubscribeRoomUpdate();
      unsubscribeRoomDeleted();
      unsubscribeReadReceipt();
      unsubscribeTyping();
      unsubscribePresence();
      unsubscribeMessageDeleted();
      unsubscribeReaction();
      unsubscribeEdited();
    };
  }, [activeRoom]);

  // Helper to scroll to bottom of chat
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      if (messageEndRef.current) {
        messageEndRef.current.scrollIntoView({ behavior });
      }
    });
  };

  // Scroll to bottom when typing status changes
  useEffect(() => {
    if (activeRoom && typingUsers[activeRoom._id]?.length > 0) {
      scrollToBottom("smooth");
    }
  }, [typingUsers, activeRoom?._id]);

  // Join/leave socket room when active room changes
  useEffect(() => {
    if (activeRoom) {
      setCurrentPinnedIndex(0);
      setReplyingMessage(null);
      // Reset search inputs & close search panel on switching room
      setShowSearchPanel(false);
      setSearchMessageQuery("");
      setSearchMessageResults([]);
      // Fetch messages for active room
      fetchMessages(activeRoom._id);
      // Mark as read + xóa badge chưa đọc của phòng này
      internalChatService.markAsRead(activeRoom._id);
      markRoomRead(activeRoom._id);
      setRooms((prev) => prev.map((r) => (r._id === activeRoom._id ? { ...r, unreadCount: 0 } : r)));
      // Khôi phục bản nháp đang gõ dở của phòng này + reset trạng thái phụ
      setEditingMessage(null);
      setMention(null);
      setMessageInput(draftsRef.current[activeRoom._id] || "");
      // Reset trạng thái cuộn/tin mới khi đổi phòng
      setNewMsgCount(0);
      setIsNearBottom(true);
      isNearBottomRef.current = true;
      // Join socket room
      socketService.emit("join_chat_room", { roomId: activeRoom._id });
      sessionStorage.setItem("activeRoomId", activeRoom._id);
    }
    return () => {
      if (activeRoom) {
        // Leave socket room
        socketService.emit("leave_chat_room", { roomId: activeRoom._id });
        sessionStorage.removeItem("activeRoomId");
      }
    };
  }, [activeRoom?._id]);

  // Helper to check if a room is pinned by the current user
  const isRoomPinned = (room: ChatRoom) => {
    const member = room.members.find(
      (m) => m.userId && (m.userId._id || (m.userId as any).uid || m.userId) === currentUserId
    );
    return !!member?.isPinned;
  };

  // Helper to sort rooms list: pinned first, then by updatedAt descending
  const sortRoomsList = (roomsList: ChatRoom[]) => {
    return [...roomsList].sort((a, b) => {
      const aPinned = isRoomPinned(a) ? 1 : 0;
      const bPinned = isRoomPinned(b) ? 1 : 0;

      if (aPinned !== bPinned) {
        return bPinned - aPinned;
      }
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  };

  // Fetch Rooms API
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const data = await internalChatService.getRooms();
      setRooms(sortRoomsList(data));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Fetch Company Users API
  const fetchCompanyUsers = async () => {
    try {
      if (companyCode) {
        const users = await authService.getUsersByCompany(companyCode);
        // Exclude current user from list for general member selection
        setCompanyUsers(users);
      }
    } catch (error: any) {
      console.error("Lỗi khi tải danh sách nhân viên công ty:", error);
    }
  };

  // Fetch Messages API
  const fetchMessages = async (roomId: string) => {
    try {
      setLoadingMessages(true);
      setHasMoreMessages(true);
      const data = await internalChatService.getMessages(roomId, 30);
      // Reverse messages because API returns latest first (createdAt -1)
      setMessages([...data].reverse());
      if (data.length < 30) {
        setHasMoreMessages(false);
      }
      scrollToBottom("auto");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Load More Messages (Pagination)
  const loadMoreMessages = async () => {
    if (!activeRoom || loadingMore || !hasMoreMessages) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;

    try {
      setLoadingMore(true);
      const oldestMsg = messages[0];
      if (!oldestMsg) return;

      const olderMsgs = await internalChatService.getMessages(
        activeRoom._id,
        30,
        oldestMsg.createdAt
      );

      if (olderMsgs.length < 30) {
        setHasMoreMessages(false);
      }

      if (olderMsgs.length > 0) {
        const reversedOlder = [...olderMsgs].reverse();
        setMessages((prev) => [...reversedOlder, ...prev]);

        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (error: any) {
      toast.error("Không thể tải thêm tin nhắn cũ.");
    } finally {
      setLoadingMore(false);
    }
  };

  // Handle Scroll to top
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;

    // Theo dõi khoảng cách tới đáy để hiện nút "cuộn xuống cuối"
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const near = distanceToBottom < 120;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
    if (near && newMsgCount !== 0) setNewMsgCount(0);

    if (container.scrollTop === 0 && hasMoreMessages && !loadingMore && !loadingMessages && messages.length > 0) {
      await loadMoreMessages();
    }
  };

  // Cuộn xuống cuối + xóa đếm tin mới
  const handleScrollToBottomClick = () => {
    scrollToBottom("smooth");
    setNewMsgCount(0);
    setIsNearBottom(true);
    isNearBottomRef.current = true;
  };

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowUserResults(value.trim().length > 0);
  };

  // Start Private Chat 1-1
  const startPrivateChat = async (targetUser: UserProfile) => {
    try {
      const room = await internalChatService.createRoom({
        isGroup: false,
        memberIds: [targetUser.uid],
      });

      // Clear search
      setSearchQuery("");
      setShowUserResults(false);

      // Thêm phòng vào list nếu chưa có
      setRooms((prev) => {
        if (prev.some((r) => r._id === room._id)) return prev;
        return sortRoomsList([room, ...prev]);
      });

      setActiveRoom(room);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Create Group Chat
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.warning("Vui lòng nhập đầy đủ tên phòng chat để tiếp tục.");
      return;
    }
    if (selectedMembers.length < 1) {
      toast.warning("Vui lòng chọn ít nhất một thành viên để tạo phòng chat.");
      return;
    }

    try {
      const room = await internalChatService.createRoom({
        isGroup: true,
        name: groupName.trim(),
        memberIds: selectedMembers,
        avatarURL: groupAvatar,
      });

      toast.success("Chúc mừng! Phòng chat nhóm đã được khởi tạo thành công.");
      // Không thêm trực tiếp vào state để tránh bị duplicate với socket event
      // Socket event 'internal_room_updated' sẽ tự đồng bộ phòng mới cho tất cả thành viên
      setRooms((prev) => {
        if (prev.some((r) => r._id === room._id)) return prev;
        return sortRoomsList([room, ...prev]);
      });
      setActiveRoom(room);
      setShowCreateGroupModal(false);
      // Clear form
      setGroupName("");
      setSelectedMembers([]);
      setGroupAvatar("");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Add members to Group Chat
  const handleAddMembers = async () => {
    if (!activeRoom || membersToAdd.length === 0) return;
    try {
      const updatedRoom = await internalChatService.addMembers(activeRoom._id, membersToAdd);
      toast.success("Thành viên mới đã được thêm vào phòng chat thành công.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
      setShowAddMemberModal(false);
      setMembersToAdd([]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Remove member from Group Chat (Admin only)
  const handleRemoveMember = (userId: string) => {
    if (!activeRoom) return;
    showConfirm({
      title: "Xóa thành viên",
      message: "Bạn có chắc chắn muốn xóa thành viên này ra khỏi phòng chat không?",
      isDanger: true,
      confirmText: "Xóa",
      onConfirm: async () => {
        try {
          const updatedRoom = await internalChatService.removeMember(activeRoom._id, userId);
          toast.success("Đã xóa thành viên ra khỏi phòng chat thành công.");
          setActiveRoom(updatedRoom);
          setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  // Leave Group Chat
  const handleLeaveGroup = () => {
    if (!activeRoom) return;
    showConfirm({
      title: "Rời phòng chat",
      message: "Bạn có chắc chắn muốn rời khỏi phòng chat này không?",
      isDanger: true,
      confirmText: "Rời phòng",
      onConfirm: async () => {
        try {
          await internalChatService.leaveRoom(activeRoom._id);
          toast.success("Bạn đã rời khỏi phòng chat thành công.");
          setRooms((prev) => prev.filter((r) => r._id !== activeRoom._id));
          setActiveRoom(null);
          setMessages([]);
          setShowRoomDetails(false);
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  // Disband Group Chat (Admin only)
  const handleDeleteGroup = () => {
    if (!activeRoom) return;
    showConfirm({
      title: "Giải tán phòng chat",
      message: "LƯU Ý CỰC KỲ QUAN TRỌNG: Giải tán phòng sẽ xóa vĩnh viễn tất cả lịch sử tin nhắn của mọi thành viên. Bạn có chắc chắn muốn tiếp tục?",
      isDanger: true,
      confirmText: "Giải tán",
      onConfirm: async () => {
        try {
          await internalChatService.deleteRoom(activeRoom._id);
          toast.success("Phòng chat nhóm đã được giải tán và xóa toàn bộ dữ liệu thành công.");
          setRooms((prev) => prev.filter((r) => r._id !== activeRoom._id));
          setActiveRoom(null);
          setMessages([]);
          setShowRoomDetails(false);
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  // Ghim/Bỏ ghim phòng chat
  const handleTogglePinRoom = async (roomId: string) => {
    try {
      const updatedRoom = await internalChatService.togglePinRoom(roomId);
      setRooms((prev) => {
        const next = prev.map((r) => (r._id === roomId ? updatedRoom : r));
        return sortRoomsList(next);
      });
      if (activeRoom && activeRoom._id === roomId) {
        setActiveRoom(updatedRoom);
      }
      const isPinned = isRoomPinned(updatedRoom);
      toast.success(isPinned ? "Đã ghim cuộc trò chuyện lên đầu." : "Đã bỏ ghim cuộc trò chuyện.");
    } catch (error: any) {
      toast.error(error.message || "Không thể thực hiện ghim phòng chat.");
    }
  };

  // Update Group Settings (name & avatar) - Group Admin only
  const handleSaveGroupSettings = async () => {
    if (!activeRoom) return;
    const newName = editingGroupName.trim();
    if (!newName) {
      toast.error("Tên phòng chat nhóm không được phép để trống.");
      return;
    }
    setSavingGroupSettings(true);
    try {
      const updatedRoom = await internalChatService.updateRoom(activeRoom._id, {
        name: newName,
      });
      toast.success("Đã cập nhật tên phòng chat thành công.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
      setShowGroupSettings(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingGroupSettings(false);
    }
  };

  // Upload Group Avatar - Group Admin only
  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    setSavingGroupSettings(true);
    try {
      const attachment = await internalChatService.uploadAttachment(file);
      const updatedRoom = await internalChatService.updateRoom(activeRoom._id, {
        avatarURL: attachment.url,
      });
      toast.success("Đã cập nhật ảnh đại diện của phòng chat thành công.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingGroupSettings(false);
      // Reset input
      if (groupAvatarUploadRef.current) groupAvatarUploadRef.current.value = "";
    }
  };

  // Update member role (admin/deputy/member) - Group Admin only
  const handleUpdateMemberRole = (userId: string, targetName: string, newRole: "admin" | "deputy" | "member") => {
    if (!activeRoom) return;
    const isPromoting = newRole === "deputy";
    const confirmMsg = isPromoting
      ? `Bạn có chắc chắn muốn bổ nhiệm ${targetName} làm Phó phòng?`
      : `Bạn có chắc chắn muốn bãi nhiệm chức vụ Phó phòng của ${targetName}?`;

    showConfirm({
      title: isPromoting ? "Bổ nhiệm Phó phòng" : "Bãi nhiệm Phó phòng",
      message: confirmMsg,
      isDanger: !isPromoting,
      confirmText: isPromoting ? "Bổ nhiệm" : "Bãi nhiệm",
      onConfirm: async () => {
        try {
          const updatedRoom = await internalChatService.updateMemberRole(activeRoom._id, userId, newRole);
          if (newRole === "deputy") {
            toast.success(`Đã bổ nhiệm ${targetName} làm Phó phòng thành công!`);
          } else {
            toast.success(`Đã bãi nhiệm chức vụ Phó phòng của ${targetName} thành công.`);
          }
          setActiveRoom(updatedRoom);
          setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  // Pin message in room
  const handlePinMessage = async (messageId: string) => {
    if (!activeRoom) return;
    try {
      const updatedRoom = await internalChatService.pinMessage(activeRoom._id, messageId);
      toast.success("Đã ghim tin nhắn.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Unpin message in room
  const handleUnpinMessage = async (messageId: string) => {
    if (!activeRoom) return;
    try {
      const updatedRoom = await internalChatService.unpinMessage(activeRoom._id, messageId);
      toast.success("Đã bỏ ghim tin nhắn.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => sortRoomsList(prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))));
      setCurrentPinnedIndex(0);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Thu hồi / Xóa tin nhắn
  const handleDeleteMessage = (messageId: string) => {
    if (!activeRoom) return;
    showConfirm({
      title: "Thu hồi tin nhắn",
      message: "Bạn có chắc chắn muốn thu hồi tin nhắn này không? Hành động này không thể hoàn tác.",
      isDanger: true,
      confirmText: "Thu hồi",
      onConfirm: async () => {
        try {
          const deletedMessage = await internalChatService.deleteMessage(activeRoom._id, messageId);
          toast.success("Đã thu hồi tin nhắn.");
          setMessages((prev) => prev.map((m) => (m._id === messageId ? deletedMessage : m)));
        } catch (error: any) {
          toast.error(error.message);
        }
      },
    });
  };

  // Thả / gỡ cảm xúc (reaction) trên tin nhắn — cập nhật lạc quan trước, socket đồng bộ sau
  const handleReact = async (messageId: string, emoji: string) => {
    if (!activeRoom) return;
    setReactionPickerFor(null);
    // Optimistic toggle
    setMessages((prev) =>
      prev.map((m) => {
        if (m._id !== messageId) return m;
        const reactions = m.reactions || [];
        const idx = reactions.findIndex((r) => r.emoji === emoji && r.userId === currentUserId);
        const nextReactions =
          idx >= 0
            ? reactions.filter((_, i) => i !== idx)
            : [...reactions, { emoji, userId: currentUserId }];
        return { ...m, reactions: nextReactions };
      })
    );
    try {
      const updated = await internalChatService.reactToMessage(activeRoom._id, messageId, emoji);
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, reactions: updated.reactions } : m)));
    } catch (error: any) {
      toast.error(error.message || "Thả cảm xúc thất bại.");
    }
  };

  // Bắt đầu sửa tin nhắn: nạp nội dung vào ô nhập
  const startEditMessage = (msg: ChatMessage) => {
    setReplyingMessage(null);
    setEditingMessage(msg);
    setMessageInput(msg.content);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessageInput(activeRoom ? draftsRef.current[activeRoom._id] || "" : "");
  };

  // Handle Typing indicator event emission
  // Chèn emoji vào khung nhập tại vị trí con trỏ (không gửi luôn)
  const handleSelectEmoji = (emoji: string) => {
    const el = messageInputRef.current;
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const next = messageInput.slice(0, start) + emoji + messageInput.slice(end);
      setMessageInput(next);
      if (activeRoom && !editingMessage) draftsRef.current[activeRoom._id] = next;
      // Đưa con trỏ ra sau emoji vừa chèn và giữ focus
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      const next = messageInput + emoji;
      setMessageInput(next);
      if (activeRoom && !editingMessage) draftsRef.current[activeRoom._id] = next;
    }
  };

  // Nhận diện token @mention tại vị trí con trỏ (chỉ trong nhóm)
  const detectMention = (value: string, cursor: number): { query: string; start: number } | null => {
    const before = value.slice(0, cursor);
    const at = before.lastIndexOf("@");
    if (at < 0) return null;
    const prevChar = at > 0 ? before[at - 1] : " ";
    if (at !== 0 && !/\s/.test(prevChar)) return null; // "@" phải ở đầu hoặc sau khoảng trắng
    const query = before.slice(at + 1);
    if (/\n/.test(query) || query.length > 40) return null;
    return { query, start: at };
  };

  // Chèn @Tên vào ô nhập, thay thế token đang gõ
  const insertMention = (displayName: string) => {
    if (!mention) return;
    const el = messageInputRef.current;
    const cursor = el?.selectionStart ?? messageInput.length;
    const next = messageInput.slice(0, mention.start) + "@" + displayName + " " + messageInput.slice(cursor);
    setMessageInput(next);
    if (activeRoom && !editingMessage) draftsRef.current[activeRoom._id] = next;
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = mention.start + displayName.length + 2; // "@" + tên + " "
      el?.setSelectionRange(pos, pos);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    if (activeRoom && !editingMessage) draftsRef.current[activeRoom._id] = e.target.value;

    // Cập nhật gợi ý @mention (chỉ nhóm)
    if (activeRoom?.isGroup) {
      setMention(detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length));
    } else if (mention) {
      setMention(null);
    }

    if (!activeRoom || !socketService.isConnected()) return;

    if (!isTypingSentRef.current) {
      isTypingSentRef.current = true;
      socketService.emit("typing_status", { roomId: activeRoom._id, isTyping: true });
    }

    // Clear old timeout
    if (typingTimeoutRef.current[activeRoom._id]) {
      clearTimeout(typingTimeoutRef.current[activeRoom._id]);
    }

    // Set new timeout to stop typing status after 2 seconds of inactivity
    typingTimeoutRef.current[activeRoom._id] = setTimeout(() => {
      socketService.emit("typing_status", { roomId: activeRoom._id, isTyping: false });
      isTypingSentRef.current = false;
    }, 2000);
  };

  // Handle File Upload Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      setUploadingFile(true);
      const attachment = await internalChatService.uploadAttachment(file);
      setAttachments((prev) => [...prev, attachment]);
      toast.success(`Đã tải lên file: ${file.name}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUploadingFile(false);
      // Reset input value
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Send Sticker (emoji)
  const handleSendSticker = async (emoji: string) => {
    if (!activeRoom) return;
    setShowStickerPicker(false);
    try {
      await internalChatService.sendMessage(activeRoom._id, emoji, [], replyingMessage?._id);
      setReplyingMessage(null);
    } catch (error: any) {
      toast.error(error.message || "Không thể gửi sticker.");
    }
  };

  // Kiểm tra quyền micro/camera trước khi ghi.
  // Nếu quyền đã bị chặn thì hướng dẫn mở lại; nếu chưa hỏi thì getUserMedia sẽ tự hiện hộp thoại xin quyền.
  const ensureMediaPermissions = async (kinds: Array<"microphone" | "camera">): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Trình duyệt không hỗ trợ ghi âm/ghi hình.");
      return false;
    }
    try {
      for (const kind of kinds) {
        const status = await navigator.permissions.query({ name: kind as PermissionName });
        if (status.state === "denied") {
          toast.error(
            kind === "microphone"
              ? "Quyền micro đang bị chặn. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và cho phép Micro rồi thử lại."
              : "Quyền camera đang bị chặn. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ và cho phép Camera rồi thử lại."
          );
          return false;
        }
      }
    } catch {
      // Trình duyệt không hỗ trợ Permissions API cho micro/camera — để getUserMedia tự hỏi quyền
    }
    return true;
  };

  const showMediaError = (error: any, device: "micro" | "camera") => {
    const name = error?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      toast.error(`Bạn chưa cấp quyền ${device}. Hãy bấm "Cho phép" khi trình duyệt hỏi quyền truy cập.`);
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      toast.error(`Không tìm thấy thiết bị ${device} trên máy này.`);
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      toast.error(`Thiết bị ${device} đang được ứng dụng khác sử dụng.`);
    } else {
      toast.error(`Không thể truy cập ${device}. Vui lòng kiểm tra quyền truy cập.`);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    if (!activeRoom) return;
    if (!(await ensureMediaPermissions(["microphone"]))) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (error) {
      showMediaError(error, "micro");
    }
  };

  // Stop & send voice recording
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !activeRoom) return;

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      try {
        setUploadingAudio(true);
        const attachment = await internalChatService.uploadAttachment(audioFile);
        await internalChatService.sendMessage(activeRoom._id, "", [attachment], replyingMessage?._id);
        setReplyingMessage(null);
      } catch (error: any) {
        toast.error(error.message || "Không thể gửi tin nhắn thoại.");
      } finally {
        setUploadingAudio(false);
      }
    };

    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Cancel voice recording
  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.stream.getTracks().forEach((t) => t.stop());
      if (recorder.state !== "inactive") recorder.stop();
    }
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // ===== Video Recording =====
  const VIDEO_MAX_SECONDS = 300; // Giới hạn 5 phút / video để tránh upload quá nặng

  const attachVideoPreview = (el: HTMLVideoElement | null) => {
    if (el && videoStreamRef.current && el.srcObject !== videoStreamRef.current) {
      el.srcObject = videoStreamRef.current;
    }
  };

  const releaseVideoStream = () => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    setIsVideoRecording(false);
    setVideoSeconds(0);
  };

  // Start video recording
  const startVideoRecording = async () => {
    if (!activeRoom) return;
    if (!(await ensureMediaPermissions(["camera", "microphone"]))) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      videoStreamRef.current = stream;
      videoChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      videoRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      recorder.start();
      setIsVideoRecording(true);
      setVideoSeconds(0);
      videoTimerRef.current = setInterval(() => {
        setVideoSeconds((s) => s + 1);
      }, 1000);
    } catch (error) {
      showMediaError(error, "camera");
    }
  };

  // Stop & send video recording
  const stopVideoRecording = () => {
    const recorder = videoRecorderRef.current;
    if (!recorder || !activeRoom) return;
    const roomId = activeRoom._id;
    const replyId = replyingMessage?._id;

    recorder.onstop = async () => {
      const videoBlob = new Blob(videoChunksRef.current, { type: "video/webm" });
      const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, { type: "video/webm" });
      try {
        setUploadingVideo(true);
        const attachment = await internalChatService.uploadAttachment(videoFile);
        await internalChatService.sendMessage(roomId, "", [attachment], replyId);
        setReplyingMessage(null);
      } catch (error: any) {
        toast.error(error.message || "Không thể gửi tin nhắn video.");
      } finally {
        setUploadingVideo(false);
      }
    };

    recorder.stop();
    releaseVideoStream();
  };

  // Cancel video recording
  const cancelVideoRecording = () => {
    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    videoChunksRef.current = [];
    releaseVideoStream();
  };

  // Tự dừng và gửi khi chạm giới hạn thời lượng ghi hình
  useEffect(() => {
    if (isVideoRecording && videoSeconds >= VIDEO_MAX_SECONDS) {
      toast.info("Đã đạt thời lượng tối đa 5 phút — video sẽ được gửi.");
      stopVideoRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSeconds, isVideoRecording]);

  // Tắt micro/camera nếu rời trang khi đang ghi dở
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    };
  }, []);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;

    // Chế độ sửa tin nhắn
    if (editingMessage) {
      const newContent = messageInput.trim();
      const target = editingMessage;
      if (!newContent) {
        toast.error("Nội dung tin nhắn không được để trống.");
        return;
      }
      setEditingMessage(null);
      // Khôi phục bản nháp đang gõ dở (nếu có) sau khi sửa xong
      setMessageInput(draftsRef.current[activeRoom._id] || "");
      if (newContent === target.content) return; // không thay đổi
      // Cập nhật lạc quan
      setMessages((prev) =>
        prev.map((m) => (m._id === target._id ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m))
      );
      try {
        const updated = await internalChatService.editMessage(activeRoom._id, target._id, newContent);
        setMessages((prev) =>
          prev.map((m) => (m._id === target._id ? { ...m, content: updated.content, editedAt: updated.editedAt } : m))
        );
      } catch (error: any) {
        toast.error(error.message || "Sửa tin nhắn thất bại.");
        // Hoàn tác
        setMessages((prev) =>
          prev.map((m) => (m._id === target._id ? { ...m, content: target.content, editedAt: target.editedAt } : m))
        );
      }
      return;
    }

    const trimmedInput = messageInput.trim();
    if (!trimmedInput && attachments.length === 0) return;

    // Stop typing status immediately
    if (typingTimeoutRef.current[activeRoom._id]) {
      clearTimeout(typingTimeoutRef.current[activeRoom._id]);
    }
    socketService.emit("typing_status", { roomId: activeRoom._id, isTyping: false });
    isTypingSentRef.current = false;

    const currentMsgContent = trimmedInput;
    const currentAttachments = [...attachments];
    const currentReplyTo = replyingMessage;

    // Optimistic state update (append message instantly for premium UX)
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      _id: tempId,
      roomId: activeRoom._id,
      senderId: currentUserId,
      senderName: userProfile?.displayName || "Bạn",
      senderPhoto: userProfile?.photoURL || "",
      content: currentMsgContent,
      attachments: currentAttachments,
      replyTo: currentReplyTo || undefined,
      readBy: [currentUserId],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setMessageInput("");
    draftsRef.current[activeRoom._id] = ""; // xóa nháp sau khi gửi
    setMention(null);
    setAttachments([]);
    setReplyingMessage(null);
    scrollToBottom("smooth");

    try {
      const realMessage = await internalChatService.sendMessage(
        activeRoom._id,
        currentMsgContent,
        currentAttachments,
        currentReplyTo?._id
      );

      // Swap temp message with real backend message
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? realMessage : m))
      );
    } catch (error: any) {
      toast.error(error.message);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  };

  // Check if User is group Admin
  const isGroupAdmin = () => {
    if (!activeRoom || !activeRoom.isGroup) return false;
    const currentMember = activeRoom.members.find(
      (m) => (m.userId._id || m.userId.uid || m.userId) === currentUserId
    );
    return currentMember?.role === "admin";
  };

  // Format Room display Name
  const getRoomName = (room: ChatRoom) => {
    if (room.isChatbot) return "Trợ lý AI";
    if (room.isGroup) return room.name || "Nhóm trò chuyện";

    // Phòng Cloud của tôi (chỉ có 1 thành viên là chính mình)
    if (room.members.length === 1) {
      return "Cloud của tôi";
    }

    // Find the other member in private chat
    const otherMember = room.members.find(
      (m) => m.userId && (m.userId._id || m.userId.uid || m.userId) !== currentUserId
    );
    return otherMember?.userId?.displayName || "Tài khoản vô danh";
  };

  // Format Room display Avatar
  const getRoomAvatar = (room: ChatRoom) => {
    if (room.isChatbot) return "ai-avatar";
    if (room.isGroup) return room.avatarURL || "";

    // Phòng Cloud của tôi (chỉ có 1 thành viên là chính mình)
    if (room.members.length === 1) {
      return "cloud-avatar";
    }

    const otherMember = room.members.find(
      (m) => m.userId && (m.userId._id || m.userId.uid || m.userId) !== currentUserId
    );
    return otherMember?.userId?.photoURL || "";
  };

  // Helper to check user online status
  const getOtherUserStatus = (room: ChatRoom) => {
    if (room.isGroup) return null;
    const otherMember = room.members.find(
      (m) => m.userId && (m.userId._id || m.userId.uid || m.userId) !== currentUserId
    );
    return otherMember?.userId?.status || "offline";
  };

  // Filtered rooms search list
  const filteredRooms = rooms.filter((room) => {
    const name = getRoomName(room).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // Filtered users search results (for private chat creation)
  const filteredCompanyUsers = companyUsers.filter((user) => {
    if (user.uid === currentUserId) return false; // Exclude self
    const name = user.displayName.toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  // Check if I am admin or deputy of the current group
  const isGroupAdminOrDeputy = () => {
    if (!activeRoom || !activeRoom.isGroup) return false;
    const member = activeRoom.members.find((m: any) => {
      const mId = m.userId._id || m.userId.uid || m.userId;
      return mId === currentUserId;
    });
    return member?.role === "admin" || member?.role === "deputy";
  };

  const canUserMessage = !activeRoom || !activeRoom.isGroup || !activeRoom.onlyAdminsCanMessage || isGroupAdminOrDeputy();

  const getMsgSenderRole = (msg: any) => {
    if (!activeRoom || !activeRoom.isGroup) return "member";
    const senderId = typeof msg.senderId === "object" && msg.senderId !== null ? msg.senderId._id : msg.senderId;
    const member = activeRoom.members.find((m: any) => {
      const mId = m.userId._id || m.userId.uid || m.userId;
      return mId === senderId;
    });
    return member ? member.role : "member";
  };

  // Rút gọn & làm sạch Markdown của nội dung tin nhắn cho phần xem trước
  const cleanMessagePreviewText = (text?: string, maxLen = 60) => {
    if (!text) return "";
    const cleaned = text
      .replace(/```[\s\S]*?```/g, "[Mã code]")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/#+\s?/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length > maxLen) {
      return cleaned.substring(0, maxLen) + "...";
    }
    return cleaned;
  };

  const formatMessagePreview = (lastMessage?: ChatMessage) => {
    if (!lastMessage) return "Chưa có tin nhắn nào";
    if (lastMessage.isDeleted) return "Tin nhắn đã bị xóa";

    const senderPrefix = lastMessage.senderId === currentUserId ? "Bạn: " : `${lastMessage.senderName}: `;
    const body = cleanMessagePreviewText(lastMessage.content, 55) || (lastMessage.attachments && lastMessage.attachments.length > 0 ? "📎 Tệp đính kèm" : "");
    return `${senderPrefix}${body}`;
  };

  return (
    <div
      className="flex h-full w-full overflow-hidden rounded-none border-0 bg-white/70 shadow-none backdrop-blur-xl md:rounded-3xl md:border md:border-gray-100 md:shadow-2xl md:shadow-slate-100"
      id="chat_tab_root"
    >

      {/* LEFT SIDEBAR: Conversations & Search */}
      <div className={`flex w-80 shrink-0 flex-col border-r border-gray-100 bg-white/30 transition-all duration-300 ${activeRoom ? "hidden md:flex" : "w-full flex"}`} id="chat_sidebar">

        {/* Search & Plus header */}
        <div className="p-4 border-b border-gray-100/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Hội thoại
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 active:scale-95"
                title="Tạo nhóm chat mới"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm người hoặc phòng..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/55 py-2.5 pl-10 pr-4 text-xs outline-none transition-all duration-300 focus:border-indigo-500/80 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 placeholder-slate-400/80 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)]"
            />
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowUserResults(false);
                }}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* List Areas */}
        <div className="flex-1 overflow-y-auto">
          {showUserResults ? (
            /* USER SEARCH RESULTS FOR DIRECT MESSAGING */
            <div className="p-2">
              {/* 1. HỘI THOẠI & NHÓM TRÙNG KHỚP */}
              <p className="px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-400">Cuộc trò chuyện & Nhóm</p>
              {filteredRooms.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-gray-500">Không tìm thấy cuộc trò chuyện nào</p>
              ) : (
                filteredRooms.map((room) => {
                  const isSelected = activeRoom?._id === room._id;
                  const roomName = getRoomName(room);
                  const roomAvatar = getRoomAvatar(room);
                  const onlineStatus = getOtherUserStatus(room);
                  const unreadCount = room.unreadCount || 0;
                  const hasUnread = unreadCount > 0;

                  return (
                    <button
                      key={room._id}
                      onClick={() => {
                        setActiveRoom(room);
                        setSearchQuery("");
                        setShowUserResults(false);
                      }}
                      className={`group mx-1 my-1 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-300 ${isSelected
                        ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/5 border border-indigo-100/50 shadow-xs"
                        : "hover:bg-slate-50/60 border border-transparent text-slate-700"
                        }`}
                    >
                      {/* Avatar */}
                      <div className="relative h-9 w-9 shrink-0 rounded-xl bg-slate-100 overflow-hidden border border-gray-100">
                        {roomAvatar && roomAvatar !== "cloud-avatar" ? (
                          <img src={roomAvatar} alt={roomName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-slate-600 bg-indigo-50">
                            {roomAvatar === "cloud-avatar" ? (
                              <Cloud className="h-4.5 w-4.5 text-indigo-600" />
                            ) : room.isGroup ? (
                              <Users className="h-4.5 w-4.5 text-slate-500" />
                            ) : (
                              roomName.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}
                        {!room.isGroup && room.members.length > 1 && onlineStatus && (
                          <div className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white ${onlineStatus === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-semibold ${hasUnread ? "text-slate-900 font-bold" : "text-slate-700"}`}>{roomName}</p>
                        <p className="truncate text-[10px] text-gray-400">
                          {room.isGroup ? `${room.members.length} thành viên` : "Trò chuyện cá nhân"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}

              <div className="my-2 border-t border-gray-100/50" />

              {/* 2. NHÂN VIÊN (BẮT ĐẦU CHAT MỚI) */}
              <p className="px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2">Tìm nhân viên (Chat mới)</p>
              {filteredCompanyUsers.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-gray-500">Không tìm thấy nhân sự phù hợp</p>
              ) : (
                filteredCompanyUsers.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => startPrivateChat(user)}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-indigo-50/50"
                  >
                    <div className="relative h-10 w-10 shrink-0 rounded-xl bg-indigo-100 overflow-hidden border border-indigo-50">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-bold text-indigo-700">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${user.status === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{user.displayName}</p>
                      <p className="truncate text-xs text-gray-400">{user.email}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </button>
                ))
              )}
            </div>
          ) : (
            /* CONVERSATIONS LIST */
            <div className="py-2">
              {loadingRooms ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin mb-2 text-indigo-600" />
                  <span className="text-xs">Đang tải cuộc trò chuyện...</span>
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageSquare className="h-10 w-10 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">Chưa có cuộc trò chuyện nào</p>
                  <p className="text-xs text-gray-400 mt-1">Tìm nhân viên ở ô tìm kiếm trên để bắt đầu nhắn tin hoặc tạo nhóm chat</p>
                </div>
              ) : (
                filteredRooms.map((room) => {
                  const isSelected = activeRoom?._id === room._id;
                  const roomName = getRoomName(room);
                  const roomAvatar = getRoomAvatar(room);
                  const onlineStatus = getOtherUserStatus(room);
                  const unreadCount = room.unreadCount || 0;
                  const hasUnread = unreadCount > 0;
                  const typingMembers = typingUsers[room._id] || [];

                  return (
                    <button
                      key={room._id}
                      onClick={() => setActiveRoom(room)}
                      className={`group mx-3 my-1.5 flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 ${isSelected
                        ? "bg-gradient-to-r from-indigo-500/10 to-violet-500/5 border border-indigo-100/50 shadow-xs"
                        : "hover:bg-slate-50/60 border border-transparent text-slate-700"
                        }`}
                    >
                      {/* Avatar */}
                      <div className="relative h-11 w-11 shrink-0 rounded-xl bg-slate-100 overflow-hidden border border-gray-100">
                        {roomAvatar && roomAvatar !== "cloud-avatar" && roomAvatar !== "ai-avatar" ? (
                          <img src={roomAvatar} alt={roomName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-slate-600 bg-indigo-50">
                            {roomAvatar === "cloud-avatar" ? (
                              <Cloud className="h-5 w-5 text-indigo-600" />
                            ) : roomAvatar === "ai-avatar" ? (
                              <Bot className="h-5 w-5 text-indigo-600" />
                            ) : room.isGroup ? (
                              <Users className="h-5 w-5 text-slate-500" />
                            ) : (
                              roomName.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}
                        {!room.isGroup && (room.members.length > 1 || room.isChatbot) && (room.isChatbot || onlineStatus) && (
                          <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${room.isChatbot || onlineStatus === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`truncate text-sm font-semibold ${hasUnread ? "text-slate-900 font-bold" : "text-slate-700"}`}>{roomName}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {isRoomPinned(room) && <Pin className="h-3 w-3 text-indigo-500 rotate-45 fill-indigo-500" />}
                            {room.lastMessage && (
                              <span className="text-[10px] text-gray-400">
                                {new Date(room.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Last message / Typing indicator */}
                        {typingMembers.length > 0 ? (
                          <p className="truncate text-xs font-medium text-emerald-600 animate-pulse">
                            {typingMembers.join(", ")} đang nhập...
                          </p>
                        ) : (
                          <p className={`truncate text-xs ${hasUnread ? "text-slate-900 font-semibold" : "text-gray-400"}`}>
                            {formatMessagePreview(room.lastMessage)}
                          </p>
                        )}
                      </div>

                      {/* Unread count badge */}
                      {hasUnread && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT CHAT AREA */}
      <div className={`flex flex-1 flex-col bg-gradient-to-b from-indigo-50/15 via-slate-50/40 to-violet-50/10 relative transition-all duration-300 ${activeRoom ? "flex" : "hidden md:flex"}`} id="chat_box_area">
        {activeRoom ? (
          <>
            {/* CHAT HEADER */}
            <div className="flex h-[72px] items-center justify-between border-b border-gray-100 bg-white/50 px-4 md:px-6 backdrop-blur-md">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {/* Back button on mobile */}
                <button
                  type="button"
                  onClick={() => setActiveRoom(null)}
                  className="md:hidden p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 active:scale-95 transition mr-1"
                  title="Quay lại"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="relative h-11 w-11 rounded-xl bg-slate-100 overflow-hidden border border-gray-200">
                  {getRoomAvatar(activeRoom) && getRoomAvatar(activeRoom) !== "cloud-avatar" && getRoomAvatar(activeRoom) !== "ai-avatar" ? (
                    <img src={getRoomAvatar(activeRoom)} alt={getRoomName(activeRoom)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-slate-600 bg-indigo-50">
                      {getRoomAvatar(activeRoom) === "cloud-avatar" ? (
                        <Cloud className="h-5 w-5 text-indigo-600" />
                      ) : getRoomAvatar(activeRoom) === "ai-avatar" ? (
                        <Bot className="h-5 w-5 text-indigo-600" />
                      ) : activeRoom.isGroup ? (
                        <Users className="h-5 w-5 text-slate-500" />
                      ) : (
                        getRoomName(activeRoom).charAt(0).toUpperCase()
                      )}
                    </div>
                  )}
                  {!activeRoom.isGroup && (activeRoom.members.length > 1 || activeRoom.isChatbot) && (activeRoom.isChatbot || getOtherUserStatus(activeRoom) === "online") && (
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-800">{getRoomName(activeRoom)}</h3>
                  <p className="truncate text-[10px] text-gray-400">
                    {activeRoom.isChatbot ? "Trợ lý ảo AI" : activeRoom.isGroup ? `${activeRoom.members.length} thành viên` : getOtherUserStatus(activeRoom) === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {/* Pin Room Button */}
                <button
                  onClick={() => handleTogglePinRoom(activeRoom._id)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    isRoomPinned(activeRoom)
                      ? "bg-indigo-50 text-indigo-600 shadow-xs"
                      : "text-gray-500 hover:bg-slate-100"
                  }`}
                  title={isRoomPinned(activeRoom) ? "Bỏ ghim cuộc trò chuyện này" : "Ghim cuộc trò chuyện lên đầu"}
                >
                  <Pin className={`h-5 w-5 ${isRoomPinned(activeRoom) ? "fill-indigo-600 rotate-45" : ""}`} />
                </button>

                {/* Search Button */}
                <button
                  onClick={() => {
                    setShowSearchPanel((prev) => !prev);
                    if (!showSearchPanel) {
                      setShowRoomDetails(false);
                      setSearchMessageQuery("");
                      setSearchMessageType("all");
                      setSearchMessageResults([]);
                    }
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${showSearchPanel ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-slate-100"}`}
                  title="Tìm kiếm tin nhắn, file, link"
                >
                  <Search className="h-5 w-5" />
                </button>

                {/* Info Button */}
                <button
                  onClick={() => {
                    setShowRoomDetails((prev) => !prev);
                    if (!showRoomDetails) {
                      setShowSearchPanel(false);
                    }
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${showRoomDetails ? "bg-indigo-50 text-indigo-600" : "text-gray-500 hover:bg-slate-100"}`}
                  title="Thông tin cuộc trò chuyện"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* PINNED MESSAGE BAR */}
            {activeRoom.pinnedMessageIds && activeRoom.pinnedMessageIds.length > 0 && (() => {
              const pinnedList = activeRoom.pinnedMessageIds;
              const idx = Math.min(currentPinnedIndex, pinnedList.length - 1);
              const pinnedMsg = pinnedList[idx];
              if (!pinnedMsg) return null;

              const isObject = typeof pinnedMsg === "object" && pinnedMsg !== null;
              const senderName = isObject ? (pinnedMsg as any).senderName : "Thành viên";
              const contentText = isObject ? cleanMessagePreviewText((pinnedMsg as any).content, 80) || "[Đính kèm]" : "Nội dung tin nhắn";
              const msgId = isObject ? (pinnedMsg as any)._id : pinnedMsg;

              return (
                <div className="flex items-center justify-between bg-amber-50/95 border-b border-amber-100/60 px-6 py-2.5 backdrop-blur-xs text-xs transition-all">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Pin className="h-3.5 w-3.5 text-amber-600 shrink-0 transform rotate-45" />

                    {/* Navigation for multiple pinned messages */}
                    {pinnedList.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0 bg-amber-100/60 rounded-lg p-0.5 mr-1 border border-amber-200/50">
                        <button
                          type="button"
                          onClick={() => setCurrentPinnedIndex((prev) => (prev - 1 + pinnedList.length) % pinnedList.length)}
                          className="p-0.5 hover:bg-amber-200/50 rounded-md text-amber-800 transition"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[10px] font-semibold text-amber-850 px-1 select-none">
                          {idx + 1}/{pinnedList.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentPinnedIndex((prev) => (prev + 1) % pinnedList.length)}
                          className="p-0.5 hover:bg-amber-200/50 rounded-md text-amber-800 transition"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-amber-855 flex items-center gap-1.5">
                        <span>Tin nhắn đã ghim {pinnedList.length > 1 && `(${idx + 1}/${pinnedList.length})`}</span>
                      </p>
                      <p className="text-[11px] text-amber-700 truncate mt-0.5">
                        <strong>{senderName}:</strong> {contentText}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <button
                      onClick={() => jumpToMessage(msgId)}
                      className="font-semibold text-indigo-600 hover:text-indigo-855 transition px-2 py-1 hover:bg-indigo-50/50 rounded-lg"
                    >
                      Xem
                    </button>
                    {(!activeRoom.isGroup || isGroupAdmin()) && (
                      <button
                        onClick={() => handleUnpinMessage(msgId)}
                        className="text-slate-400 hover:text-rose-600 transition p-1 hover:bg-slate-200/40 rounded-lg"
                        title="Bỏ ghim tin nhắn này"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* CHAT BODY FLOW AND DETAILS SIDEBAR */}
            <div className="flex flex-1 overflow-hidden">

              {/* MESSAGES FLOW SCREEN */}
              <div className="flex flex-1 flex-col overflow-hidden relative">

                {/* Messages scroll box */}
                <div
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 md:p-6"
                >
                  {loadingMore && (
                    <div className="flex items-center justify-center py-2 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mr-2" />
                      <span className="text-xs font-semibold">Đang tải tin nhắn cũ...</span>
                    </div>
                  )}
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                      <MessageSquare className="h-12 w-12 text-gray-300 mb-2" />
                      <p className="text-sm font-semibold">Bắt đầu cuộc trò chuyện</p>
                      <p className="text-xs">Hãy gửi lời chào đầu tiên để làm quen nhé!</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const msgSenderId = typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
                      const isMe = msgSenderId === currentUserId;
                      const canPin = activeRoom && (!activeRoom.isGroup || isGroupAdmin());
                      const isPinned = activeRoom && activeRoom.pinnedMessageIds?.some(pinned => {
                        const pinnedId = typeof pinned === "object" ? pinned?._id : pinned;
                        return pinnedId === msg._id;
                      });

                      // Hiển thị ngày nếu tin nhắn trước đó ở ngày khác
                      const showDateHeader =
                        index === 0 ||
                        new Date(msg.createdAt).toDateString() !==
                        new Date(messages[index - 1].createdAt).toDateString();

                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

                      const prevMsgSenderId = prevMsg ? (typeof prevMsg.senderId === "object" ? prevMsg.senderId?._id : prevMsg.senderId) : null;
                      const nextMsgSenderId = nextMsg ? (typeof nextMsg.senderId === "object" ? nextMsg.senderId?._id : nextMsg.senderId) : null;

                      const isPrevSameSender = prevMsg &&
                        !showDateHeader &&
                        (prevMsgSenderId === msgSenderId) &&
                        (Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 60 * 1000);

                      const isNextSameSender = nextMsg &&
                        (new Date(nextMsg.createdAt).toDateString() === new Date(msg.createdAt).toDateString()) &&
                        (nextMsgSenderId === msgSenderId) &&
                        (Math.abs(new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 60 * 1000);

                       const showSenderName = !isMe && activeRoom.isGroup && !isPrevSameSender;
                       const showAvatar = !isMe && (activeRoom.isGroup || activeRoom.isChatbot) && !isNextSameSender;
 
 
                       return (
                         <div key={msg._id} className={`flex flex-col ${index === 0 ? "" : isPrevSameSender ? "mt-1" : "mt-3.5"}`}>
                           {showDateHeader && (
                             <div className="flex justify-center my-3">
                               <span className="rounded-full bg-slate-200/60 px-3 py-1 text-[10px] font-semibold text-slate-500 shadow-xs">
                                 {new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                               </span>
                             </div>
                           )}
 
                           <div id={`msg-${msg._id}`} className={`flex w-full items-start gap-3 group/msg ${isMe ? "justify-end" : "justify-start"}`}>
                             {/* Member Avatar in Group Chat or Chatbot */}
                             {!isMe && (activeRoom.isGroup || activeRoom.isChatbot) && (
                               showAvatar ? (
                                 <div className="h-8 w-8 rounded-lg bg-slate-200 overflow-hidden border border-gray-100 mt-1 shrink-0 flex items-center justify-center">
                                   {activeRoom.isChatbot ? (
                                     <div className="flex h-full w-full items-center justify-center bg-indigo-50">
                                       <Bot className="h-4 w-4 text-indigo-600" />
                                     </div>
                                   ) : msg.senderPhoto ? (
                                     <img src={msg.senderPhoto} alt={msg.senderName} className="h-full w-full object-cover" />
                                   ) : (
                                     <div className="flex h-full w-full items-center justify-center font-bold text-xs text-slate-500">
                                       {msg.senderName.charAt(0).toUpperCase()}
                                     </div>
                                   )}
                                 </div>
                               ) : (
                                 <div className="w-8 shrink-0" /> /* Spacer to keep bubbles aligned */
                               )
                             )}

                            {/* Message actions toolbar (appears on hover) */}
                            <div className={`opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 shrink-0 self-center bg-white border border-gray-100 shadow-xs rounded-xl p-0.5 ${isMe ? "order-first" : "order-last"}`}>
                              {/* Copy Button */}
                              {msg.content && !msg.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(msg.content);
                                    toast.success("Đã sao chép tin nhắn.");
                                  }}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition"
                                  title="Sao chép"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Reply Button */}
                              {!msg.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => setReplyingMessage(msg)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition"
                                  title="Trả lời"
                                >
                                  <CornerUpLeft className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* React Button + quick reactions popover */}
                              {!msg.isDeleted && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setReactionPickerFor(reactionPickerFor === msg._id ? null : msg._id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition"
                                    title="Thả cảm xúc"
                                  >
                                    <Smile className="h-3.5 w-3.5" />
                                  </button>
                                  {reactionPickerFor === msg._id && (
                                    <div className={`absolute bottom-9 z-30 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg ${isMe ? "right-0" : "left-0"}`}>
                                      {QUICK_REACTIONS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => handleReact(msg._id, emoji)}
                                          className="text-xl leading-none hover:scale-125 transition-transform p-0.5"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Share Button */}
                              {!msg.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => setSharingMessage(msg)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition"
                                  title="Chia sẻ / Chuyển tiếp"
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Pin Button */}
                              {canPin && !msg.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => isPinned ? handleUnpinMessage(msg._id) : handlePinMessage(msg._id)}
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-50 ${isPinned ? "text-amber-500 hover:text-amber-600" : "text-slate-400 hover:text-indigo-600"}`}
                                  title={isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                                >
                                  <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-amber-500" : ""}`} />
                                </button>
                              )}

                              {/* Edit Button (Only for own text messages) */}
                              {isMe && !msg.isDeleted && msg.content && (
                                <button
                                  type="button"
                                  onClick={() => startEditMessage(msg)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition"
                                  title="Sửa tin nhắn"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Delete Button (Only for sender or group admin) */}
                              {(isMe || isGroupAdmin()) && !msg.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                  title="Thu hồi tin nhắn"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>


                            {/* Message content block */}
                            <div className="min-w-0 max-w-[85%] sm:max-w-[70%]">
                              {/* Sender Name in group */}
                              {/* Sender Name in group */}
                              {showSenderName && (
                                <div className="flex items-center gap-1.5 ml-1 mb-1">
                                  <span className="text-[10px] font-semibold text-slate-500">
                                    {msg.senderName}
                                  </span>
                                  {getMsgSenderRole(msg) === "admin" && (
                                    <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[8px] font-bold text-amber-700 uppercase leading-none">
                                      Trưởng phòng
                                    </span>
                                  )}
                                  {getMsgSenderRole(msg) === "deputy" && (
                                    <span className="rounded bg-indigo-50 border border-indigo-200 px-1 py-0.2 text-[8px] font-bold text-indigo-700 uppercase leading-none">
                                      Phó phòng
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Bubble */}
                              <div
                                className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all duration-300 ${isMe
                                  ? "bg-gradient-to-br from-indigo-650 via-indigo-600 to-violet-600 text-white rounded-tr-none shadow-md shadow-indigo-100/40"
                                  : getMsgSenderRole(msg) === "admin"
                                    ? "bg-amber-50/90 text-amber-950 rounded-tl-none border border-amber-300 shadow-xs backdrop-blur-xs hover:shadow-md hover:bg-amber-100/50"
                                    : getMsgSenderRole(msg) === "deputy"
                                      ? "bg-indigo-50/90 text-indigo-950 rounded-tl-none border border-indigo-300 shadow-xs backdrop-blur-xs hover:shadow-md hover:bg-indigo-100/50"
                                      : "bg-slate-200 text-slate-800 rounded-tl-none border border-slate-300/50 shadow-xs backdrop-blur-xs hover:shadow-md hover:bg-slate-200/80"
                                  }`}
                              >
                                {/* Quoted / Replied message */}
                                {msg.replyTo && (
                                  <div
                                    onClick={() => {
                                      const repliedId = typeof msg.replyTo === "object" ? msg.replyTo._id : msg.replyTo;
                                      jumpToMessage(repliedId);
                                    }}
                                    className={`mb-2 px-2.5 py-1.5 rounded-lg border-l-4 text-xs cursor-pointer transition max-w-full truncate ${isMe
                                        ? "bg-indigo-700/40 border-indigo-300 text-indigo-100 hover:bg-indigo-700/65"
                                        : "bg-white/70 border-indigo-500 text-slate-700 hover:bg-white/95"
                                      }`}
                                  >
                                    <p className="font-semibold truncate">
                                      {typeof msg.replyTo === "object" ? msg.replyTo.senderName : "Tin nhắn cũ"}
                                    </p>
                                    <p className="truncate mt-0.5">
                                      {typeof msg.replyTo === "object" ? msg.replyTo.content || "[Tệp đính kèm]" : "Xem tin nhắn gốc"}
                                    </p>
                                  </div>
                                )}

                                {/* Text */}
                                {msg.content && <p className="leading-relaxed break-words whitespace-pre-wrap">{renderMessageContent(msg.content, isMe)}</p>}

                                {/* Xem trước liên kết (URL đầu tiên) */}
                                {!msg.isDeleted && msg.content && (() => {
                                  const urlMatch = msg.content.match(/https?:\/\/[^\s]+/);
                                  if (!urlMatch) return null;
                                  const cleanUrl = urlMatch[0].replace(/[.,;:!?)\]}"']+$/, "");
                                  return <LinkPreviewCard url={cleanUrl} onDark={isMe} />;
                                })()}

                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className={`mt-2 space-y-2 ${msg.content ? "border-t border-indigo-400/20 pt-2" : ""}`}>
                                    {msg.attachments.map((file, idx) => {
                                      const isImage = file.type.startsWith("image/");
                                      const isVideo = file.type.startsWith("video/");

                                      if (isImage) {
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setPreviewAttachment(file);
                                            }}
                                            className="block max-w-full rounded-lg overflow-hidden border border-gray-100 bg-black/5 hover:opacity-90 transition cursor-pointer text-left"
                                          >
                                            <img src={file.url} alt={file.name} className="max-h-48 w-full object-cover" />
                                          </button>
                                        );
                                      }

                                      if (isVideo) {
                                        return (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setPreviewAttachment(file);
                                            }}
                                            className="relative block max-w-full rounded-lg overflow-hidden border border-gray-100 bg-black/5 hover:opacity-90 transition cursor-pointer text-left group"
                                          >
                                            <video src={file.url} className="max-h-48 w-full object-cover pointer-events-none" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition">
                                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-800 shadow-md transform group-hover:scale-110 transition">
                                                ▶
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      }

                                      // Audio rendering
                                      if (file.type.startsWith("audio/")) {
                                        return (
                                          <div key={idx} className={`w-[min(280px,calc(100vw-7rem))] max-w-full rounded-xl overflow-hidden border bg-white ${isMe ? "border-indigo-500/30" : "border-slate-200"}`}>
                                            <audio
                                              controls
                                              src={file.url}
                                              className="block h-10 w-full max-w-full"
                                              style={{ colorScheme: "normal" }}
                                            />
                                          </div>
                                        );
                                      }

                                      return (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setPreviewAttachment(file);
                                          }}
                                          className={`flex items-center gap-2 rounded-xl p-2.5 transition border text-left w-full cursor-pointer ${isMe
                                            ? "bg-indigo-700/50 border-indigo-500/30 text-indigo-50 hover:bg-indigo-700/80"
                                            : "bg-slate-50 border-gray-100 text-slate-700 hover:bg-slate-100"
                                            }`}
                                        >
                                          <FileIcon className="h-5 w-5 shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-semibold">{file.name}</p>
                                            {file.size && (
                                              <p className={`text-[10px] ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                                                {(file.size / 1024).toFixed(1)} KB
                                              </p>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Reaction chips */}
                              {msg.reactions && msg.reactions.length > 0 && (() => {
                                const grouped: Record<string, { count: number; mine: boolean }> = {};
                                (msg.reactions || []).forEach((r) => {
                                  const cur = grouped[r.emoji] || { count: 0, mine: false };
                                  cur.count += 1;
                                  if (r.userId === currentUserId) cur.mine = true;
                                  grouped[r.emoji] = cur;
                                });
                                return (
                                  <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                    {Object.entries(grouped).map(([emoji, info]) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleReact(msg._id, emoji)}
                                        title="Nhấn để bật/tắt cảm xúc"
                                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${info.mine
                                            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                          }`}
                                      >
                                        <span className="leading-none">{emoji}</span>
                                        <span className="font-semibold">{info.count}</span>
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}

                              {/* Time & Read indicators under bubble */}
                              {!isNextSameSender && (
                                <div className={`flex items-center gap-1.5 mt-1 text-[9px] text-gray-400 ${isMe ? "justify-end" : "justify-start"}`}>
                                  <span>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {msg.editedAt && !msg.isDeleted && (
                                    <span className="italic">· đã sửa</span>
                                  )}
                                  {isMe && (
                                    <span>
                                      {/* Nếu mọi người trong phòng đã đọc (số người đọc >= tổng số members) */}
                                      {msg.readBy.length >= activeRoom.members.length ? (
                                        <CheckCheck className="h-3 w-3 text-indigo-600" />
                                      ) : (
                                        <Check className="h-3 w-3 text-gray-300" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messageEndRef} />
                </div>

                {/* Floating Typing Indicator overlay */}
                {typingUsers[activeRoom._id]?.length > 0 && (
                  <div className="absolute bottom-4 left-4 md:left-6 rounded-full bg-white/90 border border-gray-100 px-4 py-2 shadow-lg backdrop-blur-sm z-10 flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-600">
                      {typingUsers[activeRoom._id].join(", ")} đang nhập
                    </span>
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}

                {/* Đang tải tin cũ để nhảy tới */}
                {jumpingToMessage && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-white/95 border border-slate-200 px-4 py-2 shadow-lg backdrop-blur-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-600">Đang tìm tin nhắn...</span>
                  </div>
                )}

                {/* Nút cuộn xuống cuối + báo tin nhắn mới */}
                {(!isNearBottom || newMsgCount > 0) && (
                  <button
                    type="button"
                    onClick={handleScrollToBottomClick}
                    className="absolute bottom-4 right-4 md:right-6 z-10 flex items-center gap-1.5 rounded-full bg-white/95 border border-slate-200 pl-2 pr-3 py-2 shadow-lg backdrop-blur-sm hover:bg-white transition active:scale-95"
                    title="Cuộn xuống tin mới nhất"
                  >
                    <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <ChevronDown className="h-4 w-4" />
                    </span>
                    {newMsgCount > 0 && (
                      <span className="text-xs font-bold text-indigo-700">
                        {newMsgCount > 99 ? "99+" : newMsgCount} tin nhắn mới
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* DETAILS SIDEBAR PANEL */}
              {showRoomDetails && (
                <div className="absolute inset-y-0 right-0 z-20 w-full md:relative md:w-72 shrink-0 border-l border-gray-100 bg-white overflow-y-auto flex flex-col justify-between" id="chat_details_panel">
                  {/* Mobile details close header */}
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between md:hidden shrink-0 bg-white">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Info className="h-4 w-4 text-indigo-600" />
                      Chi tiết hội thoại
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRoomDetails(false)}
                      className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-slate-100 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Tab bar: Info vs Settings (chỉ Admin nhóm mới thấy Settings) */}
                  {activeRoom.isGroup && isGroupAdmin() && (
                    <div className="flex border-b border-gray-100 bg-white/80">
                      <button
                        onClick={() => setShowGroupSettings(false)}
                        className={`flex-1 py-3 text-xs font-semibold transition ${!showGroupSettings ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-slate-600"}`}
                      >
                        Thông tin
                      </button>
                      <button
                        onClick={() => {
                          setShowGroupSettings(true);
                          setEditingGroupName(activeRoom.name || "");
                        }}
                        className={`flex-1 py-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${showGroupSettings ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-400 hover:text-slate-600"}`}
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Cài đặt
                      </button>
                    </div>
                  )}

                  <div className="flex-1 p-5 overflow-y-auto">

                    {/* ======================== GROUP SETTINGS PANEL ======================== */}
                    {showGroupSettings && activeRoom.isGroup && isGroupAdmin() ? (
                      <div className="space-y-5">
                        {/* Avatar nhóm */}
                        <div className="flex flex-col items-center text-center">
                          <div className="relative h-20 w-20 rounded-2xl bg-slate-100 overflow-hidden border-2 border-dashed border-indigo-200 mb-2 shadow-md">
                            {getRoomAvatar(activeRoom) ? (
                              <img src={getRoomAvatar(activeRoom)} alt={getRoomName(activeRoom)} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-xl text-slate-600">
                                <Users className="h-8 w-8 text-slate-400" />
                              </div>
                            )}
                            {savingGroupSettings && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Loader2 className="h-5 w-5 text-white animate-spin" />
                              </div>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            ref={groupAvatarUploadRef}
                            onChange={handleGroupAvatarUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => groupAvatarUploadRef.current?.click()}
                            disabled={savingGroupSettings}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition disabled:opacity-50"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Thay ảnh đại diện
                          </button>
                        </div>

                        {/* Đổi tên nhóm */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tên nhóm</label>
                          <input
                            type="text"
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveGroupSettings(); }}
                            placeholder="Nhập tên nhóm..."
                            maxLength={60}
                            className="w-full rounded-xl border border-gray-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:bg-white transition"
                          />
                          <button
                            onClick={handleSaveGroupSettings}
                            disabled={savingGroupSettings || !editingGroupName.trim() || editingGroupName.trim() === activeRoom.name}
                            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 active:scale-95"
                          >
                            {savingGroupSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Lưu tên nhóm
                          </button>
                        </div>

                        {/* Cài đặt quyền nhắn tin */}
                        <div className="border-t border-gray-100 pt-4">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Cài đặt quyền nhắn tin</label>
                          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition">
                            <span className="text-xs text-slate-600 font-medium">Chỉ Trưởng/Phó phòng nhắn tin</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (savingGroupSettings) return;
                                setSavingGroupSettings(true);
                                try {
                                  const updatedRoom = await internalChatService.updateRoom(activeRoom._id, {
                                    onlyAdminsCanMessage: !activeRoom.onlyAdminsCanMessage,
                                  });
                                  toast.success("Đã cập nhật quyền gửi tin nhắn.");
                                  setActiveRoom(updatedRoom);
                                  setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
                                } catch (error: any) {
                                  toast.error(error.message || "Lỗi cập nhật quyền.");
                                } finally {
                                  setSavingGroupSettings(false);
                                }
                              }}
                              disabled={savingGroupSettings}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                activeRoom.onlyAdminsCanMessage ? "bg-indigo-600" : "bg-slate-200"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  activeRoom.onlyAdminsCanMessage ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>


                      </div>
                    ) : (
                      <>
                        {/* ======================== INFO PANEL (default) ======================== */}
                        {/* Header info */}
                        <div className="flex flex-col items-center text-center pb-5 border-b border-gray-100">
                          <div className="relative h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden border border-gray-200 mb-3 shadow-md">
                            {getRoomAvatar(activeRoom) && getRoomAvatar(activeRoom) !== "cloud-avatar" && getRoomAvatar(activeRoom) !== "ai-avatar" ? (
                              <img src={getRoomAvatar(activeRoom)} alt={getRoomName(activeRoom)} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-xl text-slate-600 bg-indigo-50">
                                {getRoomAvatar(activeRoom) === "cloud-avatar" ? (
                                  <Cloud className="h-7 w-7 text-indigo-600" />
                                ) : getRoomAvatar(activeRoom) === "ai-avatar" ? (
                                  <Bot className="h-7 w-7 text-indigo-600" />
                                ) : activeRoom.isGroup ? (
                                  <Users className="h-7 w-7 text-slate-500" />
                                ) : (
                                  getRoomName(activeRoom).charAt(0).toUpperCase()
                                )}
                              </div>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 text-base">{getRoomName(activeRoom)}</h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {activeRoom.isChatbot ? "Trợ lý ảo AI Doanh nghiệp" : activeRoom.isGroup ? "Phòng chat nhóm" : "Phòng chat riêng 1-1"}
                          </p>
                        </div>

                        {/* Member list or AI Capabilities section */}
                        {activeRoom.isChatbot ? (
                          <div className="mt-5 space-y-3.5">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khả năng hỗ trợ</h5>
                            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-indigo-50/30 p-3.5 rounded-2xl border border-indigo-100/30 shadow-xs">
                              <p>🤖 <strong>Trợ lý AI</strong> được tích hợp dữ liệu thời gian thực của doanh nghiệp để hỗ trợ bạn:</p>
                              <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-500 font-medium">
                                <li>Tra cứu tồn kho & sản phẩm</li>
                                <li>Kiểm tra tiến độ Kanban Task & dự án</li>
                                <li>Xem số dư ví cá nhân</li>
                                <li>Tư vấn nghiệp vụ ERP chung</li>
                              </ul>
                              <p className="text-[10px] text-gray-400 italic pt-2 border-t border-slate-100">
                                Dữ liệu được bảo mật tuyệt đối theo phạm vi tài khoản của bạn.
                              </p>
                            </div>
                          </div>
                        ) : activeRoom.isGroup && (
                          <div className="mt-5">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thành viên ({activeRoom.members.length})</h5>
                              {isGroupAdmin() && (
                                <button
                                  onClick={() => {
                                    setMembersToAdd([]);
                                    setShowAddMemberModal(true);
                                  }}
                                  className="text-xs font-bold text-indigo-600 flex items-center gap-0.5 hover:text-indigo-800"
                                >
                                  <Plus className="h-3 w-3" /> Thêm
                                </button>
                              )}
                            </div>

                            <div className="space-y-2">
                              {activeRoom.members.map((member) => {
                                const userObj = typeof member.userId === "object" ? member.userId : {} as any;
                                const memId = (userObj._id || userObj.uid || member.userId) as string;
                                const isMemMe = memId === currentUserId;

                                return (
                                  <div key={memId} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative h-8 w-8 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                        {userObj.photoURL ? (
                                          <img src={userObj.photoURL} alt={userObj.displayName} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center font-bold text-xs text-slate-600">
                                            {userObj.displayName?.charAt(0).toUpperCase() || "?"}
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 truncate">
                                          {userObj.displayName || "Thành viên"} {isMemMe && "(Bạn)"}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate">{userObj.email || ""}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {member.role === "admin" ? (
                                        <span className="rounded-md bg-amber-50 border border-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-600 uppercase">
                                          Trưởng phòng
                                        </span>
                                      ) : member.role === "deputy" ? (
                                        <span className="rounded-md bg-indigo-50 border border-indigo-100 px-1 py-0.5 text-[8px] font-bold text-indigo-600 uppercase">
                                          Phó phòng
                                        </span>
                                      ) : null}
                                      {isGroupAdmin() && !isMemMe && (
                                        <button
                                          onClick={() => handleUpdateMemberRole(memId, member.userId.displayName, member.role === "deputy" ? "member" : "deputy")}
                                          className={`p-1 transition rounded-lg ${member.role === "deputy" ? "text-indigo-600 hover:bg-indigo-50" : "text-slate-400 hover:text-indigo-600 hover:bg-slate-100"}`}
                                          title={member.role === "deputy" ? "Hạ cấp xuống Thành viên thường" : "Thăng cấp làm Phó phòng"}
                                        >
                                          <ShieldCheck className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                      {isGroupAdmin() && !isMemMe && (
                                        <button
                                          onClick={() => handleRemoveMember(memId)}
                                          className="p-1 text-gray-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50"
                                          title="Xóa khỏi nhóm"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Actions buttons - luôn hiển thị ở cuối sidebar */}
                    <div className="mt-6 border-t border-gray-100 pt-4 space-y-2">
                      {activeRoom.isGroup ? (
                        <>
                          <button
                            onClick={handleLeaveGroup}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-95"
                          >
                            <LogOut className="h-4 w-4" />
                            Rời khỏi nhóm
                          </button>
                          {isGroupAdmin() && (
                            <button
                              onClick={handleDeleteGroup}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 py-2.5 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-95"
                            >
                              <Trash2 className="h-4 w-4" />
                              Giải tán nhóm
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-center text-gray-400 leading-normal">
                          Mọi thông tin trong đoạn hội thoại này đều được bảo mật và cô lập trong doanh nghiệp của bạn.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SEARCH SIDEBAR PANEL (Zalo-like search) */}
              {showSearchPanel && (
                <div className="absolute inset-y-0 right-0 z-20 w-full md:relative md:w-80 shrink-0 border-l border-gray-100 bg-white overflow-hidden flex flex-col" id="chat_search_panel">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Search className="h-4 w-4 text-indigo-600" />
                      Tìm kiếm trong phòng
                    </h3>
                    <button
                      onClick={() => setShowSearchPanel(false)}
                      className="text-gray-400 hover:text-gray-600 rounded-lg p-1 hover:bg-slate-100 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Input Search */}
                  <div className="p-3 border-b border-gray-100 bg-white/40">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Tìm tin nhắn, tên file, link..."
                        value={searchMessageQuery}
                        onChange={(e) => setSearchMessageQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/80 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex border-b border-gray-100 bg-white/80 text-[11px] font-semibold text-slate-500 overflow-x-auto shrink-0 scrollbar-none">
                    {[
                      { id: "all", label: "Tất cả" },
                      { id: "text", label: "Tin nhắn" },
                      { id: "media", label: "Ảnh/Video" },
                      { id: "file", label: "File" },
                      { id: "link", label: "Link" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSearchMessageType(tab.id as any)}
                        className={`flex-1 py-3 text-center transition border-b-2 whitespace-nowrap px-1 ${searchMessageType === tab.id
                            ? "text-indigo-600 border-indigo-600"
                            : "border-transparent hover:text-slate-800"
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Results */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/30">
                    {searchingMessages ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600 mb-2" />
                        <span className="text-[11px] font-semibold">Đang tìm kiếm...</span>
                      </div>
                    ) : searchMessageResults.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-xs">Không tìm thấy kết quả phù hợp</p>
                      </div>
                    ) : (
                      searchMessageResults.map((msg) => {
                        const hasAttachments = msg.attachments && msg.attachments.length > 0;
                        const initial = msg.senderName?.charAt(0)?.toUpperCase() || "?";
                        return (
                          <button
                            key={msg._id}
                            type="button"
                            onClick={() => jumpToMessage(msg._id)}
                            className="w-full text-left group flex gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 shadow-xs hover:shadow-sm transition-all duration-150"
                          >
                            {/* Avatar */}
                            <div className="h-8 w-8 shrink-0 rounded-lg overflow-hidden border border-gray-100 mt-0.5">
                              {msg.senderPhoto ? (
                                <img src={msg.senderPhoto} alt={msg.senderName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs">
                                  {initial}
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              {/* Header row */}
                              <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                <span className="text-[11px] font-bold text-slate-700 truncate">{msg.senderName}</span>
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  {new Date(msg.createdAt).toLocaleDateString([], { day: "numeric", month: "numeric" })}
                                  {" "}
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              {/* Message text preview */}
                              {msg.content && (
                                <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 break-words">
                                  {cleanMessagePreviewText(msg.content, 120)}
                                </p>
                              )}

                              {/* Attachments preview */}
                              {hasAttachments && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {msg.attachments!.map((file, idx) => {
                                    const isImage = file.type.startsWith("image/");
                                    const isVideo = file.type.startsWith("video/");
                                    if (isImage) {
                                      return (
                                        <div
                                          key={idx}
                                          onClick={(e) => { e.stopPropagation(); setPreviewAttachment(file); }}
                                          className="h-12 w-12 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-85 transition shrink-0"
                                        >
                                          <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                                        </div>
                                      );
                                    }
                                    if (isVideo) {
                                      return (
                                        <div
                                          key={idx}
                                          onClick={(e) => { e.stopPropagation(); setPreviewAttachment(file); }}
                                          className="relative h-12 w-12 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-85 transition shrink-0"
                                        >
                                          <video src={file.url} className="h-full w-full object-cover pointer-events-none" />
                                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[10px]">▶</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div
                                        key={idx}
                                        onClick={(e) => { e.stopPropagation(); window.open(file.url, "_blank"); }}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                                      >
                                        <FileIcon className="h-3 w-3 text-slate-500 shrink-0" />
                                        <span className="text-[10px] font-semibold text-slate-600 truncate max-w-[90px]">{file.name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CHAT INPUT AREA */}
            <div className="border-t border-gray-100 bg-white/50 p-3 md:p-4 backdrop-blur-md">
              {canUserMessage ? (
                <>
                  {/* Replying message banner */}
                  {/* Gợi ý @mention thành viên (nhóm) */}
                  {mention && mentionCandidates.length > 0 && (
                    <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                      <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Nhắc đến thành viên
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {mentionCandidates.map((u: any) => (
                          <button
                            key={u._id}
                            type="button"
                            onClick={() => insertMention(u.displayName)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-indigo-50"
                          >
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-slate-100">
                              {u.photoURL ? (
                                <img src={u.photoURL} alt={u.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-slate-500">
                                  {u.isSpecialAll ? (
                                    <Users className="h-4 w-4 text-indigo-600" />
                                  ) : (
                                    (u.displayName || "?").charAt(0).toUpperCase()
                                  )}
                                </div>
                              )}
                            </div>
                            <span className="truncate text-sm font-medium text-slate-700">
                              {u.isSpecialAll ? (
                                <span className="font-bold text-indigo-600">@all (Nhắc cả nhóm)</span>
                              ) : (
                                u.displayName
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingMessage && (
                    <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/60 rounded-xl px-4 py-2 mb-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Edit3 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-semibold text-amber-700">Đang sửa tin nhắn</p>
                          <p className="text-slate-500 truncate mt-0.5">{editingMessage.content}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/40"
                        title="Hủy sửa (Esc)"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {replyingMessage && (
                    <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100/50 rounded-xl px-4 py-2 mb-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CornerUpLeft className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="font-semibold text-indigo-850">
                            Đang trả lời {replyingMessage.senderName}
                          </p>
                          <p className="text-slate-500 truncate mt-0.5">
                            {replyingMessage.content || (replyingMessage.attachments && replyingMessage.attachments.length > 0 ? "📎 Tệp đính kèm" : "")}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingMessage(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Attachments preview list */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-100 p-2 text-xs text-indigo-700">
                          <FileIcon className="h-3.5 w-3.5" />
                          <span className="max-w-[120px] truncate font-medium">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-indigo-400 hover:text-indigo-600"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sticker Picker Panel */}
                  {showStickerPicker && (
                    <div className="mb-3 rounded-2xl border border-slate-200/80 bg-white shadow-lg p-3">
                      {/* Category Tabs */}
                      <div className="flex gap-1 border-b border-slate-100 pb-2 mb-2">
                        {EMOJI_CATEGORIES.map((cat, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveEmojiCategoryTab(idx)}
                            className={`text-lg p-1.5 rounded-lg transition-all duration-150 ${activeEmojiCategoryTab === idx ? "bg-indigo-50 border-b-2 border-indigo-500 scale-110" : "hover:bg-slate-100"}`}
                            title={cat.title}
                          >
                            {cat.icon}
                          </button>
                        ))}
                      </div>

                      {/* Emojis Grid */}
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 sm:gap-2.5 max-h-48 overflow-y-auto pr-1">
                        {EMOJI_CATEGORIES[activeEmojiCategoryTab].emojis.map((emoji, i) => (
                          <button
                            key={`${emoji}-${i}`}
                            type="button"
                            onClick={() => handleSelectEmoji(emoji)}
                            className="text-2xl hover:scale-125 transition-transform duration-100 leading-none p-1.5 sm:p-1 rounded-lg hover:bg-slate-50"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    {!isRecording && <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-450 hover:text-indigo-655 hover:bg-indigo-50 border border-slate-150/40 transition active:scale-95 disabled:opacity-50"
                      title="Đính kèm tài liệu, ảnh, video"
                    >
                      {uploadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                    </button>}

                    {/* Sticker button */}
                    {!isRecording && <button
                      type="button"
                      onClick={() => setShowStickerPicker((p) => !p)}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-50 ${showStickerPicker ? "bg-amber-50 text-amber-500 border-amber-200" : "bg-slate-50 text-slate-450 hover:text-amber-500 hover:bg-amber-50 border-slate-150/40"}`}
                      title="Chọn emoji"
                    >
                      <Smile className="h-5 w-5" />
                    </button>}

                    {/* Video record button */}
                    {!isRecording && <button
                      type="button"
                      onClick={startVideoRecording}
                      disabled={uploadingVideo}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-450 hover:text-rose-500 hover:bg-rose-50 border border-slate-150/40 transition active:scale-95 disabled:opacity-50"
                      title="Ghi hình gửi tin nhắn video"
                    >
                      {uploadingVideo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />}
                    </button>}

                    {/* Recording UI or Normal Input */}
                    {isRecording ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-3 sm:px-4 py-2.5">
                        {/* Pulse indicator */}
                        <span className="relative flex h-3 w-3 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-rose-600">
                          <span className="hidden sm:inline">Đang ghi... </span>{Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                        </span>
                        {/* Cancel button */}
                        <button type="button" onClick={cancelRecording} className="text-slate-400 hover:text-rose-600 transition" title="Hủy">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <textarea
                        ref={messageInputRef}
                        rows={1}
                        placeholder="Nhập tin nhắn..."
                        value={messageInput}
                        onChange={handleInputChange}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            // Nếu đang mở gợi ý @mention → chọn người đầu tiên thay vì gửi
                            if (mention && mentionCandidates.length > 0) {
                              e.preventDefault();
                              insertMention(mentionCandidates[0].displayName);
                              return;
                            }
                            e.preventDefault();
                            handleSendMessage(e as unknown as React.FormEvent);
                          } else if (e.key === "Tab") {
                            // Nếu đang mở gợi ý @mention → chọn người đầu tiên khi gõ Tab
                            if (mention && mentionCandidates.length > 0) {
                              e.preventDefault();
                              insertMention(mentionCandidates[0].displayName);
                            }
                          } else if (e.key === "Escape") {
                            if (mention) {
                              e.preventDefault();
                              setMention(null);
                            } else if (editingMessage) {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }
                        }}
                        className="flex-1 resize-none max-h-[140px] rounded-2xl border border-slate-200/80 bg-slate-55/60 py-3 px-5 text-sm leading-relaxed outline-none transition-all duration-300 focus:border-indigo-500/80 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 placeholder-slate-450 focus:shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)]"
                      />
                    )}

                    {/* Mic button or Stop & Send when recording */}
                    {isRecording ? (
                      <button
                        type="button"
                        onClick={stopRecording}
                        disabled={uploadingAudio}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-60"
                        title="Gửi tin nhắn thoại"
                      >
                        {uploadingAudio ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
                      </button>
                    ) : messageInput.trim() || attachments.length > 0 ? (
                      <button
                        type="submit"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white transition-all duration-300 hover:shadow-lg hover:shadow-indigo-200/60 hover:scale-105 active:scale-95 shadow-md shadow-indigo-100"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={startRecording}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-450 hover:text-rose-500 hover:bg-rose-50 border border-slate-150/40 transition active:scale-95"
                        title="Ghi âm tin nhắn thoại"
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </form>
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-100/80 px-4 py-3 text-center border border-slate-200/50">
                  <VolumeX className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500">
                    Chỉ Trưởng phòng hoặc Phó phòng mới được phép gửi tin nhắn trong nhóm này.
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          /* UNSELECTED STATE DISPLAY */
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-indigo-50/15 via-slate-50/40 to-violet-50/10 relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06),transparent_60%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center max-w-sm p-8 rounded-3xl bg-white/70 border border-slate-100/90 shadow-xl backdrop-blur-md transition-all duration-500 hover:shadow-2xl hover:scale-[1.01] group">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white mb-6 shadow-lg shadow-indigo-100 transition-all duration-300 group-hover:scale-110">
                <MessageSquare className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Chào mừng đến với Trò chuyện!</h3>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                Chọn một phòng trò chuyện từ danh sách bên trái hoặc tìm kiếm thành viên trong công ty của bạn để bắt đầu nhắn tin bảo mật thời gian thực.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: VIDEO RECORDING */}
      {isVideoRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <div className="relative overflow-hidden rounded-xl bg-black">
              <video
                ref={attachVideoPreview}
                muted
                playsInline
                autoPlay
                className="w-full max-h-[60vh] object-contain"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                </span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {Math.floor(videoSeconds / 60).toString().padStart(2, "0")}:{(videoSeconds % 60).toString().padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={cancelVideoRecording}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
              >
                <X className="h-4 w-4" />
                Hủy
              </button>
              <button
                type="button"
                onClick={stopVideoRecording}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <StopCircle className="h-4 w-4" />
                Dừng & Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP CHAT */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Tạo nhóm trò chuyện
              </h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tên nhóm *</label>
                <input
                  type="text"
                  placeholder="Nhập tên nhóm..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none transition focus:border-indigo-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chọn thành viên tham gia *</label>
                <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1.5">
                  {companyUsers.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-6">Không tìm thấy thành viên nào</p>
                  ) : (
                    companyUsers.map((user) => {
                      const isSelected = selectedMembers.includes(user.uid);
                      return (
                        <button
                          type="button"
                          key={user.uid}
                          onClick={() => {
                            setSelectedMembers((prev) =>
                              isSelected ? prev.filter((id) => id !== user.uid) : [...prev, user.uid]
                            );
                          }}
                          className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs transition ${isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-600"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center font-bold text-slate-500">
                                  {user.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <p>{user.displayName}</p>
                              <p className="text-[9px] text-gray-400 font-normal">{user.email}</p>
                            </div>
                          </div>
                          <div className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"
                            }`}>
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-500 hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  Tạo nhóm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MEMBER TO GROUP */}
      {showAddMemberModal && activeRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Thêm thành viên vào nhóm
              </h3>
              <button onClick={() => setShowAddMemberModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl p-2 space-y-1.5">
                {companyUsers
                  .filter((user) => !activeRoom.members.some((m) => (m.userId._id || m.userId.uid || m.userId) === user.uid))
                  .map((user) => {
                    const isSelected = membersToAdd.includes(user.uid);
                    return (
                      <button
                        type="button"
                        key={user.uid}
                        onClick={() => {
                          setMembersToAdd((prev) =>
                            isSelected ? prev.filter((id) => id !== user.uid) : [...prev, user.uid]
                          );
                        }}
                        className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs transition ${isSelected ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-600"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-slate-500">
                                {user.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p>{user.displayName}</p>
                            <p className="text-[9px] text-gray-400 font-normal">{user.email}</p>
                          </div>
                        </div>
                        <div className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300"
                          }`}>
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                      </button>
                    );
                  })}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={membersToAdd.length === 0}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX / ATTACHMENT PREVIEW MODAL */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md animate-fade-in">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-slate-900/40 backdrop-blur-xs text-white">
            <div className="min-w-0 flex-1 pr-4">
              <h4 className="text-sm font-bold truncate">{previewAttachment.name}</h4>
              {previewAttachment.size && (
                <p className="text-[10px] text-slate-400 font-mono">
                  {(previewAttachment.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <button
              onClick={() => setPreviewAttachment(null)}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition active:scale-95 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body content */}
          <div className="flex flex-1 items-center justify-center max-w-full max-h-[80vh] mt-16 mb-20 overflow-hidden">
            {previewAttachment.type.startsWith("image/") ? (
              <img
                src={previewAttachment.url}
                alt={previewAttachment.name}
                className="max-h-full max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
              />
            ) : previewAttachment.type.startsWith("video/") ? (
              <video
                src={previewAttachment.url}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-2xl shadow-2xl border border-white/10"
              />
            ) : (
              /* Non-media files preview card */
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 text-center text-white max-w-md w-full shadow-2xl">
                <FileIcon className="h-16 w-16 text-indigo-400 mx-auto mb-4" />
                <h4 className="text-base font-bold mb-2 break-all">{previewAttachment.name}</h4>
                <p className="text-xs text-slate-400 mb-6">
                  {previewAttachment.size ? `Dung lượng: ${(previewAttachment.size / 1024).toFixed(1)} KB` : "Tệp tài liệu"}
                </p>
                <a
                  href={previewAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 text-sm transition active:scale-95"
                >
                  Tải tệp xuống máy
                </a>
              </div>
            )}
          </div>

          {/* Footer action */}
          {(previewAttachment.type.startsWith("image/") || previewAttachment.type.startsWith("video/")) && (
            <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-0 right-0 flex justify-center">
              <a
                href={previewAttachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 text-sm shadow-lg transition active:scale-95 cursor-pointer"
              >
                Mở trong tab mới / Tải xuống
              </a>
            </div>
          )}
        </div>
      )}
      {/* SHARE / FORWARD MESSAGE MODAL */}
      {sharingMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Share2 className="h-4.5 w-4.5 text-indigo-600" />
                <span>Chia sẻ tin nhắn</span>
              </h3>
              <button
                onClick={() => setSharingMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Message Preview */}
            <div className="bg-slate-50 rounded-2xl p-3 mb-4 border border-slate-100/50 text-xs">
              <p className="font-semibold text-slate-600 mb-1">Nội dung chia sẻ:</p>
              <p className="text-slate-700 italic truncate">
                {sharingMessage.content || (sharingMessage.attachments && sharingMessage.attachments.length > 0 ? "📎 Tệp đính kèm" : "")}
              </p>
            </div>

            <p className="text-xs font-semibold text-slate-500 mb-2">Chọn cuộc trò chuyện để chia sẻ:</p>

            {/* Rooms List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px]">
              {rooms.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-8">Chưa có cuộc trò chuyện nào để chia sẻ.</p>
              ) : (
                rooms.map((room) => {
                  const roomName = getRoomName(room);
                  const roomAvatar = getRoomAvatar(room);

                  return (
                    <div
                      key={room._id}
                      className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-2xl transition border border-transparent hover:border-slate-100"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-slate-150 overflow-hidden border border-slate-200 shrink-0">
                          {roomAvatar ? (
                            <img src={roomAvatar} alt={roomName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-bold text-xs text-slate-500">
                              {room.isGroup ? <Users className="h-4 w-4" /> : roomName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate">{roomName}</span>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            await internalChatService.sendMessage(
                              room._id,
                              sharingMessage.content,
                              sharingMessage.attachments
                            );
                            toast.success(`Đã chia sẻ tin nhắn đến ${roomName}`);
                            setSharingMessage(null);
                          } catch (err: any) {
                            toast.error(`Chia sẻ thất bại: ${err.message}`);
                          }
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl transition active:scale-95 cursor-pointer shrink-0"
                      >
                        Gửi
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {/* CUSTOM CONFIRM MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100/80 transform scale-100 transition-all duration-300">
            <h4 className={`text-base font-extrabold mb-2.5 ${confirmModal.isDanger ? "text-rose-600" : "text-slate-800"}`}>
              {confirmModal.title}
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed mb-6 whitespace-pre-line">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 justify-end text-xs font-bold">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 rounded-2xl bg-white hover:bg-slate-50 transition active:scale-95 cursor-pointer"
              >
                {confirmModal.cancelText || "Hủy bỏ"}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                }}
                className={`px-5 py-2.5 text-white rounded-2xl transition active:scale-95 cursor-pointer ${
                  confirmModal.isDanger
                    ? "bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-100"
                    : "bg-indigo-650 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                }`}
              >
                {confirmModal.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
