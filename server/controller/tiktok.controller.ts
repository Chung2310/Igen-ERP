import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { tiktokService } from "../service/tiktok.service";

export const tiktokController = {
  /**
   * POST /api/v1/tiktok/publish
   * Đăng video lên TikTok.
   * Ưu tiên: Blotato API -> TikTok Direct API
   */
  async publish(req: Request, res: Response) {
    try {
      const authReq = req as AuthenticatedRequest;
      const companyCode = authReq.user?.companyCode;

      const {
        cardId,
        caption,
        videoUrl,
        privacyLevel,
        accessToken,
        username,
        scheduledTime,
        blotatoAccountId,
        blotatoApiKey,
        integrationId,
      } = req.body;

      const result = await tiktokService.publishVideo(
        cardId,
        caption,
        videoUrl,
        privacyLevel,
        accessToken,
        username,
        scheduledTime,
        blotatoAccountId,
        blotatoApiKey,
        integrationId,
        companyCode
      );

      await tiktokService.registerPublishTracking(cardId, result);

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
   * Xác thực kết nối TikTok (Blotato -> Direct -> n8n)
   */
  async validateToken(req: Request, res: Response) {
    try {
      const { username, accessToken, blotatoApiKey } = req.body;
      const result = await tiktokService.validateToken(username, accessToken, blotatoApiKey);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.validateToken] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xác thực token TikTok",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/tiktok/creator-info
   * Lấy thông tin creator từ TikTok Direct API (cần accessToken)
   */
  async getCreatorInfo(req: Request, res: Response) {
    try {
      const { accessToken } = req.body;
      const result = await tiktokService.getCreatorInfo(accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.getCreatorInfo] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi lấy thông tin creator TikTok",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/tiktok/blotato-accounts
   * Lấy danh sách tài khoản TikTok đã kết nối trên Blotato
   * (để lấy accountId cần thiết cho BLOTATO_TIKTOK_ACCOUNT_ID)
   */
  async getBlotatoAccounts(req: Request, res: Response) {
    try {
      const { blotatoApiKey } = req.query;
      const result = await tiktokService.getBlotatoAccounts(blotatoApiKey as string);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.getBlotatoAccounts] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi lấy danh sách tài khoản TikTok từ Blotato",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/tiktok/webhook
   * Nhận callback từ TikTok hoặc middleware tích hợp.
   */
  async receiveWebhook(req: Request, res: Response) {
    try {
      const token = String(
        req.headers["x-tiktok-webhook-secret"] ||
          req.headers["x-webhook-token"] ||
          req.query.token ||
          ""
      );

      if (!tiktokService.verifyWebhookToken(token)) {
        return res.status(401).json({
          status: "error",
          message: "Webhook token không hợp lệ",
        });
      }

      const result = await tiktokService.processWebhook(req.body);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.receiveWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xử lý webhook TikTok",
        details: error.message,
      });
    }
  },
};
