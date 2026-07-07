import { getAccessToken } from "./authService";

export interface ChatAttachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: string | { _id: string; displayName: string; photoURL?: string; email: string };
  senderName: string;
  senderPhoto?: string;
  content: string;
  attachments?: ChatAttachment[];
  readBy: string[];
  reactions?: { emoji: string; userId: string }[];
  replyTo?: any;
  isDeleted?: boolean;
  editedAt?: string | null;
  createdAt: string;
}

export interface ChatRoomMember {
  userId: {
    _id: string;
    uid: string;
    displayName: string;
    photoURL?: string;
    email: string;
    role: string;
    status?: "online" | "offline";
  };
  role: "admin" | "deputy" | "member";
  joinedAt: string;
}

export interface ChatRoom {
  _id: string;
  name?: string;
  isGroup: boolean;
  companyCode: string;
  creatorId: string;
  members: ChatRoomMember[];
  lastMessage?: ChatMessage;
  avatarURL?: string;
  pinnedMessageIds?: (string | ChatMessage)[];
  unreadCount?: number;
  onlyAdminsCanMessage?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const internalChatService = {
  /**
   * Lấy danh sách các phòng chat
   */
  async getRooms(): Promise<ChatRoom[]> {
    const res = await fetch("/api/v1/chat/rooms", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tải danh sách cuộc trò chuyện.");
    }

    const json = await res.json();
    return json.data || [];
  },

  /**
   * Lấy thông tin phòng chat theo ID
   */
  async getRoomById(roomId: string): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tải thông tin phòng trò chuyện.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Tạo phòng chat mới (1-1 hoặc Nhóm)
   */
  async createRoom(payload: {
    isGroup: boolean;
    memberIds: string[];
    name?: string;
    avatarURL?: string;
  }): Promise<ChatRoom> {
    const res = await fetch("/api/v1/chat/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tạo cuộc trò chuyện mới.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Cập nhật thông tin phòng chat nhóm
   */
  async updateRoom(roomId: string, updateData: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean }): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(updateData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật thông tin phòng thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Thêm thành viên vào nhóm
   */
  async addMembers(roomId: string, memberIds: string[]): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ memberIds }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Thêm thành viên vào nhóm thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Xóa thành viên khỏi nhóm (Chỉ Admin)
   */
  async removeMember(roomId: string, userId: string): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/members/${userId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Xóa thành viên khỏi nhóm thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Rời khỏi nhóm
   */
  async leaveRoom(roomId: string): Promise<void> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/leave`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Rời khỏi nhóm thất bại.");
    }
  },

  /**
   * Giải tán nhóm (Chỉ Admin)
   */
  async deleteRoom(roomId: string): Promise<void> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Giải tán nhóm thất bại.");
    }
  },

  /**
   * Lấy lịch sử tin nhắn trong phòng (Phân trang)
   */
  async getMessages(roomId: string, limit: number = 50, beforeDate?: string): Promise<ChatMessage[]> {
    let url = `/api/v1/chat/rooms/${roomId}/messages?limit=${limit}`;
    if (beforeDate) {
      url += `&beforeDate=${encodeURIComponent(beforeDate)}`;
    }

    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể tải lịch sử tin nhắn.");
    }

    const json = await res.json();
    return json.data || [];
  },

  /**
   * Gửi tin nhắn mới
   */
  async sendMessage(roomId: string, content: string, attachments?: ChatAttachment[], replyTo?: string): Promise<ChatMessage> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ content, attachments, replyTo }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể gửi tin nhắn.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Đánh dấu các tin nhắn trong phòng đã đọc
   */
  async markAsRead(roomId: string): Promise<void> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/read`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      console.warn("Lỗi khi đánh dấu đã đọc tin nhắn trên server.");
    }
  },

  /**
   * Upload tệp đính kèm lên Cloudinary qua Backend Relay API
   */
  async uploadAttachment(file: File): Promise<ChatAttachment> {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

    const response = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: base64Data,
        folder: "igen_erp/chat_attachments",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Lỗi tải tệp: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      url: data.url,
      name: file.name,
      type: file.type,
      size: file.size,
    };
  },

  /**
   * Cập nhật vai trò thành viên nhóm (Chỉ Admin)
   */
  async updateMemberRole(roomId: string, userId: string, role: "admin" | "deputy" | "member"): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/members/${userId}/role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Cập nhật vai trò thành viên thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Ghim tin nhắn
   */
  async pinMessage(roomId: string, messageId: string): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ messageId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Ghim tin nhắn thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  async unpinMessage(roomId: string, messageId: string): Promise<ChatRoom> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/unpin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ messageId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Bỏ ghim tin nhắn thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Thu hồi / Xóa tin nhắn (Mềm)
   */
  async deleteMessage(roomId: string, messageId: string): Promise<ChatMessage> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Thu hồi tin nhắn thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Lấy thông tin xem trước (OG metadata) của một liên kết.
   */
  async getLinkPreview(url: string): Promise<LinkPreview> {
    const res = await fetch(`/api/v1/chat/link-preview?url=${encodeURIComponent(url)}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không lấy được xem trước liên kết.");
    }
    const json = await res.json();
    return json.data as LinkPreview;
  },

  /**
   * Sửa nội dung tin nhắn (chỉ người gửi).
   */
  async editMessage(roomId: string, messageId: string, content: string): Promise<ChatMessage> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Sửa tin nhắn thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Bật/tắt reaction emoji trên một tin nhắn.
   */
  async reactToMessage(roomId: string, messageId: string, emoji: string): Promise<ChatMessage> {
    const res = await fetch(`/api/v1/chat/rooms/${roomId}/messages/${messageId}/react`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ emoji }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Thả cảm xúc thất bại.");
    }

    const json = await res.json();
    return json.data;
  },

  /**
   * Tìm kiếm tin nhắn, liên kết, tệp tin hoặc hình ảnh/video trong phòng chat
   */
  async searchMessages(roomId: string, query: string, type: "text" | "link" | "file" | "media" | "all" = "all"): Promise<ChatMessage[]> {
    let url = `/api/v1/chat/rooms/${roomId}/search?type=${type}`;
    if (query) {
      url += `&query=${encodeURIComponent(query)}`;
    }

    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể thực hiện tìm kiếm tin nhắn.");
    }

    const json = await res.json();
    return json.data || [];
  },
};
