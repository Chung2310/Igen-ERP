import { Request, Response } from "express";
import { zaloMessengerService } from "../service/zalo-messenger.service";
import { UserModel } from "../model/user.model";

export const zaloMessengerController = {
  /**
   * POST /api/v1/zalo/webhook
   * Endpoint nhận sự kiện Webhook từ Zalo OA
   */
  async receiveWebhookEvent(req: Request, res: Response): Promise<any> {
    try {
      const body = req.body;
      
      // Phản hồi 200 OK nhanh nhất có thể để Zalo không báo timeout
      res.status(200).send({ success: true, message: "EVENT_RECEIVED" });

      // Xử lý sự kiện ở chế độ nền (asynchronous)
      zaloMessengerService.handleWebhookEvent(body).catch((err) => {
        console.error("[Zalo Webhook Event] Lỗi nghiêm trọng khi xử lý event dưới nền:", err);
      });
    } catch (error: any) {
      console.error("[Zalo Webhook Event] Lỗi tiếp nhận webhook:", error);
      res.status(200).send({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/v1/zalo/conversations
   * API lấy danh sách hội thoại Zalo OA
   */
  async getConversations(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      const dbUser = await UserModel.findById(userId).lean();
      if (!dbUser) {
        return res.status(404).json({ success: false, message: "Không tìm thấy thông tin tài khoản." });
      }

      const oaId = dbUser?.zaloIntegration?.oaId;
      if (!dbUser?.zaloIntegration?.isConnected || !oaId) {
        return res.status(200).json({ success: true, data: [] });
      }

      const conversations = await zaloMessengerService.getConversations(oaId);
      res.status(200).json({ success: true, data: conversations });
    } catch (error: any) {
      console.error("[Zalo Controller getConversations] Lỗi khi xử lý:", error);
      res.status(500).json({ success: false, message: error.message || "Không thể lấy danh sách cuộc hội thoại." });
    }
  },

  /**
   * GET /api/v1/zalo/conversations/:recipientId/messages
   * API lấy lịch sử tin nhắn của một khách hàng
   */
  async getMessages(req: any, res: Response): Promise<any> {
    try {
      const { recipientId: conversationId } = req.params;
      const userId = req.user?.id;
      const limit = Number(req.query.limit || 20);
      const before = typeof req.query.before === "string" ? req.query.before : undefined;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      const dbUser = await UserModel.findById(userId).lean();
      const oaId = dbUser?.zaloIntegration?.oaId;

      if (!dbUser?.zaloIntegration?.isConnected || !oaId) {
        return res.status(403).json({ success: false, message: "Bạn chưa cấu hình tích hợp Zalo OA." });
      }

      const result = await zaloMessengerService.getMessages(oaId, conversationId, { limit, before });

      res.status(200).json({
        success: true,
        data: result.messages,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error("[Zalo Controller getMessages] Lỗi khi lấy lịch sử tin nhắn:", error);
      res.status(500).json({ success: false, message: error.message || "Không thể lấy lịch sử tin nhắn." });
    }
  },

  /**
   * POST /api/v1/zalo/reply
   * API nhân viên / Bot AI phản hồi tin nhắn Zalo OA
   */
  async sendReply(req: any, res: Response): Promise<any> {
    try {
      const { recipientId: conversationId, text } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      const dbUser = await UserModel.findById(userId).lean();
      const oaId = dbUser?.zaloIntegration?.oaId;

      if (!dbUser?.zaloIntegration?.isConnected || !oaId) {
        return res.status(403).json({ success: false, message: "Bạn chưa cấu hình tích hợp Zalo OA." });
      }

      if (!conversationId || !text) {
        return res.status(400).json({ success: false, message: "Thiếu recipientId hoặc nội dung text." });
      }

      const result = await zaloMessengerService.sendReply(oaId, conversationId, text);

      res.status(200).json({
        success: true,
        message: "Đã gửi tin nhắn phản hồi Zalo thành công.",
        data: result
      });
    } catch (error: any) {
      console.error("[Zalo Controller sendReply] Gửi tin nhắn thất bại:", error);
      res.status(500).json({ success: false, message: error.message || "Gửi tin nhắn Zalo thất bại." });
    }
  },

  /**
   * POST /api/v1/zalo/save-integration
   * API cấu hình lưu tích hợp Zalo thủ công (Mock/Real)
   */
  async saveIntegration(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      const { oaId, oaName, accessToken, refreshToken, isMock } = req.body;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      if (!oaId || !oaName || !accessToken) {
        return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ các trường bắt buộc." });
      }

      const integration = await zaloMessengerService.saveIntegrationManual(userId, {
        oaId,
        oaName,
        accessToken,
        refreshToken: refreshToken || "",
        isMock: !!isMock
      });

      res.status(200).json({
        success: true,
        message: "Cập nhật tích hợp Zalo OA thành công.",
        data: integration
      });
    } catch (error: any) {
      console.error("[Zalo Controller saveIntegration] Thất bại:", error);
      res.status(500).json({ success: false, message: error.message || "Lưu tích hợp thất bại." });
    }
  },

  /**
   * DELETE /api/v1/zalo/integration
   * API hủy tích hợp Zalo OA
   */
  async removeIntegration(req: any, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Người dùng chưa đăng nhập." });
      }

      await zaloMessengerService.removeIntegration(userId);
      res.status(200).json({ success: true, message: "Đã hủy liên kết Zalo OA thành công." });
    } catch (error: any) {
      console.error("[Zalo Controller removeIntegration] Thất bại:", error);
      res.status(500).json({ success: false, message: error.message || "Hủy liên kết thất bại." });
    }
  }
};
