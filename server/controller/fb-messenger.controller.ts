import { Request, Response } from "express";
import { fbMessengerService } from "../service/fb-messenger.service";
import { UserModel } from "../model/user.model";
import { AIReplyLogModel } from "../model/ai-reply-log.model";

async function getFacebookPageConfig(userId: string): Promise<{ isConnected: boolean; pageId?: string }> {
  const dbUser = await UserModel.findById(userId).lean();
  if (!dbUser) {
    console.warn(`[FB Config] Khong tim thay user voi userId=${userId}`);
    return { isConnected: false };
  }

  // Prefer company integration first so CRM follows the page configured in
  // Settings > Company Integrations instead of a stale personal page mapping.
  const { SocialIntegrationModel } = require("../model/social-integration.model");
  const companyIntegration = await SocialIntegrationModel.findOne({
    companyCode: dbUser.companyCode,
    platform: "Facebook",
    isConnected: true
  }).lean();

  if (companyIntegration && companyIntegration.username) {
    console.log(`[FB Config] Dung Facebook company integration cua company=${dbUser.companyCode}, pageId=${companyIntegration.username}, displayName=${companyIntegration.displayName}`);
    return { isConnected: true, pageId: companyIntegration.username };
  }

  if (dbUser.facebookIntegration?.isConnected && dbUser.facebookIntegration.pageId) {
    console.log(`[FB Config] Fallback Facebook integration ca nhan cua user=${dbUser.email}, pageId=${dbUser.facebookIntegration.pageId}`);
    return { isConnected: true, pageId: dbUser.facebookIntegration.pageId };
  }

  console.warn(`[FB Config] Khong tim thay Facebook integration hoat dong cho user=${dbUser.email}, company=${dbUser.companyCode}`);
  return { isConnected: false };
}


