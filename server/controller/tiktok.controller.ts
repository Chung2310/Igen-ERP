import { Request, Response } from "express";
import { tiktokService } from "../service/tiktok.service";

export const tiktokController = {
  /**
   * POST /api/v1/tiktok/publish
   */
  async publish(req: Request, res: Response) {
    try {
      const { cardId, caption, videoUrl, privacyLevel } = req.body;
      const result = await tiktokService.publishVideo(
        cardId,
        caption,
        videoUrl,
        privacyLevel
      );
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.publish] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý đăng bài lên TikTok",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/tiktok/validate-token
   */
  async validateToken(req: Request, res: Response) {
    try {
      const { username, accessToken } = req.body;
      const result = await tiktokService.validateToken(username, accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.validateToken] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý xác thực token liên kết TikTok qua n8n",
        details: error.message,
      });
    }
  },
};
