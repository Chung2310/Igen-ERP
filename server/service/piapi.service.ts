import dotenv from "dotenv";
import { cloudinaryService } from "./cloudinary.service";

dotenv.config();

const PIAPI_API_KEY = process.env.PIAPI_API_KEY || "";
const PIAPI_BASE_URL = "https://api.piapi.ai/api/v1";

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
      throw new Error("Chưa cấu hình PIAPI_API_KEY. Không thể sinh ảnh.");
    }

    const aspect = options?.aspectRatio || "1:1";
    const piapiModel = model.replace("piapi-", "");

    try {
      console.log(`[PiAPI Image Generation] Requesting task for model ${piapiModel}...`);
      const response = await fetch(`${PIAPI_BASE_URL}/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": PIAPI_API_KEY,
        },
        body: JSON.stringify({
          model: piapiModel,
          task_type: piapiModel === "midjourney" ? "imagine" : "text2img",
          input: {
            prompt,
            aspect_ratio: aspect,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
      }

      const json: any = await response.json();
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
          console.log(`[PiAPI Image Generation] Task ${taskId} status: ${task?.status}`);

          if (task?.status === "completed") {
            const url = task.output?.image_url || task.output?.url;
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
   * Sinh video bằng PiAPI (Kling, Luma, v.v.)
   */
  async createVideoTask(
    prompt: string,
    model: string,
    durationSeconds: number = 5,
    options?: { aspectRatio?: string; referenceImageUris?: string[] }
  ): Promise<{ taskId: string }> {
    if (!PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY");
    }

    const aspect = options?.aspectRatio || "16:9";
    const piapiModel = model.replace("piapi-", "");

    let imageUrl: string | undefined;
    if (options?.referenceImageUris && options.referenceImageUris.length > 0) {
      const firstUri = options.referenceImageUris[0];
      if (firstUri.startsWith("data:")) {
        try {
          imageUrl = await cloudinaryService.uploadMedia(firstUri, "piapi_temp_inputs");
        } catch (uploadError) {
          console.error("[PiAPI Video Generation] Failed to upload reference image to Cloudinary:", uploadError);
        }
      } else {
        imageUrl = firstUri;
      }
    }

    const response = await fetch(`${PIAPI_BASE_URL}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PIAPI_API_KEY,
      },
      body: JSON.stringify({
        model: piapiModel,
        task_type: "video_generation",
        input: {
          prompt,
          aspect_ratio: aspect,
          duration: durationSeconds,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PiAPI task creation failed: ${response.status} - ${errorText}`);
    }

    const json: any = await response.json();
    const taskId = json.data?.task_id;
    if (!taskId) {
      throw new Error("Không nhận được task_id từ PiAPI");
    }

    return { taskId };
  },

  async getTaskStatus(
    taskId: string
  ): Promise<{ status: "pending" | "processing" | "completed" | "failed"; url?: string; progress?: number; error?: string }> {
    if (!PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY");
    }

    const pollResponse = await fetch(`${PIAPI_BASE_URL}/task/${taskId}`, {
      headers: { "x-api-key": PIAPI_API_KEY },
    });

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      throw new Error(`PiAPI task polling failed: ${pollResponse.status} - ${errorText}`);
    }

    const pollJson: any = await pollResponse.json();
    const task = pollJson.data;

    return {
      status: task?.status || "processing",
      url: task?.output?.video_url || task?.output?.url,
      progress: typeof task?.progress === "number" ? task.progress : (task?.status === "completed" ? 100 : 0),
      error: task?.error || "",
    };
  },

  /**
   * Sinh video bằng PiAPI (Kling, Luma, v.v.)
   */
  async generateVideo(
    prompt: string,
    model: string,
    durationSeconds: number = 5,
    options?: { aspectRatio?: string; referenceImageUris?: string[] }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY. Không thể sinh video.");
    }

    try {
      const { taskId } = await this.createVideoTask(prompt, model, durationSeconds, options);
      console.log(`[PiAPI Video Generation] Task created: ${taskId}. Polling for completion...`);

      let attempts = 0;
      const maxAttempts = 60; // 10 minutes
      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const result = await this.getTaskStatus(taskId);
        console.log(`[PiAPI Video Generation] Task ${taskId} status: ${result.status}`);

        if (result.status === "completed") {
          if (!result.url) {
            throw new Error("Tác vụ hoàn thành nhưng không nhận được URL video.");
          }
          return { url: result.url, isMock: false };
        } else if (result.status === "failed") {
          throw new Error(`PiAPI task failed: ${result.error || "Lỗi không xác định"}`);
        }
        attempts++;
      }

      throw new Error("Quá thời gian chờ tạo video từ PiAPI");
    } catch (error: any) {
      console.error("[PiAPI Video Generation] Error:", error);
      throw error;
    }
  },

  /**
   * Gọi Chat Completions API của PiAPI (OpenAI-compatible)
   */
  async chatCompletions(
    messages: any[],
    model: string = "gpt-4o-mini",
    responseFormat?: any
  ): Promise<any> {
    if (!PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY");
    }

    const body: any = {
      model,
      messages,
      stream: false,
    };
    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const response = await fetch("https://api.piapi.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": PIAPI_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PiAPI Chat Completions failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  },
};
