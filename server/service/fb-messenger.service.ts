import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { UserModel } from "../model/user.model";

export const fbMessengerService = {
  /**
   * Xác thực Webhook (GET request) từ Facebook gửi qua
   */
  verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined) {
    const verifyToken = process.env.FB_VERIFY_TOKEN || "igen_erp_fb_verify_2026";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("[Facebook Webhook] Xác thực Webhook thành công!");
      return challenge;
    } else {
      console.error("[Facebook Webhook] Xác thực thất bại. Verify Token không khớp.");
      throw new Error("Mã xác minh không chính xác");
    }
  },

  /**
   * Xử lý dữ liệu Webhook Event (POST request) từ Facebook gửi tới khi có tin nhắn mới
   */
  async handleWebhookEvent(body: any) {
    if (body.object !== "page") {
      throw new Error("Sự kiện webhook không hợp lệ.");
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];
      for (const event of messagingEvents) {
        if (event.message && !event.message.is_echo) {
          await this.processIncomingMessage(event);
        } else if (event.read) {
          await this.processReadReceipt(event);
        }
      }
    }
  },

  /**
   * Lấy Page Access Token của một User bất kỳ đang liên kết với Page ID này
   */
  async getPageAccessTokenByPageId(pageId: string): Promise<string | null> {
    const user = await UserModel.findOne({
      "facebookIntegration.isConnected": true,
      "facebookIntegration.pageId": pageId,
    });
    
    if (user && user.facebookIntegration?.pageAccessToken) {
      return user.facebookIntegration.pageAccessToken;
    }
    
    // Fallback về biến môi trường nếu không tìm thấy cấu hình user
    return process.env.FB_PAGE_ACCESS_TOKEN || null;
  },

  /**
   * Lưu tin nhắn đến vào DB và tạo cuộc hội thoại nếu chưa có
   */
  async processIncomingMessage(event: any) {
    const senderId = event.sender.id; // PSID của khách hàng
    const recipientId = event.recipient.id; // ID của Fanpage mình (pageId)
    const message = event.message;
    const messageId = message.mid;
    const timestamp = new Date(event.timestamp);

    const text = message.text || "";
    const attachments = (message.attachments || []).map((att: any) => ({
      type: att.type,
      url: att.payload?.url || "",
    }));

    console.log(`[Facebook Webhook] Nhận tin nhắn mới từ khách hàng ${senderId} gửi tới Page ${recipientId}: ${text}`);

    // Lấy token động từ DB dựa theo Page ID của tin nhắn đến
    const token = await this.getPageAccessTokenByPageId(recipientId);

    // 1. Kiểm tra xem đã có cuộc hội thoại với khách hàng này chưa
    let conversation = await FBConversationModel.findOne({ recipientId: senderId, pageId: recipientId });

    if (!conversation) {
      let senderName = "Khách hàng Facebook";
      let avatarUrl = "";

      if (token) {
        try {
          const profile = await this.getSenderProfile(senderId, token);
          if (profile) {
            senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Khách hàng Facebook";
            avatarUrl = profile.profile_pic || "";
          }
        } catch (err) {
          console.error("[Facebook Webhook] Không thể lấy profile khách hàng:", err);
        }
      }

      conversation = new FBConversationModel({
        recipientId: senderId,
        senderName,
        avatarUrl,
        pageId: recipientId,
        lastMessageText: text || "[Đính kèm]",
        lastMessageAt: timestamp,
        unreadCount: 1,
        status: "open",
      });
      await conversation.save();
    } else {
      conversation.lastMessageText = text || "[Đính kèm]";
      conversation.lastMessageAt = timestamp;
      conversation.unreadCount += 1;
      conversation.status = "open";
      await conversation.save();
    }

    // 2. Lưu tin nhắn chi tiết vào DB
    const existingMsg = await FBMessageModel.findOne({ messageId });
    if (!existingMsg) {
      const newMsg = new FBMessageModel({
        conversationId: conversation._id,
        senderId,
        recipientId,
        direction: "inbound",
        text,
        attachments,
        messageId,
        timestamp,
        status: "delivered",
      });
      await newMsg.save();
    }
  },

  /**
   * Cập nhật trạng thái đã đọc của tin nhắn
   */
  async processReadReceipt(event: any) {
    const senderId = event.sender.id;
    await FBConversationModel.findOneAndUpdate(
      { recipientId: senderId },
      { unreadCount: 0 }
    );
  },

  /**
   * Gọi Graph API lấy Profile từ PSID bằng Token động
   */
  async getSenderProfile(psid: string, token: string): Promise<any> {
    const url = `https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${token}`;
    try {
      const response = await (globalThis as any).fetch(url);
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Facebook Service] Graph API Error: ${response.status} - ${errText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("[Facebook Service] Lỗi kết nối Graph API:", error);
      return null;
    }
  },

  /**
   * Gửi tin nhắn phản hồi tới khách hàng qua Facebook Send API (sử dụng Token của Page tương ứng)
   */
  async sendReply(recipientPsid: string, text: string) {
    // Tìm cuộc hội thoại để xác định Page ID tương ứng của khách hàng
    const conversation = await FBConversationModel.findOne({ recipientId: recipientPsid });
    const pageId = conversation?.pageId || process.env.FB_PAGE_ID || "";
    
    // Lấy token động của Page này từ DB
    const token = await this.getPageAccessTokenByPageId(pageId);
    
    if (!token) {
      throw new Error(`Không tìm thấy Access Token cấu hình cho Page ID: ${pageId}`);
    }

    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
    
    const body = {
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: "RESPONSE"
    };

    try {
      const response = await (globalThis as any).fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const textErr = await response.text();
        throw new Error(`Facebook Send API phản hồi lỗi: ${response.status} - ${textErr}`);
      }

      const data = await response.json();

      // Cập nhật conversation
      if (conversation) {
        conversation.lastMessageText = text;
        conversation.lastMessageAt = new Date();
        conversation.unreadCount = 0;
        await conversation.save();
      }

      // Lưu tin nhắn gửi đi
      const newMsg = new FBMessageModel({
        conversationId: conversation?._id,
        senderId: pageId,
        recipientId: recipientPsid,
        direction: "outbound",
        text,
        attachments: [],
        messageId: data.message_id || `out_${Date.now()}`,
        timestamp: new Date(),
        status: "sent",
      });
      await newMsg.save();

      return {
        status: "success",
        messageId: newMsg.messageId,
      };
    } catch (error: any) {
      console.error("[Facebook Service] Lỗi khi gửi tin nhắn phản hồi:", error);
      throw new Error(`Gửi tin nhắn thất bại: ${error.message}`);
    }
  },

  /**
   * Lấy danh sách cuộc hội thoại thuộc Page mà người dùng hiện tại có quyền truy cập
   */
  async getConversations(pageId?: string) {
    const filter = pageId ? { pageId } : {};
    return FBConversationModel.find(filter).sort({ lastMessageAt: -1 });
  },

  /**
   * Lấy lịch sử tin nhắn của cuộc hội thoại
   */
  async getMessages(recipientId: string) {
    const conversation = await FBConversationModel.findOne({ recipientId });
    if (!conversation) return [];

    return FBMessageModel.find({ conversationId: conversation._id }).sort({ timestamp: 1 });
  }
};
