import { getAccessToken } from "./authService";

export const zaloMessengerService = {
  /**
   * Lấy danh sách cuộc hội thoại của Zalo OA đã liên kết
   */
  async getConversations(): Promise<any[]> {
    console.log("[FE Zalo Service] Bắt đầu gọi API getConversations...");
    const res = await fetch("/api/v1/zalo/conversations", {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[FE Zalo Service] API getConversations thất bại:", res.status, data);
      throw new Error(data.message || "Không thể tải danh sách cuộc hội thoại Zalo.");
    }
    
    const result = await res.json();
    console.log(`[FE Zalo Service] API getConversations thành công. Số lượng: ${result.data?.length || 0}`);
    return result.data || [];
  },

  /**
   * Lấy lịch sử tin nhắn của một cuộc hội thoại cụ thể
   */
  async getMessages(recipientId: string, options?: { limit?: number; before?: string }): Promise<{ data: any[]; pagination: { limit: number; hasMore: boolean; nextBefore: string | null } }> {
    const params = new URLSearchParams();
    params.set("limit", String(options?.limit || 20));
    if (options?.before) {
      params.set("before", options.before);
    }
    console.log(`[FE Zalo Service] Bắt đầu gọi API getMessages cho khách hàng ID: ${recipientId}...`);
    const res = await fetch(`/api/v1/zalo/conversations/${recipientId}/messages?${params.toString()}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[FE Zalo Service] API getMessages cho ID ${recipientId} thất bại:`, res.status, data);
      throw new Error(data.message || "Không thể tải lịch sử tin nhắn Zalo.");
    }
    
    const result = await res.json();
    console.log(`[FE Zalo Service] API getMessages cho ID ${recipientId} thành công. Số lượng: ${result.data?.length || 0}`);
    return {
      data: result.data || [],
      pagination: result.pagination || { limit: options?.limit || 20, hasMore: false, nextBefore: null }
    };
  },

  /**
   * Gửi phản hồi tin nhắn cho khách hàng qua Zalo OA
   */
  async sendReply(recipientId: string, text: string): Promise<any> {
    console.log(`[FE Zalo Service] Bắt đầu gọi API sendReply tới ID ${recipientId}. Nội dung: "${text}"`);
    const res = await fetch("/api/v1/zalo/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ recipientId, text }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`[FE Zalo Service] API sendReply tới ID ${recipientId} thất bại:`, res.status, data);
      throw new Error(data.message || "Gửi tin nhắn Zalo thất bại.");
    }
    
    const result = await res.json();
    console.log(`[FE Zalo Service] API sendReply tới ID ${recipientId} thành công.`, result);
    return result.data;
  },

  /**
   * Lưu thông tin cấu hình Zalo OA (Thủ công hoặc Demo)
   */
  async saveIntegration(integrationData: { oaId: string; oaName: string; accessToken: string; refreshToken?: string; isMock?: boolean }): Promise<any> {
    console.log("[FE Zalo Service] Gọi API lưu cấu hình Zalo...");
    const res = await fetch("/api/v1/zalo/save-integration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(integrationData),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể lưu thông tin cấu hình Zalo OA.");
    }

    const result = await res.json();
    return result.data;
  },

  /**
   * Gửi yêu cầu gỡ bỏ cấu hình Zalo OA
   */
  async removeIntegration(): Promise<void> {
    console.log("[FE Zalo Service] Gọi API gỡ cấu hình Zalo...");
    const res = await fetch("/api/v1/zalo/integration", {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "Không thể gỡ bỏ cấu hình Zalo OA.");
    }
  }
};
