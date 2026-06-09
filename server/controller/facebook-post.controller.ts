import { Request, Response } from "express";
import { facebookPostService } from "../service/facebook-post.service";

export const facebookPostController = {
  /**
   * POST /api/v1/facebook/publish
   */
  async publish(req: Request, res: Response) {
    try {
      const { content, imageUrl, videoUrl, pageId, accessToken } = req.body;
      const result = await facebookPostService.publishToPage(
        content,
        imageUrl,
        videoUrl,
        pageId,
        accessToken
      );
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[facebookPostController.publish] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý đăng bài lên Facebook qua n8n",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/facebook/validate-token
   */
  async validateToken(req: Request, res: Response) {
    try {
      const { pageId, accessToken } = req.body;
      const result = await facebookPostService.validateToken(pageId, accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[facebookPostController.validateToken] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý xác thực token liên kết Facebook qua n8n",
        details: error.message,
      });
    }
  },
};
