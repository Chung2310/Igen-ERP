import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { cloudinaryService } from "./cloudinary.service";

dotenv.config();

const KLING_ACCESS_KEY = process.env.KLING_ACCESS_KEY || "";
const KLING_SECRET_KEY = process.env.KLING_SECRET_KEY || "";
const KLING_API_BASE_URL = process.env.KLING_API_BASE_URL || "https://api.klingai.com";

console.log(`[Kling Service] Access Key status: ${KLING_ACCESS_KEY ? `Present (${KLING_ACCESS_KEY.substring(0, 6)}...)` : "Missing"}`);

function generateKlingToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: KLING_ACCESS_KEY, exp: now + 1800, nbf: now - 5 },
    KLING_SECRET_KEY,
    { algorithm: "HS256" }
  );
}

function getKlingHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${generateKlingToken()}`,
  };
}

function mapKlingStatus(status: string): "pending" | "processing" | "completed" | "failed" {
  switch (status) {
    case "succeed": return "completed";
    case "failed": return "failed";
    case "submitted":
    case "waiting":
    case "processing": return "processing";
    default: return "processing";
  }
}

export const klingService = {
  async createMotionControlTask(params: {
    imageUrl: string;
    videoUrl: string;
    modelName?: string;
    prompt?: string;
    characterOrientation?: "video" | "image";
    keepOriginalSound?: boolean;
    mode?: "std" | "pro";
  }): Promise<{ taskId: string }> {
    if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
      throw new Error("Chưa cấu hình KLING_ACCESS_KEY và KLING_SECRET_KEY trong biến môi trường.");
    }

    let finalImageUrl = params.imageUrl;
    let finalVideoUrl = params.videoUrl;

    if (params.imageUrl.startsWith("data:")) {
      console.log("[KlingService] Uploading reference image to Cloudinary...");
      finalImageUrl = await cloudinaryService.uploadMedia(params.imageUrl, "igen_erp/kling/image_refs");
      console.log(`[KlingService] Image uploaded: ${finalImageUrl}`);
    }

    if (params.videoUrl.startsWith("data:")) {
      console.log("[KlingService] Uploading reference video to Cloudinary...");
      finalVideoUrl = await cloudinaryService.uploadMedia(params.videoUrl, "igen_erp/kling/video_refs");
      console.log(`[KlingService] Video uploaded: ${finalVideoUrl}`);
    }

    const body: Record<string, any> = {
      model_name: params.modelName || "kling-v1-5",
      image_url: finalImageUrl,
      video_url: finalVideoUrl,
      character_orientation: params.characterOrientation || "video",
      keep_original_sound: params.keepOriginalSound ?? false,
      mode: params.mode || "pro",
    };

    if (params.prompt) {
      body.prompt = params.prompt;
    }

    console.log("[KlingService] Creating motion control task:", {
      model_name: body.model_name,
      character_orientation: body.character_orientation,
      mode: body.mode,
      keep_original_sound: body.keep_original_sound,
    });

    const response = await fetch(`${KLING_API_BASE_URL}/v1/videos/motion-control`, {
      method: "POST",
      headers: getKlingHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kling API lỗi ${response.status}: ${errorText}`);
    }

    const json: any = await response.json();
    if (json.code !== 0) {
      throw new Error(`Kling API từ chối yêu cầu: ${json.message || JSON.stringify(json)}`);
    }

    const taskId = json.data?.task_id;
    if (!taskId) {
      throw new Error("Kling không trả về task_id hợp lệ");
    }

    console.log(`[KlingService] Motion control task created: ${taskId}`);
    return { taskId };
  },

  async getMotionControlTaskStatus(taskId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed";
    url?: string;
    error?: string;
  }> {
    if (!KLING_ACCESS_KEY || !KLING_SECRET_KEY) {
      throw new Error("Chưa cấu hình KLING_ACCESS_KEY và KLING_SECRET_KEY");
    }

    const response = await fetch(`${KLING_API_BASE_URL}/v1/videos/motion-control/${taskId}`, {
      headers: getKlingHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kling status check lỗi ${response.status}: ${errorText}`);
    }

    const json: any = await response.json();
    if (json.code !== 0) {
      throw new Error(`Kling API lỗi khi kiểm tra trạng thái: ${json.message || JSON.stringify(json)}`);
    }

    const taskData = json.data;
    const klingStatus: string = taskData?.task_status || "processing";
    const mappedStatus = mapKlingStatus(klingStatus);

    if (mappedStatus === "completed") {
      const videos: any[] = taskData?.task_result?.videos || [];
      const url = videos[0]?.url;
      return { status: "completed", url };
    }

    if (mappedStatus === "failed") {
      return { status: "failed", error: taskData?.task_status_msg || "Tạo video Kling thất bại" };
    }

    return { status: mappedStatus };
  },
};
