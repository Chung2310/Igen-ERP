import { Request, Response } from "express";
import { heygenService } from "../service/heygen.service";

function getErrorStatus(error: any) {
  const statusCode = Number(error?.statusCode);
  if (statusCode >= 400 && statusCode < 500) {
    return statusCode;
  }
  return 500;
}

export const heygenController = {
  async getLibrary(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json(await heygenService.getLibrary(userId));
    } catch (error: any) {
      console.error("[heygenController.getLibrary] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Khong the lay thu vien HeyGen", details: error.message });
    }
  },

  async createAvatarVideo(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json(await heygenService.createAvatarVideo(userId, req.body));
    } catch (error: any) {
      console.error("[heygenController.createAvatarVideo] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Loi tao video avatar HeyGen", details: error.message });
    }
  },

  async getVideoStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json(await heygenService.getVideoStatus(userId, req.params.videoId, req.body));
    } catch (error: any) {
      console.error("[heygenController.getVideoStatus] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Loi lay trang thai video HeyGen", details: error.message });
    }
  },

  async getVideoHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json({ status: "success", history: await heygenService.getVideoHistory(userId) });
    } catch (error: any) {
      console.error("[heygenController.getVideoHistory] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Loi lay lich su video HeyGen", details: error.message });
    }
  },

  async deleteVideoHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json(await heygenService.deleteVideoHistory(userId, req.params.id));
    } catch (error: any) {
      console.error("[heygenController.deleteVideoHistory] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Loi xoa lich su video HeyGen", details: error.message });
    }
  },

  async receiveWebhook(req: Request, res: Response) {
    try {
      const token = String(
        req.headers["x-heygen-webhook-secret"] ||
        req.headers["x-webhook-token"] ||
        req.query.token ||
        ""
      );

      if (!heygenService.verifyWebhookToken(token)) {
        return res.status(401).json({ status: "error", message: "Webhook token khong hop le" });
      }

      const result = await heygenService.processWebhook(req.body);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[heygenController.receiveWebhook] Error:", error);
      return res.status(getErrorStatus(error)).json({ status: "error", message: "Loi xu ly webhook HeyGen", details: error.message });
    }
  },
};
