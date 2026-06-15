import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { UserModel } from "../model/user.model";
import { emitToPage } from "../socket";
import { aiAutoReplyService } from "./ai-auto-reply.service";

const syncTimestamps = new Map<string, number>();

export const zaloMessengerService = {
  shouldSync(key: string, ttlMs: number) {
    const now = Date.now();
    const lastRun = syncTimestamps.get(key) || 0;
    if (now - lastRun < ttlMs) {
      return false;
    }
    syncTimestamps.set(key, now);
    return true;
  },

  /**
   * Đổi Authorization Code lấy Access Token & Refresh Token lần đầu
   */
  async exchangeAuthCode(userId: string, oaId: string, oaName: string, appId: string, appSecret: string, authCode: string) {
    console.log(`[Zalo Service OAuth] Đổi auth_code cho OA: ${oaName} (${oaId}), App ID: ${appId}`);

    const url = "https://oauth.zaloapp.com/v4/oa/access_token";
    const bodyParams = new URLSearchParams();
    bodyParams.set("code", authCode);
    bodyParams.set("app_id", appId);
    bodyParams.set("grant_type", "authorization_code");

    try {
      const response = await (globalThis as any).fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "secret_key": appSecret,
        },
        body: bodyParams.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Zalo OAuth API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(`Zalo OAuth Error: ${data.error_name || data.error} - ${data.error_description}`);
      }

      const accessToken = data.access_token;
      const refreshToken = data.refresh_token;
      const expiresInSeconds = Number(data.expires_in) || 90000; // Mặc định 25 giờ
      const tokenExpiredAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Cấu hình lưu trữ
      const zaloIntegration = {
        isConnected: true,
        oaId,
        oaName,
        accessToken,
        refreshToken,
        tokenExpiredAt,
        connectedAt: new Date(),
        isMock: false
      };

      await UserModel.findByIdAndUpdate(userId, { zaloIntegration });
      return zaloIntegration;
    } catch (error: any) {
      console.error("[Zalo Service OAuth] Lỗi đổi auth_code:", error);
      throw error;
    }
  },

  /**
   * Lưu cấu hình Zalo tự chế (Không qua Popup OAuth phức tạp)
   */
  async saveIntegrationManual(userId: string, integrationData: { oaId: string; oaName: string; accessToken: string; refreshToken: string; isMock?: boolean }) {
    const isMock = !!integrationData.isMock;
    const tokenExpiredAt = new Date(Date.now() + 25 * 60 * 60 * 1000); // Mặc định hết hạn sau 25 giờ

    const zaloIntegration = {
      isConnected: true,
      oaId: integrationData.oaId,
      oaName: integrationData.oaName,
      accessToken: integrationData.accessToken,
      refreshToken: integrationData.refreshToken,
      tokenExpiredAt,
      connectedAt: new Date(),
      isMock
    };

    await UserModel.findByIdAndUpdate(userId, { zaloIntegration });

    // Nếu ở chế độ mock, tự động tạo một vài cuộc hội thoại mẫu để hiển thị ngay
    if (isMock) {
      await this.seedMockData(integrationData.oaId);
    }

    return zaloIntegration;
  },

  /**
   * Hủy liên kết Zalo OA
   */
  async removeIntegration(userId: string) {
    await UserModel.findByIdAndUpdate(userId, { zaloIntegration: null });
  },

  /**
   * Lấy Access Token hợp lệ, tự động refresh nếu sắp hết hạn
   */
  async getAccessTokenByOAId(oaId: string): Promise<string | null> {
    // 1. Search in UserModel first (user-level)
    const user = await UserModel.findOne({
      "zaloIntegration.isConnected": true,
      "zaloIntegration.oaId": oaId
    });

    if (user && user.zaloIntegration) {
      const integration = user.zaloIntegration;

      if (integration.isMock) {
        return "mock_zalo_access_token_123456789";
      }

      const now = Date.now();
      const expiryTime = new Date(integration.tokenExpiredAt).getTime();
      
      // Nếu còn ít hơn 10 phút thì tiến hành refresh token
      if (expiryTime - now < 10 * 60 * 1000) {
        console.log(`[Zalo Service Token] Token của OA ID ${oaId} sắp hết hạn. Đang tiến hành làm mới tự động...`);
        try {
          const refreshedToken = await this.refreshToken(user._id.toString(), integration);
          return refreshedToken;
        } catch (err) {
          console.error(`[Zalo Service Token] Tự động làm mới token thất bại:`, err);
          // Trả về token cũ làm fallback
          return integration.accessToken;
        }
      }

      return integration.accessToken;
    }

    // 2. Search in SocialIntegrationModel (company-level)
    const { SocialIntegrationModel } = require("../model/social-integration.model");
    const companyIntegration = await SocialIntegrationModel.findOne({
      platform: "Zalo",
      username: oaId, // OA ID is stored in username
      isConnected: true
    });

    if (companyIntegration) {
      if (companyIntegration.isMock) {
        return "mock_zalo_access_token_123456789";
      }

      const now = Date.now();
      const expiryTime = companyIntegration.tokenExpiredAt ? new Date(companyIntegration.tokenExpiredAt).getTime() : 0;

      // Nếu token đã hết hạn hoặc còn ít hơn 10 phút thì tiến hành refresh token
      if (companyIntegration.refreshToken && (expiryTime <= now || expiryTime - now < 10 * 60 * 1000)) {
        console.log(`[Zalo Service Token] Company Zalo Token của OA ID ${oaId} sắp hết hạn. Đang tiến hành làm mới tự động...`);
        try {
          const newAccessToken = await this.refreshCompanyZaloToken(companyIntegration._id.toString(), companyIntegration);
          return newAccessToken;
        } catch (err) {
          console.error(`[Zalo Service Token] Tự động làm mới Company Zalo token thất bại:`, err);
          return companyIntegration.accessToken || null;
        }
      }

      return companyIntegration.accessToken || null;
    }

    return null;
  },

  async refreshCompanyZaloToken(integrationId: string, integration: any): Promise<string> {
    const url = "https://oauth.zaloapp.com/v4/oa/access_token";
    const bodyParams = new URLSearchParams();
    bodyParams.set("refresh_token", integration.refreshToken);
    bodyParams.set("grant_type", "refresh_token");

    const appId = process.env.ZALO_APP_ID || "";
    const appSecret = process.env.ZALO_APP_SECRET || "";

    if (!appId || !appSecret) {
      throw new Error("Không thể làm mới token: Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trong file .env");
    }

    bodyParams.set("app_id", appId);

    const response = await (globalThis as any).fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": appSecret,
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Refresh Company Zalo Token thất bại: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Refresh Company Zalo Token lỗi: ${data.error_name || data.error}`);
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const expiresInSeconds = Number(data.expires_in) || 90000;
    const tokenExpiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    const { SocialIntegrationModel } = require("../model/social-integration.model");
    await SocialIntegrationModel.findByIdAndUpdate(integrationId, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenExpiredAt,
    });

    console.log(`[Zalo Service Token] Đã làm mới company-level token thành công cho ID: ${integrationId}`);
    return newAccessToken;
  },

  /**
   * Gọi API làm mới Zalo Access Token từ Zalo OAuth
   */
  async refreshToken(userId: string, integration: any): Promise<string> {
    const url = "https://oauth.zaloapp.com/v4/oa/access_token";
    const bodyParams = new URLSearchParams();
    bodyParams.set("refresh_token", integration.refreshToken);
    bodyParams.set("grant_type", "refresh_token");

    // Lấy App ID/Secret từ cấu hình hoặc biến môi trường
    const appId = process.env.ZALO_APP_ID || "";
    const appSecret = process.env.ZALO_APP_SECRET || "";

    if (!appId || !appSecret) {
      throw new Error("Không thể làm mới token: Thiếu cấu hình ZALO_APP_ID hoặc ZALO_APP_SECRET trong file .env");
    }

    bodyParams.set("app_id", appId);

    const response = await (globalThis as any).fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "secret_key": appSecret,
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Refresh Zalo Token thất bại: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Refresh Zalo Token lỗi: ${data.error_name || data.error}`);
    }

    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;
    const expiresInSeconds = Number(data.expires_in) || 90000;
    const tokenExpiredAt = new Date(Date.now() + expiresInSeconds * 1000);

    await UserModel.findByIdAndUpdate(userId, {
      "zaloIntegration.accessToken": newAccessToken,
      "zaloIntegration.refreshToken": newRefreshToken,
      "zaloIntegration.tokenExpiredAt": tokenExpiredAt,
    });

    console.log(`[Zalo Service Token] Đã làm mới token thành công cho User ID: ${userId}`);
    return newAccessToken;
  },

  /**
   * Tạo dữ liệu giả lập cho chế độ Demo (Mock Mode)
   */
  async seedMockData(oaId: string) {
    console.log(`[Zalo Service Mock] Tạo dữ liệu giả lập cho OA ID: ${oaId}`);
    
    // Xóa dữ liệu mock cũ
    const existingConvs = await ZaloConversationModel.find({ oaId });
    for (const c of existingConvs) {
      await ZaloMessageModel.deleteMany({ conversationId: c._id });
    }
    await ZaloConversationModel.deleteMany({ oaId });

    // Tạo khách hàng 1: Nguyễn Văn Hùng
    const conv1 = await ZaloConversationModel.create({
      recipientId: "zalo_user_hung_01",
      senderName: "Nguyễn Văn Hùng",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
      oaId,
      lastMessageText: "Tư vấn cho tôi dịch vụ bên bạn với",
      lastMessageAt: new Date(Date.now() - 30 * 60 * 1000), // 30 phút trước
      unreadCount: 1,
      status: "open",
      tags: ["Khách Ấm", "Hỏi Giá"],
      isVip: false,
    });

    await ZaloMessageModel.create({
      conversationId: conv1._id,
      senderId: "zalo_user_hung_01",
      recipientId: oaId,
      direction: "inbound",
      text: "Xin chào iGen ERP, tôi đang muốn tìm hiểu về phần mềm CRM quản lý khách hàng.",
      messageId: `msg_mock_z1_${Date.now()}`,
      timestamp: new Date(Date.now() - 35 * 60 * 1000),
      status: "read",
    });

    await ZaloMessageModel.create({
      conversationId: conv1._id,
      senderId: oaId,
      recipientId: "zalo_user_hung_01",
      direction: "outbound",
      text: "Dạ em chào anh Hùng ạ. iGen ERP cung cấp giải pháp CRM tích hợp đa kênh bao gồm Facebook, Zalo OA giúp quản lý tin nhắn tập trung. Anh cần quản lý cho đội ngũ bao nhiêu nhân sự ạ?",
      messageId: `msg_mock_z2_${Date.now()}`,
      timestamp: new Date(Date.now() - 32 * 60 * 1000),
      status: "read",
    });

    await ZaloMessageModel.create({
      conversationId: conv1._id,
      senderId: "zalo_user_hung_01",
      recipientId: oaId,
      direction: "inbound",
      text: "Tư vấn cho tôi dịch vụ bên bạn với. Bên tôi có khoảng 15 nhân viên sales.",
      messageId: `msg_mock_z3_${Date.now()}`,
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      status: "delivered",
    });

    // Tạo khách hàng 2: Trần Thị Mai (Khách VIP)
    const conv2 = await ZaloConversationModel.create({
      recipientId: "zalo_user_mai_02",
      senderName: "Trần Thị Mai",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
      oaId,
      lastMessageText: "Cảm ơn bạn nhiều nhé, hỗ trợ rất nhiệt tình",
      lastMessageAt: new Date(Date.now() - 10 * 60 * 1000), // 10 phút trước
      unreadCount: 0,
      status: "open",
      tags: ["Khách VIP", "Mới tiếp cận"],
      isVip: true,
    });

    await ZaloMessageModel.create({
      conversationId: conv2._id,
      senderId: "zalo_user_mai_02",
      recipientId: oaId,
      direction: "inbound",
      text: "Hợp đồng gói CRM Enterprise 12 tháng bên mình đã chuyển khoản xong rồi nhé.",
      messageId: `msg_mock_z4_${Date.now()}`,
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      status: "read",
    });

    await ZaloMessageModel.create({
      conversationId: conv2._id,
      senderId: oaId,
      recipientId: "zalo_user_mai_02",
      direction: "outbound",
      text: "Dạ iGen ERP đã nhận được thông tin chuyển khoản của chị Mai rồi ạ. Hệ thống ERP của bên mình đang được khởi tạo và phân quyền, bạn kỹ thuật viên sẽ liên hệ chị trong 5 phút nữa nhé.",
      messageId: `msg_mock_z5_${Date.now()}`,
      timestamp: new Date(Date.now() - 12 * 60 * 1000),
      status: "read",
    });

    await ZaloMessageModel.create({
      conversationId: conv2._id,
      senderId: "zalo_user_mai_02",
      recipientId: oaId,
      direction: "inbound",
      text: "Cảm ơn bạn nhiều nhé, hỗ trợ rất nhiệt tình",
      messageId: `msg_mock_z6_${Date.now()}`,
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      status: "read",
    });
  },

  /**
   * Lấy danh sách hội thoại Zalo OA
   */
  async getConversations(oaId: string) {
    console.log(`[Zalo Service] Lấy danh sách hội thoại cho OA ID: ${oaId}`);
    return ZaloConversationModel.find({ oaId }).sort({ lastMessageAt: -1 });
  },

  /**
   * Lấy tin nhắn chi tiết
   */
  async getMessages(oaId: string, conversationId: string, options?: { limit?: number; before?: string; sync?: boolean }) {
    const conversation = await ZaloConversationModel.findOne({ _id: conversationId, oaId });
    if (!conversation) {
      return {
        messages: [],
        pagination: { limit: 20, hasMore: false, nextBefore: null }
      };
    }

    // Reset số lượng tin nhắn chưa đọc
    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    const limit = Math.min(Math.max(Number(options?.limit || 20), 1), 100);
    const beforeDate = options?.before ? new Date(options.before) : null;
    const filter: any = { conversationId: conversation._id };
    
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
      filter.timestamp = { $lt: beforeDate };
    }

    const existingMessages = await ZaloMessageModel.find(filter).sort({ timestamp: -1 }).limit(limit + 1);
    const hasMore = existingMessages.length > limit;
    const trimmedMessages = hasMore ? existingMessages.slice(0, limit) : existingMessages;
    const orderedMessages = [...trimmedMessages].reverse();
    const oldestMessage = orderedMessages[0];
    const latestMessage = orderedMessages[orderedMessages.length - 1];

    return {
      messages: orderedMessages,
      pagination: {
        limit,
        hasMore,
        nextBefore: oldestMessage?.timestamp ? new Date(oldestMessage.timestamp).toISOString() : null,
      }
    };
  },

  async markConversationRead(oaId: string, conversationId: string) {
    const conversation = await ZaloConversationModel.findOne({ _id: conversationId, oaId });
    if (!conversation) {
      throw new Error("Khong tim thay hoi thoai Zalo.");
    }

    if (conversation.unreadCount !== 0) {
      conversation.unreadCount = 0;
      await conversation.save();
      emitToPage(oaId, "conversation_updated", conversation);
    }

    return { success: true };
  },

  /**
   * Gửi phản hồi tin nhắn cho khách hàng qua Zalo OA
   */
  async sendReply(oaId: string, conversationId: string, text: string) {
    const conversation = await ZaloConversationModel.findOne({ _id: conversationId, oaId });
    if (!conversation) {
      throw new Error("Không tìm thấy cuộc hội thoại Zalo để trả lời.");
    }

    // Hủy các phản hồi AI đang lên lịch do nhân viên đã can thiệp
    aiAutoReplyService.cancelPendingReply(conversationId);

    const user = await UserModel.findOne({
      "zaloIntegration.isConnected": true,
      "zaloIntegration.oaId": oaId
    });

    const isMock = user?.zaloIntegration?.isMock ?? false;
    const recipientId = conversation.recipientId;

    const previousConversationState = {
      lastMessageText: conversation.lastMessageText,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation.unreadCount,
    };

    conversation.lastMessageText = text;
    conversation.lastMessageAt = new Date();
    conversation.unreadCount = 0;
    await conversation.save();

    const messageId = `zalo_out_${Date.now()}`;
    const newMsg = new ZaloMessageModel({
      conversationId: conversation._id,
      senderId: oaId,
      recipientId: recipientId,
      direction: "outbound",
      text,
      attachments: [],
      messageId,
      timestamp: new Date(),
      status: "sent",
    });
    await newMsg.save();
    const emitRealtimeUpdate = () => {
      emitToPage(oaId, "new_message", {
        message: newMsg,
        conversation: conversation
      });
      emitToPage(oaId, "conversation_updated", conversation);
    };

    // Phát socket realtime
    emitRealtimeUpdate();

    // Xử lý gửi tin thật hoặc giả lập
    if (isMock) {
      console.log(`[Zalo Service Mock] Giả lập gửi tin tới Zalo User: ${recipientId}`);
      // Lên lịch phản hồi tự động từ Bot/Khách hàng giả lập sau 2.5 giây để tăng tính tương tác
      setTimeout(async () => {
        try {
          const autoReplyText = `[Zalo Demo Bot] Cảm ơn bạn đã phản hồi: "${text}". Hệ thống ERP đang thử nghiệm hoạt động tốt!`;
          const botMessageId = `zalo_in_mock_${Date.now()}`;
          
          const incomingMsg = new ZaloMessageModel({
            conversationId: conversation._id,
            senderId: recipientId,
            recipientId: oaId,
            direction: "inbound",
            text: autoReplyText,
            attachments: [],
            messageId: botMessageId,
            timestamp: new Date(),
            status: "delivered"
          });
          await incomingMsg.save();

          conversation.lastMessageText = autoReplyText;
          conversation.lastMessageAt = new Date();
          conversation.unreadCount += 1;
          await conversation.save();

          // Phát socket tin nhắn đến
          emitToPage(oaId, "new_message", {
            message: incomingMsg,
            conversation: conversation
          });
          emitToPage(oaId, "conversation_updated", conversation);
        } catch (err) {
          console.error("Lỗi giả lập phản hồi Zalo:", err);
        }
      }, 2500);

    } else {
      // Gửi thật qua Zalo OpenAPI
      let token = await this.getAccessTokenByOAId(oaId);
      if (!token) {
        throw new Error("Không lấy được Zalo Access Token hợp lệ.");
      }

      // Nếu token thật sự hết hạn, thử refresh một lần nữa trước khi gọi OpenAPI.
      const user = await UserModel.findOne({
        "zaloIntegration.isConnected": true,
        "zaloIntegration.oaId": oaId,
      });
      if (user?.zaloIntegration && !user.zaloIntegration.isMock) {
        const expiryTime = user.zaloIntegration.tokenExpiredAt ? new Date(user.zaloIntegration.tokenExpiredAt).getTime() : 0;
        if (expiryTime <= Date.now()) {
          token = await this.refreshToken(user._id.toString(), user.zaloIntegration);
        }
      }

      const url = "https://openapi.zalo.me/v3.0/oa/message/cs";
      const payload = {
        recipient: {
          user_id: recipientId
        },
        message: {
          text: text
        }
      };

      const response = await (globalThis as any).fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Zalo Service OpenAPI] Gửi tin thất bại: ${response.status} - ${errText}`);
        throw new Error(`Zalo API phản hồi lỗi: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      if (resData.error) {
        throw new Error(`Zalo API Error: ${resData.message} (Code: ${resData.error})`);
      }
      
      console.log(`[Zalo Service OpenAPI] Đã gửi tin nhắn thật thành công:`, resData);
      newMsg.messageId = resData.data?.message_id || messageId;
      newMsg.status = "delivered";
      await newMsg.save();
    }

    return {
      status: "success",
      messageId: newMsg.messageId,
    };
  },

  /**
   * Xử lý sự kiện Webhook từ Zalo OA gửi sang
   */
  async handleWebhookEvent(body: any) {
    console.log("[Zalo Service Webhook] Nhận sự kiện từ Zalo OA:", JSON.stringify(body));

    let oaId = body.oa_id || body.recipient?.id;
    
    // Zalo's official developer console test webhook sends a hardcoded recipient.id of "579745863508352884"
    if (oaId === "579745863508352884") {
      console.log("[Zalo Service Webhook] Phát hiện payload test từ Zalo Webhooks UI. Tự động chuyển đổi sang Zalo OA ID active.");
      const activeUser = await UserModel.findOne({ "zaloIntegration.isConnected": true });
      let foundOaId = activeUser?.zaloIntegration?.oaId;
      if (!foundOaId) {
        const { SocialIntegrationModel } = require("../model/social-integration.model");
        const companyIntegration = await SocialIntegrationModel.findOne({
          platform: "Zalo",
          isConnected: true
        });
        if (companyIntegration) {
          foundOaId = companyIntegration.username;
        }
      }
      oaId = foundOaId || process.env.ZALO_OA_ID || "270721158521070717";
    }

    const eventName = body.event_name;
    if (!oaId || !eventName) {
      console.warn("[Zalo Service Webhook] Thiếu oa_id hoặc event_name. Bỏ qua.");
      return;
    }

    // Các sự kiện tin nhắn từ người dùng
    const messageEvents = ["user_send_text", "user_send_image", "user_send_link", "user_send_sticker"];
    if (!messageEvents.includes(eventName)) {
      console.log(`[Zalo Service Webhook] Sự kiện ${eventName} không nằm trong danh sách xử lý tin nhắn chat. Bỏ qua.`);
      return;
    }

    const senderId = body.sender?.id; // User ID OA-Scoped của khách hàng
    const messageId = body.message?.msg_id || `zalo_in_${Date.now()}`;
    const timestamp = body.timestamp ? new Date(Number(body.timestamp)) : new Date();
    const duplicateMsg = await ZaloMessageModel.findOne({ messageId });
    if (duplicateMsg) {
      console.info(`[Zalo Service Webhook] Bo qua webhook trung cho messageId=${messageId}.`);
      return;
    }

    let text = body.message?.text || "";
    const attachments: any[] = [];

    if (eventName === "user_send_image" && Array.isArray(body.message?.attachments)) {
      body.message.attachments.forEach((att: any) => {
        attachments.push({
          type: "image",
          url: att.payload?.url || "",
        });
      });
      if (!text) text = "[Hình ảnh]";
    } else if (eventName === "user_send_sticker") {
      attachments.push({
        type: "sticker",
        url: body.message?.url || "",
      });
      if (!text) text = "[Sticker]";
    } else if (eventName === "user_send_link") {
      if (!text) text = `[Link] ${body.message?.url || ""}`;
    }

    // Lấy thông tin kết nối từ User hoặc Company Integration
    const user = await UserModel.findOne({
      "zaloIntegration.isConnected": true,
      "zaloIntegration.oaId": oaId
    });

    let isConnected = !!user;
    let isMock = user?.zaloIntegration?.isMock ?? false;

    if (!user) {
      const { SocialIntegrationModel } = require("../model/social-integration.model");
      const companyIntegration = await SocialIntegrationModel.findOne({
        platform: "Zalo",
        username: oaId,
        isConnected: true
      });
      if (companyIntegration) {
        isConnected = true;
        isMock = !!companyIntegration.isMock;
      }
    }

    if (!isConnected) {
      console.warn(`[Zalo Service Webhook] Không tìm thấy liên kết Zalo OA hoạt động nào cho OA ID: ${oaId}`);
      return;
    }

    // Tìm hoặc tạo cuộc hội thoại
    let conversation = await ZaloConversationModel.findOne({ recipientId: senderId, oaId });
    let senderName = conversation?.senderName || "Khách hàng Zalo";
    let avatarUrl = conversation?.avatarUrl || "";

    // Thử lấy profile từ Zalo API nếu có Access Token hợp lệ, không phải Mock và thông tin hiện tại đang là mặc định
    if (!isMock && (senderName === "Khách hàng Zalo" || !avatarUrl)) {
      try {
        const token = await this.getAccessTokenByOAId(oaId);
        if (token) {
          const profileUrl = `https://openapi.zalo.me/v3.0/oa/getprofile?data=${encodeURIComponent(JSON.stringify({ user_id: senderId }))}`;
          const profileResponse = await (globalThis as any).fetch(profileUrl, {
            headers: { "access_token": token }
          });
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.data) {
              senderName = profileData.data.shared_info?.name || profileData.data.display_name || senderName;
              avatarUrl = profileData.data.avatar || avatarUrl;
            }
          }
        }
      } catch (err) {
        console.error("[Zalo Service Webhook] Không lấy được thông tin profile từ Zalo API:", err);
      }
    }

    if (!conversation) {
      conversation = new ZaloConversationModel({
        recipientId: senderId,
        senderName,
        avatarUrl,
        oaId,
        lastMessageText: text,
        lastMessageAt: timestamp,
        unreadCount: 1,
        status: "open",
      });
      await conversation.save();
    } else {
      conversation.senderName = senderName;
      conversation.avatarUrl = avatarUrl;
      conversation.lastMessageText = text;
      conversation.lastMessageAt = timestamp;
      conversation.unreadCount += 1;
      conversation.status = "open";
      await conversation.save();
    }

    // Lưu tin nhắn chi tiết
    const existingMsg = await ZaloMessageModel.findOne({ messageId });
    if (!existingMsg) {
      const newMsg = new ZaloMessageModel({
        conversationId: conversation._id,
        senderId,
        recipientId: oaId,
        direction: "inbound",
        text,
        attachments,
        messageId,
        timestamp,
        status: "delivered",
      });
      await newMsg.save();

      // Realtime update qua Socket.IO
      emitToPage(oaId, "new_message", {
        message: newMsg,
        conversation: conversation
      });
      emitToPage(oaId, "conversation_updated", conversation);
      console.log(`[Zalo Service Webhook] Đã lưu tin nhắn mới thành công từ Zalo User: ${senderId}`);

      // Kích hoạt AI Auto-Reply Bot bất đồng bộ
      aiAutoReplyService.triggerAutoReply("zalo", oaId, conversation._id.toString(), text, messageId);
    }
  }
};