export const fbMessengerController = {
  /**
   * GET /api/v1/facebook/webhook
   * Facebook gọi endpoint này để kiểm tra xem Webhook URL có hoạt động đúng và an toàn không
   */
  async verifyWebhook(req: Request, res: Response): Promise<any> {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;

    console.log(`[Facebook Webhook Verification] Bắt đầu xác thực: mode=${mode}, token=${token}, challenge=${challenge}`);

    try {
      const result = await fbMessengerService.verifyWebhook(mode, token, challenge);
      console.log("[Facebook Webhook Verification] Xác thực thành công! Phản hồi challenge về Meta.");
      // Phản hồi lại chuỗi challenge bằng plain text
      res.status(200).send(result);
    } catch (error: any) {
      console.error("[Facebook Webhook Verification] Xác thực thất bại:", error.message || error);
      res.status(403).send(error.message || "Xác thực thất bại");
    }
  },

  /**
   * POST /api/v1/facebook/webhook
   * Facebook gọi endpoint này mỗi khi có sự kiện tin nhắn mới
   */
  async receiveWebhookEvent(req: Request, res: Response): Promise<any> {
    try {
      const body = req.body;
      const entryCount = Array.isArray(body?.entry) ? body.entry.length : 0;
      console.log(`[Facebook Webhook Event] Nhan webhook object=${body?.object || "unknown"}, entries=${entryCount}`);
      
      // Phản hồi nhanh chóng cho Meta để tránh timeout
      res.status(200).send("EVENT_RECEIVED");

      // Xử lý không đồng bộ dưới background
      fbMessengerService.handleWebhookEvent(body).catch((err) => {
        console.error("[Facebook Webhook Event] Lỗi nghiêm trọng khi xử lý event dưới nền:", err);
      });
    } catch (error: any) {
      console.error("[Facebook Webhook Event] Lỗi tiếp nhận webhook:", error);
      res.status(200).send("EVENT_RECEIVED_WITH_ERROR");
    }
  },

  /**
   * GET /api/v1/facebook/messenger/conversations
   * API để Frontend lấy danh sách hội thoại của trang
   */
  async getConversations(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);

      // Nếu người dùng hiện tại chưa kết nối Facebook Page, trả về mảng rỗng ngay lập tức
      if (!isConnected || !pageId) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const shouldSync = req.query.sync === "1" || req.query.sync === "true";
      const conversations = await fbMessengerService.getConversations(pageId, { sync: shouldSync });
      
      res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error: any) {
      console.error("[FB Controller getConversations] Lỗi khi xử lý:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Không thể lấy danh sách cuộc hội thoại."
      });
    }
  },

  /**
   * GET /api/v1/facebook/messenger/conversations/:recipientId/messages
   * API lấy lịch sử tin nhắn của một khách hàng
   */
  async getMessages(req: any, res: Response): Promise<any> {
    try {
      const { recipientId: conversationId } = req.params;
      const userId = req.user?.id;
      const limit = Number(req.query.limit || 20);
      const before = typeof req.query.before === "string" ? req.query.before : undefined;
      const shouldSync = req.query.sync === "1" || req.query.sync === "true";

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);

      // Bảo vệ: Đảm bảo khách hàng này thuộc về Page ID của người dùng hiện tại
      if (!isConnected || !pageId) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      const result = await fbMessengerService.getMessages(pageId, conversationId, { limit, before, sync: shouldSync });

      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error("[FB Controller getMessages] Lỗi khi lấy lịch sử tin nhắn:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Không thể lấy lịch sử tin nhắn."
      });
    }
  },

  /**
   * POST /api/v1/facebook/messenger/reply
   * API để nhân viên/AI gửi tin nhắn trả lời khách hàng
   */
  async markRead(req: any, res: Response): Promise<any> {
    try {
      const { recipientId: conversationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);

      if (!isConnected || !pageId) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      const conversation = await fbMessengerService.markConversationRead(pageId, conversationId);

      res.status(200).json({
        success: true,
        message: "Đã đánh dấu đã đọc cuộc hội thoại Facebook.",
        data: conversation
      });
    } catch (error: any) {
      console.error("[FB Controller markRead] Lỗi khi đánh dấu đã đọc:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Không thể đánh dấu đã đọc cuộc hội thoại."
      });
    }
  },

  async sendReply(req: any, res: Response): Promise<any> {
    try {
      const { recipientId: conversationId, text } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);

      if (!isConnected || !pageId) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      if (!conversationId || !text) {
        return res.status(400).json({
          success: false,
          message: "Thiếu recipientId hoặc nội dung text."
        });
      }

      const result = await fbMessengerService.sendReply(pageId, conversationId, text);

      res.status(200).json({
        success: true,
        message: "Đã gửi tin nhắn phản hồi thành công.",
        data: result
      });
    } catch (error: any) {
      console.error("[FB Controller sendReply] Gửi tin nhắn thất bại:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Gửi tin nhắn thất bại."
      });
    }
  },

  /**
   * GET /api/v1/facebook/messenger/diagnostics/:conversationId
   * Kiểm tra nhanh vì sao Facebook auto-reply không gửi.
   */
  async diagnoseConversation(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      const { conversationId } = req.params;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);
      if (!isConnected || !pageId) {
        return res.status(403).json({ success: false, message: "Bạn chưa cấu hình tích hợp Facebook." });
      }

      const diagnostic = await fbMessengerService.diagnoseConversation(pageId, conversationId);
      return res.status(200).json({ success: true, data: diagnostic });
    } catch (error: any) {
      console.error("[FB Controller diagnoseConversation] Lỗi:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Không thể chẩn đoán hội thoại Facebook.",
      });
    }
  }

  ,

  /**
   * GET /api/v1/facebook/messenger/diagnostics/page
   * Kiem tra nhanh cau hinh page/token/webhook mapping cua user hien tai.
   */
  async diagnosePageConfig(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      const { isConnected, pageId } = await getFacebookPageConfig(userId);
      const diagnostic = await fbMessengerService.diagnosePageConfig(userId, pageId);
      return res.status(200).json({
        success: true,
        data: {
          isConnected,
          pageId: pageId || null,
          ...diagnostic,
        }
      });
    } catch (error: any) {
      console.error("[FB Controller diagnosePageConfig] Loi:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Không thể chẩn đoán cấu hình Facebook page.",
      });
    }
  },

  /**
   * GET /api/v1/facebook/debug-ai-logs
   * PUBLIC endpoint (no auth) - Temporary diagnostic to show recent AI reply logs across all companyCode
   */
  async debugAILogs(req: Request, res: Response): Promise<any> {
    try {
      const limit = Math.min(Number(req.query.limit || 10), 30);
      const logs = await AIReplyLogModel.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return res.status(200).json({
        success: true,
        count: logs.length,
        logs: logs.map(l => ({
          _id: l._id,
          companyCode: l.companyCode,
          channel: l.channel,
          conversationId: l.conversationId,
          status: l.status,
          customerMessage: String(l.customerMessage || "").slice(0, 100),
          aiResponse: String(l.aiResponse || "").slice(0, 200),
          latencyMs: l.latencyMs,
          createdAt: l.createdAt,
        })),
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
