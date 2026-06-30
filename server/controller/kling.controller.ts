import { Request, Response } from "express";
import { klingService } from "../service/kling.service";
import { AIMediaModel } from "../model/ai-media.model";
import { cloudinaryService } from "../service/cloudinary.service";
import { walletService } from "../service/wallet.service";
import { broadcastEvent } from "../socket";

const KLING_MOTION_COST = 500;

async function pollKlingMotionBackground(recordId: string, taskId: string, userId: string) {
  console.log(`[Kling BG Poll] Started — record: ${recordId}, taskId: ${taskId}`);

  let attempts = 0;
  const maxAttempts = 72; // 72 * 10s ≈ 12 phút

  const runPoll = async () => {
    try {
      const result = await klingService.getMotionControlTaskStatus(taskId);
      console.log(`[Kling BG Poll] Record ${recordId} status: ${result.status}`);

      if (result.status === "completed" && result.url) {
        console.log("[Kling BG Poll] Hoàn thành — đang lưu lên Cloudinary...");
        const cloudinaryUrl = await cloudinaryService.uploadMedia(result.url, "igen_erp/kling/output");

        await AIMediaModel.findByIdAndUpdate(recordId, {
          url: cloudinaryUrl,
          "metadata.status": "completed",
          "metadata.progress": 100,
        });

        broadcastEvent("kling:motion-control:completed", { recordId, userId, url: cloudinaryUrl });
        console.log(`[Kling BG Poll] Lưu thành công: ${cloudinaryUrl}`);
        return;
      }

      if (result.status === "failed") {
        console.error(`[Kling BG Poll] Failed: ${result.error}`);
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.status": "failed",
          "metadata.error": result.error || "Tạo video Kling Motion Control thất bại",
          "metadata.progress": 0,
        });
        return;
      }

      const estimatedProgress = Math.min(5 + attempts * 5, 92);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.progress": estimatedProgress,
      });

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(runPoll, 10000);
      } else {
        console.error(`[Kling BG Poll] Timeout — taskId: ${taskId}`);
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.status": "timeout",
          "metadata.error": "Quá thời gian chờ tạo video Kling (12 phút)",
        });
      }
    } catch (error: any) {
      console.error(`[Kling BG Poll] Lỗi polling task ${taskId}:`, error.message);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(runPoll, 10000);
      }
    }
  };

  setTimeout(runPoll, 10000);
}

export const klingController = {
  /**
   * POST /api/v1/kling/motion-control
   */
  async createMotionControl(req: Request, res: Response) {
    try {
      const { imageUrl, videoUrl, modelName, prompt, characterOrientation, keepOriginalSound } = req.body;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Yêu cầu đăng nhập" });
      }

      await walletService.checkBalance(userId, KLING_MOTION_COST);

      const { taskId } = await klingService.createMotionControlTask({
        imageUrl,
        videoUrl,
        modelName,
        prompt,
        characterOrientation,
        keepOriginalSound,
      });

      const pendingUrl = `pending://kling/${taskId}`;
      const record = await AIMediaModel.create({
        userId,
        mediaType: "video",
        url: pendingUrl,
        prompt: prompt || "Kling Motion Control",
        metadata: {
          provider: "kling",
          status: "processing",
          progress: 1,
          piapiTaskId: taskId,
          title: "Motion Control Video",
          description: `Kling motion control — model: ${modelName || "kling-v1-5"}`,
        },
      });

      pollKlingMotionBackground(record._id.toString(), taskId, userId);

      await walletService.deductBalance(userId, KLING_MOTION_COST, "Chi phí Kling Motion Control");

      return res.status(200).json({
        status: "success",
        url: pendingUrl,
        taskId,
        record,
      });
    } catch (error: any) {
      console.error("[klingController.createMotionControl] Error:", error.message);
      return res.status(500).json({
        status: "error",
        message: error.message || "Lỗi tạo Kling Motion Control",
      });
    }
  },
};
