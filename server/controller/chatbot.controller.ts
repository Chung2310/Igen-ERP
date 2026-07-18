import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { ChatbotService, ChatbotMessage } from "../service/chatbot.service";

export const chatbotController = {
  /**
   * POST /api/v1/chatbot/chat
   * Trợ lý ảo AI — trả lời dựa trên dữ liệu thời gian thực của doanh nghiệp.
   */
  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const { messages } = req.body as { messages: ChatbotMessage[] };
      const user = req.user!;
      const reply = await ChatbotService.getResponse(user, messages);
      return res.json({ success: true, reply });
    } catch (error) {
      // App không có JSON error middleware — trả JSON trực tiếp để client đọc được lỗi.
      console.error("[chatbotController.chat] Error:", error);
      return res.status(500).json({
        status: "error",
        success: false,
        message:
          error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý yêu cầu trợ lý ảo.",
      });
    }
  },
};
