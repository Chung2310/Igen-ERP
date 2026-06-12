import dotenv from "dotenv";
import { cloudinaryService } from "./cloudinary.service";

dotenv.config();

const PIAPI_API_KEY = process.env.PIAPI_API_KEY || "";
const PIAPI_BASE_URL = "https://api.piapi.ai/api/v1";

console.log(`[PiAPI Service] Loaded API Key status: ${PIAPI_API_KEY ? `Present (Length: ${PIAPI_API_KEY.length}, Prefix: ${PIAPI_API_KEY.substring(0, 8)}...)` : 'Missing'}`);

export const piapiService = {
  /**
   * Sinh ảnh bằng PiAPI (Midjourney, Flux, v.v.)
   */
  async generateImage(
    prompt: string,
    model: string,
    options?: { aspectRatio?: string }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Image Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      const seed = Math.floor(Math.random() * 1000000);
      return { url: `https://picsum.photos/seed/${seed}/1024/1024`, isMock: true };
    }

    const aspect = options?.aspectRatio || "1:1";
    let reqBody: any;

    if (model === "nano-banana-pro" || model === "nano-banana-2") {
      reqBody = {
        model: "gemini",
        task_type: model,
        input: {
          prompt,
          output_format: "png",
          aspect_ratio: aspect,
          resolution: "1K",
        },
      };
    } else {
      let piapiModel = model.replace("piapi-", "");
      if (piapiModel === "flux") {
        piapiModel = "Qubico/flux1-dev";
      }
      reqBody = {
        model: piapiModel,
        task_type: piapiModel === "midjourney" ? "imagine" : "text2img",
        input: {
          prompt,
          aspect_ratio: aspect,
        },
      };
    }

    try {
      console.log(`[PiAPI Image Generation] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }

      const json: any = await response.json();
      console.log(`[PiAPI Image Generation] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Không nhận được task_id từ PiAPI");
      }

      console.log(`[PiAPI Image Generation] Task created: ${taskId}. Polling for completion...`);

      let attempts = 0;
      const maxAttempts = 30; // 5 minutes
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const pollResponse = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
          headers: { "x-api-key": PIAPI_API_KEY },
        });

        if (pollResponse.ok) {
          const pollJson: any = await pollResponse.json();
          const task = pollJson.data;
          console.log(`[PiAPI Image Generation] Task ${taskId} poll result:`, JSON.stringify(pollJson, null, 2));

          if (task?.status === "completed") {
            const url = (task.output?.image_urls && task.output.image_urls[0]) || task.output?.image_url || task.output?.url;
            if (!url) {
              throw new Error("Tác vụ hoàn thành nhưng không nhận được URL hình ảnh.");
            }
            return { url, isMock: false };
          } else if (task?.status === "failed") {
            throw new Error(`PiAPI task failed: ${task.error || "Lỗi không xác định"}`);
          }
        }
        attempts++;
      }

      throw new Error("Quá thời gian chờ tạo ảnh từ PiAPI");
    } catch (error: any) {
      console.error("[PiAPI Image Generation] Error:", error);
      throw error;
    }
  },

  /**
   * Sinh video bằng PiAPI (Kling, Luma, v.v. và Veo 3.1)
   */
  async generateVideo(
    prompt: string,
    model: string,
    durationSeconds: number = 5,
    options?: { aspectRatio?: string; referenceImageUris?: string[] }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Video Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      return { url: "https://www.w3schools.com/html/mov_bbb.mp4", isMock: true };
    }

    const aspect = options?.aspectRatio || "16:9";
    const piapiModel = model.replace("piapi-", "");

    let reqBody: any;

    if (piapiModel.includes("veo31") || piapiModel.includes("veo-3.1") || piapiModel.startsWith("veo3")) {
      let taskType = "veo3.1-video-fast";
      let generateAudio = true;

      if (piapiModel === "veo31-video-audio") {
        taskType = "veo3.1-video";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = true;
      } else if (piapiModel === "veo31-video-fast-no-audio") {
        taskType = "veo3.1-video-fast";
        generateAudio = false;
      }

      // Check for reference image (Image to Video)
      let imageUrl: string | undefined = undefined;
      if (options?.referenceImageUris && options.referenceImageUris.length > 0) {
        const firstImage = options.referenceImageUris[0];
        if (firstImage) {
          if (firstImage.startsWith("data:")) {
            try {
              console.log("[PiAPI Video Generation] Uploading reference image to Cloudinary...");
              imageUrl = await cloudinaryService.uploadMedia(firstImage, "igen_erp/video_refs");
              console.log(`[PiAPI Video Generation] Reference image uploaded: ${imageUrl}`);
            } catch (err) {
              console.error("[PiAPI Video Generation] Failed to upload reference image to Cloudinary:", err);
              imageUrl = firstImage; // Fallback
            }
          } else {
            imageUrl = firstImage;
          }
        }
      }

      reqBody = {
        model: "veo3.1",
        task_type: taskType,
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: `${durationSeconds}s`,
          generate_audio: generateAudio,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      };
    } else {
      reqBody = {
        model: piapiModel,
        task_type: "video_generation",
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: durationSeconds,
        },
      };
    }

    try {
      console.log(`[PiAPI Video Generation] Requesting task for model ${model}. Body:`, JSON.stringify(reqBody, null, 2));
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify(reqBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }

      const json: any = await response.json();
      console.log(`[PiAPI Video Generation] Task creation response:`, JSON.stringify(json, null, 2));
      const taskId = json.data?.task_id;
      if (!taskId) {
        throw new Error("Không nhận được task_id từ PiAPI");
      }

      console.log(`[PiAPI Video Generation] Task created: ${taskId}. Polling for completion...`);

      let attempts = 0;
      const maxAttempts = 60; // 10 minutes
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const pollResponse = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
          headers: { "x-api-key": PIAPI_API_KEY },
        });

        if (pollResponse.ok) {
          const pollJson: any = await pollResponse.json();
          const task = pollJson.data;
          console.log(`[PiAPI Video Generation] Task ${taskId} poll result:`, JSON.stringify(pollJson, null, 2));

          if (task?.status === "completed") {
            const url = task.output?.video || task.output?.video_url || task.output?.url;
            if (!url) {
              throw new Error("Tác vụ hoàn thành nhưng không nhận được URL video.");
            }
            return { url, isMock: false };
          } else if (task?.status === "failed") {
            throw new Error(`PiAPI task failed: ${task.error || "Lỗi không xác định"}`);
          }
        }
        attempts++;
      }

      throw new Error("Quá thời gian chờ tạo video từ PiAPI");
    } catch (error: any) {
      console.error("[PiAPI Video Generation] Error:", error);
      throw error;
    }
  },
};
