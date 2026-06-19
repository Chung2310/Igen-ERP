import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { tiktokService } from "../service/tiktok.service";

export const tiktokController = {
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
        message: "Loi ket noi hoac xu ly dang bai len TikTok",
        details: error.message,
      });
    }
  },

  async validateToken(req: Request, res: Response) {
    try {
      const { username, accessToken } = req.body;
      const result = await tiktokService.validateToken(username, accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.validateToken] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Loi xac thuc token TikTok",
        details: error.message,
      });
    }
  },

  async getCreatorInfo(req: Request, res: Response) {
    try {
      const { accessToken } = req.body;
      const result = await tiktokService.getCreatorInfo(accessToken);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.getCreatorInfo] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Loi lay thong tin creator TikTok",
        details: error.message,
      });
    }
  },

  async getBlotatoAccounts(req: Request, res: Response) {
    try {
      void req;
      const result = await tiktokService.getBlotatoAccounts();
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.getBlotatoAccounts] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Loi truy van thong tin TikTok",
        details: error.message,
      });
    }
  },

  async receiveWebhook(req: Request, res: Response) {
    try {
      const token = String(
        req.headers["x-tiktok-webhook-secret"] || req.headers["x-webhook-token"] || req.query.token || ""
      );

      if (!tiktokService.verifyWebhookToken(token)) {
        return res.status(401).json({
          status: "error",
          message: "Webhook token khong hop le",
        });
      }

      const result = await tiktokService.processWebhook(req.body);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[tiktokController.receiveWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Loi xu ly webhook TikTok",
        details: error.message,
      });
    }
  },
};
