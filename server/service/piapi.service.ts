import dotenv from "dotenv";

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
      console.log(`[PiAPI Image Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      const seed = Math.floor(Math.random() * 1000000);
      return { url: `https://picsum.photos/seed/${seed}/1024/1024`, isMock: true };
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
  async generateVideo(
    prompt: string,
    model: string,
    durationSeconds: number = 5,
    options?: { aspectRatio?: string }
  ): Promise<{ url: string; isMock: boolean }> {
    if (!PIAPI_API_KEY) {
      console.log(`[PiAPI Video Generation] Running in MOCK mode (No PIAPI_API_KEY). Model: ${model}`);
      return { url: "https://www.w3schools.com/html/mov_bbb.mp4", isMock: true };
    }

    const aspect = options?.aspectRatio || "16:9";
    const piapiModel = model.replace("piapi-", "");

    try {
      console.log(`[PiAPI Video Generation] Requesting task for model ${piapiModel}...`);
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
          console.log(`[PiAPI Video Generation] Task ${taskId} status: ${task?.status}`);

          if (task?.status === "completed") {
            const url = task.output?.video_url || task.output?.url;
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
