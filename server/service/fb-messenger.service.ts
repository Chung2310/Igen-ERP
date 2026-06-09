import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { UserModel } from "../model/user.model";

export const fbMessengerService = {
  /**
   * Xác thực Webhook (GET request) từ Facebook gửi qua
   */
  async verifyWebhook(mode: string | undefined, token: string | undefined, challenge: string | undefined) {
    const verifyToken = process.env.FB_VERIFY_TOKEN || "igen_erp_fb_verify_2026";
    console.log(`[FB Service verifyWebhook] So sánh Verify Token nhận được: "${token}" với Token cấu hình hệ thống.`);

    if (mode === "subscribe") {
      if (token === verifyToken) {
        console.log("[FB Service verifyWebhook] Trùng khớp với Default Verify Token trong biến môi trường!");
        return challenge;
      }

      // Check if any user in DB has configured this verifyToken
      const user = await UserModel.findOne({
        "facebookIntegration.isConnected": true,
        "facebookIntegration.verifyToken": token
      });

      if (user) {
        console.log(`[FB Service verifyWebhook] Trùng khớp với Verify Token được cấu hình bởi user: ${user.email}`);
        return challenge;
      }
    }

    console.error(`[FB Service verifyWebhook] Không tìm thấy Verify Token khớp với "${token}". Xác thực thất bại.`);
    throw new Error("Mã xác minh không chính xác");
  },

  /**
   * Xử lý dữ liệu Webhook Event (POST request) từ Facebook gửi tới khi có tin nhắn mới
   */
  async handleWebhookEvent(body: any) {
    if (body.object !== "page") {
      console.warn(`[FB Service handleWebhookEvent] Nhận đối tượng webhook không phải page: "${body.object}"`);
      throw new Error("Sự kiện webhook không hợp lệ.");
    }

    const entries = body.entry || [];
    console.log(`[FB Service handleWebhookEvent] Bắt đầu phân tích ${entries.length} entries gửi từ Facebook.`);

    for (const entry of entries) {
      const messagingEvents = entry.messaging || [];
      console.log(`[FB Service handleWebhookEvent] Entry ID: ${entry.id} chứa ${messagingEvents.length} messaging events.`);

      for (const event of messagingEvents) {
        console.log(`[FB Service handleWebhookEvent] Đang xử lý event: sender=${event.sender?.id}, recipient=${event.recipient?.id}`);
        
        if (event.message && !event.message.is_echo) {
          console.log(`[FB Service handleWebhookEvent] Phát hiện tin nhắn mới (Inbound Message). Nội dung: "${event.message.text}"`);
          await this.processIncomingMessage(event);
        } else if (event.message && event.message.is_echo) {
          console.log(`[FB Service handleWebhookEvent] Bỏ qua tin nhắn dạng echo (phản hồi gửi đi từ fanpage/webhook khác).`);
        } else if (event.read) {
          console.log(`[FB Service handleWebhookEvent] Phát hiện sự kiện người dùng đã đọc (Read Receipt) từ khách hàng.`);
          await this.processReadReceipt(event);
        } else {
          console.log(`[FB Service handleWebhookEvent] Nhận được sự kiện khác (ví dụ: delivery, referral, postback,...). Bỏ qua.`);
        }
      }
    }
  },

  /**
   * Lấy Page Access Token của một User bất kỳ đang liên kết với Page ID này
   */
  async getPageAccessTokenByPageId(pageId: string): Promise<string | null> {
    console.log(`[FB Service Token] Đang tìm Access Token cho Page ID: ${pageId}`);
    
    const user = await UserModel.findOne({
      "facebookIntegration.isConnected": true,
      "facebookIntegration.pageId": pageId,
    });
    
    if (user && user.facebookIntegration?.pageAccessToken) {
      console.log(`[FB Service Token] Đã tìm thấy Page Access Token động từ tài khoản User: ${user.email}`);
      return user.facebookIntegration.pageAccessToken;
    }
    
    console.log(`[FB Service Token] Không tìm thấy config của user nào cho Page ID: ${pageId}. Fallback về biến môi trường FB_PAGE_ACCESS_TOKEN.`);
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

    console.log(`[FB Service processIncomingMessage] Bắt đầu xử lý tin nhắn. Khách: ${senderId} -> Page: ${recipientId}. Nội dung: "${text}"`);

    // Lấy token động từ DB dựa theo Page ID của tin nhắn đến
    const token = await this.getPageAccessTokenByPageId(recipientId);

    // 1. Kiểm tra xem đã có cuộc hội thoại với khách hàng này chưa
    let conversation = await FBConversationModel.findOne({ recipientId: senderId, pageId: recipientId });

    if (!conversation) {
      let senderName = "Khách hàng Facebook";
      let avatarUrl = "";

      if (token) {
        try {
          console.log(`[FB Service processIncomingMessage] Đang gọi Graph API lấy profile cho khách hàng PSID: ${senderId}`);
          const profile = await this.getSenderProfile(senderId, token);
          if (profile) {
            senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Khách hàng Facebook";
            avatarUrl = profile.profile_pic || "";
            console.log(`[FB Service processIncomingMessage] Lấy thành công thông tin khách hàng từ Facebook: Name="${senderName}", Avatar="${avatarUrl}"`);
          } else {
            console.warn(`[FB Service processIncomingMessage] Graph API trả về rỗng cho PSID: ${senderId}. Dùng thông tin mặc định.`);
          }
        } catch (err) {
          console.error("[FB Service processIncomingMessage] Thất bại khi lấy thông tin profile từ Graph API:", err);
        }
      } else {
        console.warn("[FB Service processIncomingMessage] Không có Access Token hợp lệ để gọi Profile Graph API.");
      }

      console.log(`[FB Service processIncomingMessage] Tạo cuộc hội thoại mới trong Database cho PSID ${senderId}`);
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
      console.log(`[FB Service processIncomingMessage] Đã tồn tại cuộc hội thoại với PSID ${senderId}. Cập nhật tin nhắn mới nhất.`);
      conversation.lastMessageText = text || "[Đính kèm]";
      conversation.lastMessageAt = timestamp;
      conversation.unreadCount += 1;
      conversation.status = "open";
      await conversation.save();
    }

    // 2. Lưu tin nhắn chi tiết vào DB
    const existingMsg = await FBMessageModel.findOne({ messageId });
    if (!existingMsg) {
      console.log(`[FB Service processIncomingMessage] Lưu chi tiết tin nhắn mới vào DB. ID tin nhắn: ${messageId}`);
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
      console.log(`[FB Service processIncomingMessage] Lưu tin nhắn thành công.`);
    } else {
      console.log(`[FB Service processIncomingMessage] Bỏ qua lưu tin nhắn vì ID tin nhắn ${messageId} đã tồn tại trong DB.`);
    }
  },

  /**
   * Cập nhật trạng thái đã đọc của tin nhắn
   */
  async processReadReceipt(event: any) {
    const senderId = event.sender.id;
    const pageId = event.recipient?.id;
    console.log(`[FB Service processReadReceipt] Cập nhật số tin nhắn chưa đọc về 0 cho khách hàng PSID: ${senderId}`);
    await FBConversationModel.findOneAndUpdate(
      pageId ? { recipientId: senderId, pageId } : { recipientId: senderId },
      { unreadCount: 0 }
    );
  },

  /**
   * Gọi Graph API lấy Profile từ PSID bằng Token động
   */
  async getSenderProfile(psid: string, token: string): Promise<any> {
    const url = `https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${token}`;
    console.log(`[FB Service GraphAPI] Gọi request tới URL: https://graph.facebook.com/${psid}?fields=first_name,last_name...`);
    try {
      const response = await (globalThis as any).fetch(url);
      if (!response.ok) {
        const errText = await response.text();
        console.error(`[FB Service GraphAPI] Lỗi phản hồi từ Graph API: ${response.status} - ${errText}`);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("[FB Service GraphAPI] Lỗi kết nối Graph API:", error);
      return null;
    }
  },

  /**
   * Gửi tin nhắn phản hồi tới khách hàng qua Facebook Send API (sử dụng Token của Page tương ứng)
   */
  async sendReply(pageId: string, recipientPsid: string, text: string) {
    console.log(`[FB Service sendReply] Khởi tạo quá trình gửi tin nhắn trả lời tới PSID ${recipientPsid}`);

    // Tìm cuộc hội thoại để xác định Page ID tương ứng của khách hàng
    let conversation = await FBConversationModel.findOne({ recipientId: recipientPsid, pageId });
    const resolvedPageId = conversation?.pageId || pageId || process.env.FB_PAGE_ID || "";
    
    // Lấy token động của Page này từ DB
    const token = await this.getPageAccessTokenByPageId(resolvedPageId);
    
    if (!token) {
      console.error(`[FB Service sendReply] Lỗi: Không thể tìm thấy Access Token cấu hình cho Page ID: ${resolvedPageId}`);
      throw new Error(`Không tìm thấy Access Token cấu hình cho Page ID: ${resolvedPageId}`);
    }

    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`;
    
    const body = {
      recipient: { id: recipientPsid },
      message: { text },
      messaging_type: "RESPONSE"
    };

    try {
      console.log(`[FB Service sendReply] Đang gọi Facebook Send API...`);
      const response = await (globalThis as any).fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const textErr = await response.text();
        console.error(`[FB Service sendReply] Send API phản hồi lỗi: ${response.status} - ${textErr}`);
        throw new Error(`Facebook Send API phản hồi lỗi: ${response.status} - ${textErr}`);
      }

      const data = await response.json();
      console.log(`[FB Service sendReply] Send API phản hồi thành công:`, JSON.stringify(data));

      // Cập nhật conversation
      if (conversation) {
        console.log(`[FB Service sendReply] Cập nhật thông tin tin nhắn cuối cùng trong cuộc hội thoại.`);
        conversation.lastMessageText = text;
        conversation.lastMessageAt = new Date();
        conversation.unreadCount = 0;
        await conversation.save();
      } else {
        console.log(`[FB Service sendReply] Chưa có conversation cho PSID ${recipientPsid}. Tạo mới để đồng bộ lịch sử chat.`);
        conversation = new FBConversationModel({
          recipientId: recipientPsid,
          senderName: "Khách hàng Facebook",
          avatarUrl: "",
          pageId: resolvedPageId,
          lastMessageText: text,
          lastMessageAt: new Date(),
          unreadCount: 0,
          status: "open",
        });
        await conversation.save();
      }

      // Lưu tin nhắn gửi đi vào DB
      console.log(`[FB Service sendReply] Tiến hành lưu tin nhắn outbound vào cơ sở dữ liệu.`);
      const newMsg = new FBMessageModel({
        conversationId: conversation?._id,
        senderId: resolvedPageId,
        recipientId: recipientPsid,
        direction: "outbound",
        text,
        attachments: [],
        messageId: data.message_id || `out_${Date.now()}`,
        timestamp: new Date(),
        status: "sent",
      });
      await newMsg.save();
      console.log(`[FB Service sendReply] Lưu tin nhắn outbound thành công.`);

      return {
        status: "success",
        messageId: newMsg.messageId,
      };
    } catch (error: any) {
      console.error("[FB Service sendReply] Thất bại khi gửi hoặc lưu phản hồi:", error);
      throw new Error(`Gửi tin nhắn thất bại: ${error.message}`);
    }
  },

  /**
   * Lấy danh sách cuộc hội thoại thuộc Page mà người dùng hiện tại có quyền truy cập
   */
  async getConversations(pageId?: string) {
    console.log(`[FB Service getConversations] Lọc hội thoại theo Page ID: ${pageId || "Tất cả"}`);
    const filter = pageId ? { pageId } : {};
    return FBConversationModel.find(filter).sort({ lastMessageAt: -1 });
  },

  /**
   * Lấy lịch sử tin nhắn của cuộc hội thoại
   */
  async getMessages(pageId: string, recipientId: string) {
    console.log(`[FB Service getMessages] Lấy tin nhắn cho cuộc hội thoại của khách hàng PSID: ${recipientId} thuộc Page ID: ${pageId}`);
    const conversation = await FBConversationModel.findOne({ recipientId, pageId });
    if (!conversation) {
      console.warn(`[FB Service getMessages] Không tìm thấy cuộc hội thoại cho khách hàng PSID: ${recipientId} thuộc Page ID: ${pageId}. Trả về mảng tin nhắn rỗng.`);
      return [];
    }

    return FBMessageModel.find({ conversationId: conversation._id }).sort({ timestamp: 1 });
  }
};
