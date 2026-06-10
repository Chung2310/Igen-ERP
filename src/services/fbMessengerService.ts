import { getAccessToken } from "./authService";

export const fbMessengerService = {
  /**
   * Lấy danh sách cuộc hội thoại của Page Facebook đã liên kết
   */
  async getConversations(options?: { sync?: boolean }): Promise<any[]> {
    console.log("[FE FB Service] Bắt đầu gọi API getConversations...");
    const params = new URLSearchParams();
    if (options?.sync) {
      params.set("sync", "1");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/v1/facebook/messenger/conversations${query}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[FE FB Service] API getConversations thất bại:", res.status, data);
      throw new Error(data.message || "Không thể tải danh sách cuộc hội thoại.");
    }
    
    const result = await res.json();
    console.log(`[FE FB Service] API getConversations thành công. Số lượng hội thoại: ${result.data?.length || 0}`);
    return result.data || [];
  },

  /**
   * Lấy lịch sử tin nhắn của một cuộc hội thoại cụ thể
   */
  async getMessages(recipientId: string, options?: { limit?: number; before?: string; sync?: boolean }): Promise<{ data: any[]; pagination: { limit: number; hasMore: boolean; nextBefore: string | null } }> {
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit || 20));
    if (options?.before) {
      params.set("before", options.before);
    }
    if (options?.sync) {
      params.set("sync", "1");
    }
    console.log(`[FE FB Service] Bắt đầu gọi API getMessages cho khách hàng PSID: ${recipientId}...`);
    const res = await fetch(`/api/v1/facebook/messenger/conversations/${recipientId}/messages?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[FE FB Service] API getMessages cho PSID ${recipientId} thất bại:`, res.status, data);
      throw new Error(data.message || "Không thể tải lịch sử tin nhắn.");
    }
    
    const result = await res.json();
    console.log(`[FE FB Service] API getMessages cho PSID ${recipientId} thành công. Số lượng tin nhắn: ${result.data?.length || 0}`);
    return {
      data: result.data || [],
      pagination: result.pagination || { limit: options?.limit || 20, hasMore: false, nextBefore: null }
    };
  },

  /**
   * Gửi phản hồi tin nhắn cho khách hàng qua Facebook Send API
   */
  async markRead(recipientId: string): Promise<any> {
    console.log(`[FE FB Service] Báº¯t Ä‘áº§u gá»i API markRead cho PSID: ${recipientId}...`);
    const res = await fetch(`/api/v1/facebook/messenger/conversations/${recipientId}/mark-read`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[FE FB Service] API markRead cho PSID ${recipientId} tháº¥t báº¡i:`, res.status, data);
      throw new Error(data.message || "KhÃ´ng thá»ƒ Ä‘Ã¡nh dáº¥u Ä‘Ã£ Ä‘á»c cuá»™c há»™i thoáº¡i.");
    }

    const result = await res.json();
    return result.data;
  },

  async sendReply(recipientId: string, text: string): Promise<any> {
    console.log(`[FE FB Service] Bắt đầu gọi API sendReply tới PSID ${recipientId}. Nội dung: "${text}"`);
    const res = await fetch("/api/v1/facebook/messenger/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ recipientId, text }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[FE FB Service] API sendReply tới PSID ${recipientId} thất bại:`, res.status, data);
      throw new Error(data.message || "Gửi tin nhắn thất bại.");
    }
    
    const result = await res.json();
    console.log(`[FE FB Service] API sendReply tới PSID ${recipientId} thành công. Kết quả:`, result);
    return result.data;
  }
};
