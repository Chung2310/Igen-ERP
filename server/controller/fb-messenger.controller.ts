import { Request, Response } from "express";
import { fbMessengerService } from "../service/fb-messenger.service";
import { UserModel } from "../model/user.model";

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
      
      console.log("[Facebook Webhook Event] Đã nhận được sự kiện POST từ Meta:", JSON.stringify(body, null, 2));

      // Facebook khuyên phản hồi 200 OK cực kỳ nhanh chóng trước khi thực hiện xử lý logic nặng
      // để tránh tình trạng timeout (sau 20 giây sẽ gửi lại webhook cũ)
      res.status(200).send("EVENT_RECEIVED");
      console.log("[Facebook Webhook Event] Đã phản hồi 200 OK cho Meta. Tiến hành xử lý bất đồng bộ dưới nền...");

      // Xử lý không đồng bộ (asynchronous) dưới background
      fbMessengerService.handleWebhookEvent(body).catch((err) => {
        console.error("[Facebook Webhook Event] Lỗi nghiêm trọng khi xử lý event dưới nền:", err);
      });
    } catch (error: any) {
      console.error("[Facebook Webhook Event] Lỗi tiếp nhận webhook:", error);
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
      const userId = req.user?.id;
      console.log(`[FB Controller getConversations] Request từ User ID: ${userId}`);

      if (!userId) {
        console.warn("[FB Controller getConversations] Từ chối yêu cầu: Không tìm thấy User ID trong request.");
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const dbUser = await UserModel.findById(userId).lean();
      if (!dbUser) {
        console.error(`[FB Controller getConversations] Không tìm thấy User trong Database với ID: ${userId}`);
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy thông tin tài khoản."
        });
      }

      const pageId = dbUser?.facebookIntegration?.pageId;
      console.log(`[FB Controller getConversations] Cấu hình Facebook của user ${dbUser.email}: isConnected=${dbUser?.facebookIntegration?.isConnected}, pageId=${pageId}`);

      // Nếu người dùng hiện tại chưa kết nối Facebook Page, trả về mảng rỗng ngay lập tức
      if (!dbUser?.facebookIntegration?.isConnected || !pageId) {
        console.log(`[FB Controller getConversations] Trả về mảng rỗng vì User ${dbUser.email} chưa kết nối Facebook Page.`);
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const conversations = await fbMessengerService.getConversations(pageId);
      console.log(`[FB Controller getConversations] Lấy thành công ${conversations.length} cuộc hội thoại cho Page ID: ${pageId}`);
      
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
      const { recipientId } = req.params;
      const userId = req.user?.id;
      console.log(`[FB Controller getMessages] Lấy tin nhắn với khách hàng PSID: ${recipientId}, User ID yêu cầu: ${userId}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const dbUser = await UserModel.findById(userId).lean();
      const pageId = dbUser?.facebookIntegration?.pageId;

      // Bảo vệ: Đảm bảo khách hàng này thuộc về Page ID của người dùng hiện tại
      if (!dbUser?.facebookIntegration?.isConnected || !pageId) {
        console.warn(`[FB Controller getMessages] Từ chối truy cập: User ${dbUser?.email} chưa liên kết Facebook Page.`);
        return res.status(403).json({
          success: false,
          message: "Quyền truy cập bị từ chối. Bạn chưa cấu hình tích hợp Facebook."
        });
      }

      const messages = await fbMessengerService.getMessages(recipientId);
      console.log(`[FB Controller getMessages] Lấy thành công ${messages.length} tin nhắn giữa Page ${pageId} và khách hàng PSID ${recipientId}`);

      res.status(200).json({
        success: true,
        data: messages
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
  async sendReply(req: any, res: Response): Promise<any> {
    try {
      const { recipientId, text } = req.body;
      const userId = req.user?.id;

      console.log(`[FB Controller sendReply] Yêu cầu gửi phản hồi từ User ID ${userId} tới khách hàng PSID ${recipientId}. Nội dung: "${text}"`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Người dùng chưa đăng nhập."
        });
      }

      const dbUser = await UserModel.findById(userId).lean();
      const pageId = dbUser?.facebookIntegration?.pageId;

      if (!dbUser?.facebookIntegration?.isConnected || !pageId) {
        console.warn(`[FB Controller sendReply] Từ chối gửi tin nhắn: User ${dbUser?.email} chưa tích hợp Facebook Page.`);
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
      console.log(`[FB Controller sendReply] Đã gửi thành công phản hồi tới PSID: ${recipientId}. Mã tin nhắn: ${result.messageId}`);

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
  }
};
