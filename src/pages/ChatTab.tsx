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
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
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

  // Ứng viên @mention (chỉ trong nhóm, loại trừ chính mình)
  const mentionCandidates = React.useMemo(() => {
    if (!mention || !activeRoom || !activeRoom.isGroup) return [] as any[];
    const q = mention.query.toLowerCase();
    return activeRoom.members
      .map((m: any) => m.userId)
      .filter((u: any) => u && String(u._id) !== currentUserId && u.uid !== currentUserId && (u.displayName || "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [mention, activeRoom, currentUserId]);

  // Regex nhận diện "@Tên thành viên" để tô sáng trong tin nhắn
  const mentionRegex = React.useMemo(() => {
    if (!activeRoom) return null;
    const names = activeRoom.members
      .map((m: any) => m.userId?.displayName)
      .filter(Boolean)
      .map((n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a: string, b: string) => b.length - a.length);
    if (names.length === 0) return null;
    return new RegExp("@(" + names.join("|") + ")", "g");
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
      const cls =
        m[1] === myName
          ? "bg-amber-300/80 text-amber-950"
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
      toast.error("Không thể tải tin nhắn cũ để nhảy tới.");
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
          return [{ ...data.roomUpdate, unreadCount }, ...filtered];
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
          return [updatedRoom, ...prevRooms];
        }
        const next = [...prevRooms];
        next[index] = updatedRoom;
        return next;
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
    }
    return () => {
      if (activeRoom) {
        // Leave socket room
        socketService.emit("leave_chat_room", { roomId: activeRoom._id });
      }
    };
  }, [activeRoom?._id]);

  // Fetch Rooms API
  const fetchRooms = async () => {
    try {
      setLoadingRooms(true);
      const data = await internalChatService.getRooms();
      setRooms(data);
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
        return [room, ...prev];
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
      toast.warning("Vui lòng nhập tên nhóm.");
      return;
    }
    if (selectedMembers.length < 1) {
      toast.warning("Vui lòng chọn ít nhất 1 thành viên tham gia.");
      return;
    }

    try {
      const room = await internalChatService.createRoom({
        isGroup: true,
        name: groupName.trim(),
        memberIds: selectedMembers,
        avatarURL: groupAvatar,
      });

      toast.success("Tạo nhóm chat thành công!");
      setRooms((prev) => [room, ...prev]);
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
      toast.success("Đã thêm thành viên vào nhóm.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
      setShowAddMemberModal(false);
      setMembersToAdd([]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Remove member from Group Chat (Admin only)
  const handleRemoveMember = async (userId: string) => {
    if (!activeRoom) return;
    if (confirm("Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?")) {
      try {
        const updatedRoom = await internalChatService.removeMember(activeRoom._id, userId);
        toast.success("Đã xóa thành viên khỏi nhóm.");
        setActiveRoom(updatedRoom);
        setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  // Leave Group Chat
  const handleLeaveGroup = async () => {
    if (!activeRoom) return;
    if (confirm("Bạn có chắc chắn muốn rời khỏi nhóm chat này?")) {
      try {
        await internalChatService.leaveRoom(activeRoom._id);
        toast.success("Bạn đã rời nhóm chat.");
        setRooms((prev) => prev.filter((r) => r._id !== activeRoom._id));
        setActiveRoom(null);
        setMessages([]);
        setShowRoomDetails(false);
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  // Disband Group Chat (Admin only)
  const handleDeleteGroup = async () => {
    if (!activeRoom) return;
    if (confirm("LƯU Ý CỰC KỲ QUAN TRỌNG: Giải tán nhóm sẽ xóa vĩnh viễn tất cả lịch sử tin nhắn của mọi thành viên. Bạn có chắc chắn?")) {
      try {
        await internalChatService.deleteRoom(activeRoom._id);
        toast.success("Đã giải tán nhóm chat.");
        setRooms((prev) => prev.filter((r) => r._id !== activeRoom._id));
        setActiveRoom(null);
        setMessages([]);
        setShowRoomDetails(false);
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  // Update Group Settings (name & avatar) - Group Admin only
  const handleSaveGroupSettings = async () => {
    if (!activeRoom) return;
    const newName = editingGroupName.trim();
    if (!newName) {
      toast.error("Tên nhóm không được để trống.");
      return;
    }
    setSavingGroupSettings(true);
    try {
      const updatedRoom = await internalChatService.updateRoom(activeRoom._id, {
        name: newName,
      });
      toast.success("Đã cập nhật tên nhóm thành công.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
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
      toast.success("Đã cập nhật ảnh đại diện nhóm.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingGroupSettings(false);
      // Reset input
      if (groupAvatarUploadRef.current) groupAvatarUploadRef.current.value = "";
    }
  };

  // Transfer Admin Role to another member - Group Admin only
  const handleTransferAdmin = async (targetUserId: string, targetName: string) => {
    if (!activeRoom) return;
    if (!confirm(`Chuyển quyền Trưởng nhóm cho ${targetName}? Bạn sẽ trở thành thành viên thông thường sau khi xác nhận.`)) return;
    try {
      // Thêm thành viên mới với quyền admin (API sẽ handle)
      const updatedRoom = await internalChatService.updateRoom(activeRoom._id, {
        name: activeRoom.name,
        // Note: transfer admin requires a dedicated endpoint. Using removeMember + addMembers workaround not ideal.
        // We'll mark the room locally and notify user to use a proper API if needed.
      });
      // Hiện tại gọi API chuyển quyền qua endpoint patch room (need backend support)
      // Sử dụng fetch trực tiếp để gọi endpoint transfer admin
      const { getAccessToken } = await import("../services/authService");
      const res = await fetch(`/api/v1/chat/rooms/${activeRoom._id}/transfer-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAccessToken()}`,
        },
        body: JSON.stringify({ newAdminId: targetUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Chuyển quyền thất bại.");
      }
      const json = await res.json();
      const refreshedRoom = json.data as ChatRoom;
      toast.success(`Đã chuyển quyền Trưởng nhóm cho ${targetName}.`);
      setActiveRoom(refreshedRoom);
      setRooms((prev) => prev.map((r) => (r._id === refreshedRoom._id ? refreshedRoom : r)));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Update member role (admin/member) - Group Admin only
  const handleUpdateMemberRole = async (userId: string, targetName: string, newRole: "admin" | "member") => {
    if (!activeRoom) return;
    const confirmMsg = newRole === "admin"
      ? `Thăng chức ${targetName} làm Quản trị viên nhóm?`
      : `Hạ chức Quản trị viên của ${targetName} xuống thành viên thường?`;
    if (!confirm(confirmMsg)) return;

    try {
      const updatedRoom = await internalChatService.updateMemberRole(activeRoom._id, userId, newRole);
      toast.success(`Đã cập nhật vai trò của ${targetName}.`);
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Pin message in room
  const handlePinMessage = async (messageId: string) => {
    if (!activeRoom) return;
    try {
      const updatedRoom = await internalChatService.pinMessage(activeRoom._id, messageId);
      toast.success("Đã ghim tin nhắn.");
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
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
      setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
      setCurrentPinnedIndex(0);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Thu hồi / Xóa tin nhắn
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoom) return;
    if (!confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này không?")) return;

    try {
      const deletedMessage = await internalChatService.deleteMessage(activeRoom._id, messageId);
      toast.success("Đã thu hồi tin nhắn.");
      setMessages((prev) => prev.map((m) => (m._id === messageId ? deletedMessage : m)));
    } catch (error: any) {
      toast.error(error.message);
    }
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

  // Start voice recording
  const startRecording = async () => {
    if (!activeRoom) return;
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
    } catch {
      toast.error("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.");
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
    if (room.isGroup) return room.name || "Nhóm trò chuyện";

    // Find the other member in private chat
    const otherMember = room.members.find(
      (m) => m.userId && (m.userId._id || m.userId.uid || m.userId) !== currentUserId
    );
    return otherMember?.userId?.displayName || "Tài khoản vô danh";
  };

  // Format Room display Avatar
  const getRoomAvatar = (room: ChatRoom) => {
    if (room.isGroup) return room.avatarURL || "";

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

  return (
    <div className="flex h-full w-full overflow-hidden rounded-3xl border border-gray-100 bg-white/70 shadow-2xl shadow-slate-100 backdrop-blur-xl" id="chat_tab_root">

      {/* LEFT SIDEBAR: Conversations & Search */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-100 bg-white/30" id="chat_sidebar">

        {/* Search & Plus header */}
        <div className="p-4 border-b border-gray-100/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Hội thoại
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const next = !soundMuted;
                  setSoundMuted(next);
                  localStorage.setItem(CHAT_SOUND_MUTED_KEY, next ? "1" : "0");
                  if (!next) playChatNotificationSound(); // nghe thử khi bật lại
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition active:scale-95 ${soundMuted ? "bg-slate-100 text-slate-400 hover:bg-slate-200" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
                title={soundMuted ? "Bật âm báo tin nhắn" : "Tắt âm báo tin nhắn"}
              >
                {soundMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
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
              <p className="px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-400">Kết quả tìm nhân viên</p>
              {filteredCompanyUsers.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-gray-500">Không tìm thấy nhân sự phù hợp</p>
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
                        {roomAvatar ? (
                          <img src={roomAvatar} alt={roomName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-slate-600">
                            {room.isGroup ? <Users className="h-5 w-5 text-slate-500" /> : roomName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {!room.isGroup && onlineStatus && (
                          <div className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${onlineStatus === "online" ? "bg-emerald-500" : "bg-slate-300"}`} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`truncate text-sm font-semibold ${hasUnread ? "text-slate-900 font-bold" : "text-slate-700"}`}>{roomName}</p>
                          {room.lastMessage && (
                            <span className="text-[10px] text-gray-400">
                              {new Date(room.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Last message / Typing indicator */}
                        {typingMembers.length > 0 ? (
                          <p className="truncate text-xs font-medium text-emerald-600 animate-pulse">
                            {typingMembers.join(", ")} đang nhập...
                          </p>
                        ) : (
                          <p className={`truncate text-xs ${hasUnread ? "text-slate-900 font-semibold" : "text-gray-400"}`}>
                            {room.lastMessage ? (
                              <>
                                {room.lastMessage.senderId === currentUserId ? "Bạn: " : `${room.lastMessage.senderName}: `}
                                {room.lastMessage.content || (room.lastMessage.attachments && room.lastMessage.attachments.length > 0 ? "📎 Tệp đính kèm" : "")}
                              </>
                            ) : (
                              "Chưa có tin nhắn nào"
                            )}
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
      <div className="flex flex-1 flex-col bg-gradient-to-b from-indigo-50/15 via-slate-50/40 to-violet-50/10 relative" id="chat_box_area">
        {activeRoom ? (
          <>
            {/* CHAT HEADER */}
            <div className="flex h-[72px] items-center justify-between border-b border-gray-100 bg-white/50 px-6 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 rounded-xl bg-slate-100 overflow-hidden border border-gray-200">
                  {getRoomAvatar(activeRoom) ? (
                    <img src={getRoomAvatar(activeRoom)} alt={getRoomName(activeRoom)} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-bold text-slate-600">
                      {activeRoom.isGroup ? <Users className="h-5 w-5 text-slate-500" /> : getRoomName(activeRoom).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {!activeRoom.isGroup && getOtherUserStatus(activeRoom) === "online" && (
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{getRoomName(activeRoom)}</h3>
                  <p className="text-[10px] text-gray-400">
                    {activeRoom.isGroup ? `${activeRoom.members.length} thành viên` : getOtherUserStatus(activeRoom) === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
              const contentText = isObject ? (pinnedMsg as any).content || "[Đính kèm]" : "Nội dung tin nhắn";
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
                  className="flex-1 overflow-y-auto p-6"
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
                      const isMe = (msg.senderId._id || msg.senderId) === currentUserId;
                      const canPin = activeRoom && (!activeRoom.isGroup || isGroupAdmin());
                      const isPinned = activeRoom && (
                        activeRoom.pinnedMessageId === msg._id ||
                        (typeof activeRoom.pinnedMessageId === "object" && activeRoom.pinnedMessageId !== null && (activeRoom.pinnedMessageId as any)._id === msg._id)
                      );

                      // Hiển thị ngày nếu tin nhắn trước đó ở ngày khác
                      const showDateHeader =
                        index === 0 ||
                        new Date(msg.createdAt).toDateString() !==
                        new Date(messages[index - 1].createdAt).toDateString();

                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;

                      const isPrevSameSender = prevMsg &&
                        !showDateHeader &&
                        ((prevMsg.senderId._id || prevMsg.senderId) === (msg.senderId._id || msg.senderId)) &&
                        (Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 60 * 1000);

                      const isNextSameSender = nextMsg &&
                        (new Date(nextMsg.createdAt).toDateString() === new Date(msg.createdAt).toDateString()) &&
                        ((nextMsg.senderId._id || nextMsg.senderId) === (msg.senderId._id || msg.senderId)) &&
                        (Math.abs(new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 60 * 1000);

                      const showSenderName = !isMe && activeRoom.isGroup && !isPrevSameSender;
                      const showAvatar = !isMe && activeRoom.isGroup && !isNextSameSender;


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
                            {/* Member Avatar in Group Chat */}
                            {!isMe && activeRoom.isGroup && (
                              showAvatar ? (
                                <div className="h-8 w-8 rounded-lg bg-slate-200 overflow-hidden border border-gray-100 mt-1 shrink-0">
                                  {msg.senderPhoto ? (
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
                            <div className="max-w-[70%]">
                              {/* Sender Name in group */}
                              {showSenderName && (
                                <span className="text-[10px] font-semibold text-slate-500 ml-1 mb-1 block">
                                  {msg.senderName}
                                </span>
                              )}

                              {/* Bubble */}
                              <div
                                className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm transition-all duration-300 ${isMe
                                  ? "bg-gradient-to-br from-indigo-650 via-indigo-600 to-violet-600 text-white rounded-tr-none shadow-md shadow-indigo-100/40"
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
                                          <div key={idx} className={`rounded-xl overflow-hidden border ${isMe ? "border-indigo-500/30" : "border-slate-200"}`}>
                                            <audio
                                              controls
                                              src={file.url}
                                              className="w-full max-w-[280px] h-10"
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
                  <div className="absolute bottom-4 left-6 rounded-full bg-white/90 border border-gray-100 px-4 py-2 shadow-lg backdrop-blur-sm z-10 flex items-center gap-2">
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
                    className="absolute bottom-4 right-6 z-10 flex items-center gap-1.5 rounded-full bg-white/95 border border-slate-200 pl-2 pr-3 py-2 shadow-lg backdrop-blur-sm hover:bg-white transition active:scale-95"
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
                <div className="w-72 shrink-0 border-l border-gray-100 bg-white/60 overflow-y-auto flex flex-col justify-between" id="chat_details_panel">

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

                        {/* Chuyển quyền Trưởng nhóm */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            <Crown className="h-3 w-3 inline mr-1 text-amber-500" />
                            Chuyển quyền Trưởng nhóm
                          </label>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {activeRoom.members
                              .filter((m) => {
                                const mId = m.userId._id || m.userId.uid || m.userId;
                                return mId !== currentUserId && m.role !== "admin";
                              })
                              .map((member) => {
                                const memId = member.userId._id || member.userId.uid || member.userId;
                                return (
                                  <div key={memId} className="flex items-center justify-between rounded-xl p-2 hover:bg-amber-50/60 transition">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-7 w-7 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-slate-600">
                                        {member.userId.photoURL ? (
                                          <img src={member.userId.photoURL} alt={member.userId.displayName} className="h-full w-full object-cover" />
                                        ) : member.userId.displayName?.charAt(0).toUpperCase()}
                                      </div>
                                      <p className="text-xs font-semibold text-slate-700 truncate">{member.userId.displayName}</p>
                                    </div>
                                    <button
                                      onClick={() => handleTransferAdmin(memId, member.userId.displayName)}
                                      className="ml-1 shrink-0 flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-100 transition"
                                      title="Chuyển quyền Trưởng nhóm"
                                    >
                                      <Crown className="h-3 w-3" />
                                      Bổ nhiệm
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                          {activeRoom.members.filter((m) => {
                            const mId = m.userId._id || m.userId.uid || m.userId;
                            return mId !== currentUserId && m.role !== "admin";
                          }).length === 0 && (
                              <p className="text-xs text-center text-gray-400 py-3">Không có thành viên nào khác để chuyển quyền.</p>
                            )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ======================== INFO PANEL (default) ======================== */}
                        {/* Header info */}
                        <div className="flex flex-col items-center text-center pb-5 border-b border-gray-100">
                          <div className="relative h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden border border-gray-200 mb-3 shadow-md">
                            {getRoomAvatar(activeRoom) ? (
                              <img src={getRoomAvatar(activeRoom)} alt={getRoomName(activeRoom)} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center font-bold text-xl text-slate-600">
                                {activeRoom.isGroup ? <Users className="h-7 w-7 text-slate-500" /> : getRoomName(activeRoom).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 text-base">{getRoomName(activeRoom)}</h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {activeRoom.isGroup ? "Phòng chat nhóm" : "Phòng chat riêng 1-1"}
                          </p>
                        </div>

                        {/* Member list section */}
                        {activeRoom.isGroup && (
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
                                const isMemberAdmin = member.role === "admin";
                                const memId = member.userId._id || member.userId.uid || member.userId;
                                const isMemMe = memId === currentUserId;

                                return (
                                  <div key={memId} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 transition">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="relative h-8 w-8 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                                        {member.userId.photoURL ? (
                                          <img src={member.userId.photoURL} alt={member.userId.displayName} className="h-full w-full object-cover" />
                                        ) : (
                                          <div className="flex h-full w-full items-center justify-center font-bold text-xs text-slate-600">
                                            {member.userId.displayName?.charAt(0).toUpperCase()}
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 truncate">
                                          {member.userId.displayName} {isMemMe && "(Bạn)"}
                                        </p>
                                        <p className="text-[10px] text-gray-400 truncate">{member.userId.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {isMemberAdmin && (
                                        <span className="rounded-md bg-indigo-50 border border-indigo-100 px-1 py-0.5 text-[8px] font-bold text-indigo-600 uppercase">
                                          Admin
                                        </span>
                                      )}
                                      {isGroupAdmin() && !isMemMe && (
                                        <button
                                          onClick={() => handleUpdateMemberRole(memId, member.userId.displayName, isMemberAdmin ? "member" : "admin")}
                                          className={`p-1 transition rounded-lg ${isMemberAdmin ? "text-amber-600 hover:bg-amber-50" : "text-indigo-50 hover:text-indigo-100"}`}
                                          title={isMemberAdmin ? "Hạ cấp xuống Thành viên thường" : "Thăng cấp làm Quản trị viên nhóm"}
                                        >
                                          {isMemberAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5 text-slate-400 hover:text-indigo-600" />}
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
                <div className="w-80 shrink-0 border-l border-gray-100 bg-white/60 overflow-hidden flex flex-col" id="chat_search_panel">
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/80">
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
                                  {msg.content}
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
            <div className="border-t border-gray-100 bg-white/50 p-4 backdrop-blur-md">
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
                              {(u.displayName || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="truncate text-sm font-medium text-slate-700">{u.displayName}</span>
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
                  <div className="grid grid-cols-8 gap-2.5 max-h-48 overflow-y-auto pr-1">
                    {EMOJI_CATEGORIES[activeEmojiCategoryTab].emojis.map((emoji, i) => (
                      <button
                        key={`${emoji}-${i}`}
                        type="button"
                        onClick={() => handleSelectEmoji(emoji)}
                        className="text-2xl hover:scale-125 transition-transform duration-100 leading-none p-1 rounded-lg hover:bg-slate-50"
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
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || isRecording}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-450 hover:text-indigo-650 hover:bg-indigo-50 border border-slate-150/40 transition active:scale-95 disabled:opacity-50"
                  title="Đính kèm tài liệu, ảnh, video"
                >
                  {uploadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>

                {/* Sticker button */}
                <button
                  type="button"
                  onClick={() => setShowStickerPicker((p) => !p)}
                  disabled={isRecording}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition active:scale-95 disabled:opacity-50 ${showStickerPicker ? "bg-amber-50 text-amber-500 border-amber-200" : "bg-slate-50 text-slate-450 hover:text-amber-500 hover:bg-amber-50 border-slate-150/40"}`}
                  title="Chọn emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>

                {/* Recording UI or Normal Input */}
                {isRecording ? (
                  <div className="flex flex-1 items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2.5">
                    {/* Pulse indicator */}
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                    </span>
                    <span className="text-sm font-semibold text-rose-600 flex-1">
                      Đang ghi... {Math.floor(recordingSeconds / 60).toString().padStart(2, "0")}:{(recordingSeconds % 60).toString().padStart(2, "0")}
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

      {/* MODAL: CREATE GROUP CHAT */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
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
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
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
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-slate-900/40 backdrop-blur-xs text-white">
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
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
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

    </div>
  );
}
