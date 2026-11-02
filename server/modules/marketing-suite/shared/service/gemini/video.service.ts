/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
import { AIMediaModel } from "../../model/ai-media.model.ts";
import { cloudinaryService } from "../cloudinary.service.ts";
import { openrouterVideoService } from "../openrouter-video.service.ts";
import { safeParseJson } from "./core";

export class GeminiVideoService {

  async generateVideo(
    prompt: string,
    durationSeconds: number = 6,
    options?: {
      aspectRatio?: string;
      modelName?: string;
      resolution?: string;
      referenceVideoUri?: string;
      referenceImageUris?: string[];
      frameMode?: "standard" | "first_last";
    }
  ): Promise<{ url: string; isMock: boolean }> {
    let actualPrompt = prompt;
    try {
      const parsed = safeParseJson(prompt);
      if (parsed.optimized_english_prompt) {
        actualPrompt = parsed.optimized_english_prompt;
        if (parsed.motion_analysis) actualPrompt += `. Motion: ${parsed.motion_analysis}`;
        if (parsed.camera_movement) actualPrompt += `. Camera: ${parsed.camera_movement}`;
      }
    } catch (e) {
      // not JSON, use as is
    }

    const { jobId } = await openrouterVideoService.createVideoTask(
      actualPrompt,
      options?.modelName,
      durationSeconds,
      {
        aspectRatio: options?.aspectRatio,
        resolution: options?.resolution,
        referenceImageUris: options?.referenceImageUris,
        frameMode: options?.frameMode,
      }
    );
    return { url: `pending://openrouter/${jobId}`, isMock: false, jobId } as any;
  }

  async getOpenRouterVideoTaskStatus(jobId: string) {
    return openrouterVideoService.getTaskStatus(jobId);
  }

  /**
   * Poll trạng thái video OpenRouter và lưu file hoàn chỉnh lên Cloudinary.
   */
  async pollOpenRouterVideoStatusBackground(recordId: string, jobId: string, userId: string) {
    console.log(`[OpenRouter Video Poll] Started for record ${recordId}, job ${jobId}`);

    let attempts = 0;
    const maxAttempts = 60;

    const runPoll = async () => {
      try {
        const result = await openrouterVideoService.getTaskStatus(jobId);
        console.log(`[OpenRouter Video Poll] Record ${recordId} status: ${result.status}`);

        if (result.status === "completed") {
          const videoBuffer = await openrouterVideoService.downloadVideo(jobId, result.unsignedUrl);
          const cloudinaryUrl = await cloudinaryService.uploadMediaBuffer(
            videoBuffer,
            "igen_erp/marketing/video",
            `openrouter_${jobId}`
          );
          const record = await AIMediaModel.findByIdAndUpdate(
            recordId,
            { url: cloudinaryUrl, "metadata.status": "completed", "metadata.progress": 100 },
            { new: true }
          );

          const activeCardId = record?.metadata?.activeCardId;
          if (activeCardId) {
            const { MarketingContentModel } = require("../../../campaign/model/marketing-content.model.ts");
            await MarketingContentModel.findByIdAndUpdate(activeCardId, { videoUrl: cloudinaryUrl });
          }
          return;
        }

        if (result.status === "failed") {
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.status": "failed",
            "metadata.error": result.error || "Lỗi tạo video từ OpenRouter",
            "metadata.progress": 0,
          });
          return;
        }

        const currentProgress = typeof result.progress === "number" && result.progress > 0
          ? result.progress
          : Math.min(5 + attempts * 7, 95);
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.progress": currentProgress,
        });

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(runPoll, 10000);
        } else {
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.status": "timeout",
            "metadata.error": "Quá thời gian chờ tạo video từ OpenRouter (10 phút)",
          });
        }
      } catch (error) {
        console.error(`[OpenRouter Video Poll] Error polling job ${jobId}:`, error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(runPoll, 10000);
        } else {
          await AIMediaModel.findByIdAndUpdate(recordId, {
            "metadata.status": "timeout",
            "metadata.error": "Không thể nhận kết quả video từ OpenRouter sau nhiều lần thử.",
          });
        }
      }
    };

    setTimeout(runPoll, 10000);
  }
}

export const geminiVideoService = new GeminiVideoService();
