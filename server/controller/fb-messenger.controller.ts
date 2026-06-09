import { Request, Response } from "express";
import { fbMessengerService } from "../service/fb-messenger.service";

export const fbMessengerController = {
  /**
   * GET /api/v1/facebook/webhook
   * Facebook gọi endpoint này để kiểm tra xem Webhook URL có hoạt động đúng và an toàn không
   */
  async verifyWebhook(req: Request, res: Response): Promise<any> {
    try {
      const mode = req.query["hub.mode"] as string;
      const token = req.query["hub.verify_token"] as string;
      const challenge = req.query["hub.challenge"] as string;

      const result = fbMessengerService.verifyWebhook(mode, token, challenge);
      
      // Phản hồi lại chuỗi challenge bằng plain text
      res.status(200).send(result);
    } catch (error: any) {
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
      
      // Facebook khuyên phản hồi 200 OK cực kỳ nhanh chóng trước khi thực hiện xử lý logic nặng
      // để tránh tình trạng timeout (sau 20 giây sẽ gửi lại webhook cũ)
      res.status(200).send("EVENT_RECEIVED");

      // Xử lý không đồng bộ (asynchronous) dưới background
      fbMessengerService.handleWebhookEvent(body).catch((err) => {
        console.error("[Facebook Controller] Lỗi khi xử lý event webhook:", err);
      });
    } catch (error: any) {
      console.error("[Facebook Controller] Lỗi tiếp nhận webhook:", error);
      // Vẫn gửi 200 OK để Facebook không thử lại liên tục
      res.status(200).send("EVENT_RECEIVED_WITH_ERROR");
    }
  },

  /**
   * GET /api/v1/facebook/messenger/conversations
   * API để Frontend lấy danh sách hội thoại của trang
   */
  async getConversations(req: any, res: Response): Promise<any> {
    try {
      const user = req.user;
      const pageId = user?.facebookIntegration?.pageId;

      // Nếu người dùng hiện tại chưa kết nối Facebook Page, trả về mảng rỗng ngay lập tức
      if (!user?.facebookIntegration?.isConnected || !pageId) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const conversations = await fbMessengerService.getConversations(pageId);
      res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error: any) {
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
      const { recipientId } = req.params;
      const user = req.user;

      // Bảo vệ: Đảm bảo khách hàng này thuộc về Page ID của người dùng hiện tại
      // (Tránh trường hợp user A truy cập hội thoại của user B)
      const pageId = user?.facebookIntegration?.pageId;
      if (!user?.facebookIntegration?.isConnected || !pageId) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      const messages = await fbMessengerService.getMessages(recipientId);
      res.status(200).json({
        success: true,
        data: messages
      });
    } catch (error: any) {
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
  async sendReply(req: any, res: Response): Promise<any> {
    try {
      const { recipientId, text } = req.body;
      const user = req.user;

      const pageId = user?.facebookIntegration?.pageId;
      if (!user?.facebookIntegration?.isConnected || !pageId) {
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      if (!recipientId || !text) {
        return res.status(400).json({
          success: false,
          message: "Thiếu recipientId hoặc nội dung text."
        });
      }

      const result = await fbMessengerService.sendReply(recipientId, text);
      res.status(200).json({
        success: true,
        message: "Đã gửi tin nhắn phản hồi thành công.",
        data: result
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Gửi tin nhắn thất bại."
      });
    }
  }
};
