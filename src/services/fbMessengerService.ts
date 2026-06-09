import { getAccessToken } from "./authService";

export const fbMessengerService = {
  /**
   * Lấy danh sách cuộc hội thoại của Page Facebook đã liên kết
   */
  async getConversations(): Promise<any[]> {
    console.log("[FE FB Service] Bắt đầu gọi API getConversations...");
    const res = await fetch("/api/v1/facebook/messenger/conversations", {
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
  async getMessages(recipientId: string): Promise<any[]> {
    console.log(`[FE FB Service] Bắt đầu gọi API getMessages cho khách hàng PSID: ${recipientId}...`);
    const res = await fetch(`/api/v1/facebook/messenger/conversations/${recipientId}/messages`, {
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
    return result.data || [];
  },

  /**
   * Gửi phản hồi tin nhắn cho khách hàng qua Facebook Send API
   */
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
