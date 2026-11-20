import { logger } from "../config/logger";
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
      const result = await ChatbotService.getResponse(user, messages);
      const publicResult = { ...result };
      delete publicResult.diagnostics;
      return res.json({ success: true, ...publicResult });
    } catch (error) {
      // App không có JSON error middleware — trả JSON trực tiếp để client đọc được lỗi.
      logger.error("[chatbotController.chat] Error:", error);
      const statusCode = (error as { statusCode?: number })?.statusCode;
      const resetAt = (error as { resetAt?: Date })?.resetAt;
      if (resetAt) res.setHeader("Retry-After", String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))));
      return res.status([403, 409, 429, 503].includes(statusCode || 0) ? statusCode! : 500).json({
        status: "error",
        code: (error as { code?: string })?.code,
        success: false,
        resetAt: resetAt?.toISOString(),
        message: error instanceof Error ? error.message : "Đã xảy ra lỗi khi xử lý yêu cầu trợ lý ảo.",
      });
    }
  },
};
