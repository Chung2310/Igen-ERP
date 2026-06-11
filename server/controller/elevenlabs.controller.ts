import { Request, Response } from "express";
import { geminiService } from "../service/gemini.service";
import { elevenlabsService } from "../service/elevenlabs.service";

export const elevenlabsController = {
  async generateVoice(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      const result = await elevenlabsService.generateVoice(userId, req.body);
      if ((result as any)?.preview) {
        return res.status(200).json({ status: "success", url: (result as any).url, preview: true });
      }
      return res.status(200).json({ status: "success", record: result });
    } catch (error: any) {
      console.error("[elevenlabsController.generateVoice] Error:", error);
      return res.status(500).json({ status: "error", message: "Loi tao giong noi ElevenLabs", details: error.message });
    }
  },

  async getVoiceHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      const history = await geminiService.getMediaHistory(userId, "voice");
      return res.status(200).json({ status: "success", history });
    } catch (error: any) {
      console.error("[elevenlabsController.getVoiceHistory] Error:", error);
      return res.status(500).json({ status: "error", message: "Loi lay lich su voice", details: error.message });
    }
  },

  async deleteVoiceHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yeu cau dang nhap" });
      }
      const result = await geminiService.deleteMediaHistory(userId, req.params.id);
      return res.status(200).json(result);
    } catch (error: any) {
      console.error("[elevenlabsController.deleteVoiceHistory] Error:", error);
      return res.status(500).json({ status: "error", message: "Loi xoa lich su voice", details: error.message });
    }
  },

  async getVoices(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.getVoices());
    } catch (error: any) {
      console.error("[elevenlabsController.getVoices] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the lay danh sach giong noi ElevenLabs", details: error.message });
    }
  },

  async getVoice(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.getVoice(req.params.voiceId));
    } catch (error: any) {
      console.error("[elevenlabsController.getVoice] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the lay chi tiet voice ElevenLabs", details: error.message });
    }
  },

  async getModels(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.getModels());
    } catch (error: any) {
      console.error("[elevenlabsController.getModels] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the lay danh sach model ElevenLabs", details: error.message });
    }
  },

  async getVoiceSettings(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.getVoiceSettings(req.params.voiceId));
    } catch (error: any) {
      console.error("[elevenlabsController.getVoiceSettings] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the lay voice settings ElevenLabs", details: error.message });
    }
  },

  async updateVoiceSettings(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.updateVoiceSettings(req.params.voiceId, req.body));
    } catch (error: any) {
      console.error("[elevenlabsController.updateVoiceSettings] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the cap nhat voice settings ElevenLabs", details: error.message });
    }
  },

  async generateCustomVoicePreview(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.generateCustomVoicePreview(req.body));
    } catch (error: any) {
      console.error("[elevenlabsController.generateCustomVoicePreview] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the thiet ke giong noi thu nghiem", details: error.message });
    }
  },

  async createCustomVoice(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.createCustomVoice(req.body));
    } catch (error: any) {
      console.error("[elevenlabsController.createCustomVoice] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the luu giong noi ca nhan vao ElevenLabs", details: error.message });
    }
  },

  async addVoice(req: Request, res: Response) {
    try {
      const { name, description, files, userId } = req.body;
      return res.status(200).json(await elevenlabsService.addVoice(name, description, files, userId));
    } catch (error: any) {
      console.error("[elevenlabsController.addVoice] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the nhan ban giong noi ElevenLabs", details: error.message });
    }
  },

  async deleteVoice(req: Request, res: Response) {
    try {
      return res.status(200).json(await elevenlabsService.deleteVoice(req.params.voiceId));
    } catch (error: any) {
      console.error("[elevenlabsController.deleteVoice] Error:", error);
      return res.status(500).json({ status: "error", message: "Khong the xoa giong noi ElevenLabs", details: error.message });
    }
  },
};
