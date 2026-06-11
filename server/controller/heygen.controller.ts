import { Request, Response } from "express";
import { geminiService } from "../service/gemini.service";
import { heygenService } from "../service/heygen.service";

export const heygenController = {
  async getLibrary(req: Request, res: Response) {
    try {
      return res.status(200).json(await heygenService.getLibrary());
    } catch (error: any) {
      console.error("[heygenController.getLibrary] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the lay thu vien HeyGen", details: error.message });
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
      return res.status(500).json({ status: "error", message: "Loi tao video avatar HeyGen", details: error.message });
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
      return res.status(500).json({ status: "error", message: "Loi lay trang thai video HeyGen", details: error.message });
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
      return res.status(500).json({ status: "error", message: "Loi lay lich su video HeyGen", details: error.message });
    }
  },

  async deleteVideoHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      return res.status(200).json(await geminiService.deleteMediaHistory(userId, req.params.id));
    } catch (error: any) {
      console.error("[heygenController.deleteVideoHistory] Error:", error);
      return res.status(500).json({ status: "error", message: "Loi xoa lich su video HeyGen", details: error.message });
    }
  },
};
