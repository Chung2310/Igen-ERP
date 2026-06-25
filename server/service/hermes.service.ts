import { AIMediaModel } from "../model/ai-media.model";
import { videoBlueprintService } from "./video-blueprint.service";

/**
 * Chuyển đổi đối tượng JSON blueprint thành mô tả văn bản để hướng dẫn chi tiết cho Hermes Agent
 */
function compileBlueprintToPrompt(blueprint: any): string {
  if (!blueprint || !blueprint.timeline || !Array.isArray(blueprint.timeline)) {
    return "";
  }
  let desc = "\nHãy biên tập video theo kịch bản chính xác sau:\n";
  blueprint.timeline.forEach((item: any, idx: number) => {
    if (item.type === "video") {
      desc += `- Đoạn video nguồn: từ ${item.start}s đến ${item.end}s, tốc độ phát ${item.playbackRate || 1.0}x`;
      if (item.filters) {
        if (item.filters.brightness !== undefined) desc += `, độ sáng: ${item.filters.brightness}`;
        if (item.filters.grayscale !== undefined) desc += `, đen trắng: ${item.filters.grayscale}`;
      }
      if (item.effects) {
        if (item.effects.zoom) desc += `, hiệu ứng zoom: ${item.effects.zoom}`;
        if (item.effects.transition) desc += `, hiệu ứng chuyển cảnh kết thúc: ${item.effects.transition}`;
      }
      desc += "\n";
    } else if (item.type === "text") {
      desc += `- Lớp chữ: hiển thị nội dung "${item.content}" từ giây ${item.start} đến giây ${item.end}`;
      if (item.style) {
        desc += ` tại vị trí ${item.style.position || "bottom-center"} với màu sắc ${item.style.color || "#FFFFFF"} và kích thước ${item.style.fontSize || "32px"}`;
      }
      desc += "\n";
    } else if (item.type === "audio") {
      desc += `- Nhạc/Âm thanh nền: tải từ nguồn "${item.src}" phát từ giây ${item.start} đến giây ${item.end} với âm lượng ${item.volume || 0.5}\n`;
    }
  });
  return desc;
}

/**
 * Base URL của Hermes Worker Pool API (port 8643)
 * POST /submit  → { task_id, status: "queued" }
 * POST /status  → { id, status, result_url, error, ... }
 */
function getWorkerUrl(): string {
  return String(process.env.HERMES_WORKER_URL || "http://103.90.224.34:8643").replace(/\/$/, "");
}

/**
 * Tạo Cloudinary prompt để Hermes tự upload kết quả
 */
function buildCloudinaryPrompt(): string {
  return `
Sau khi hoàn thành chỉnh sửa video, bạn PHẢI tải kết quả lên Cloudinary với thông tin:
- CLOUDINARY_CLOUD_NAME: "${process.env.CLOUDINARY_CLOUD_NAME || ""}"
- CLOUDINARY_API_KEY: "${process.env.CLOUDINARY_API_KEY || ""}"
- CLOUDINARY_API_SECRET: "${process.env.CLOUDINARY_API_SECRET || ""}"

Trả về URL Cloudinary hợp lệ dạng: https://res.cloudinary.com/...
`.trim();
}

/**
 * Poll trạng thái task từ Worker Pool mỗi POLL_INTERVAL ms,
 * tối đa MAX_POLL_ATTEMPTS lần (~10 phút).
 */
const POLL_INTERVAL_MS = 10_000;   // 10 giây
const MAX_POLL_ATTEMPTS = 60;      // 60 × 10s = 10 phút

async function pollTaskStatus(taskId: string): Promise<{ status: string; result_url?: string; error?: string }> {
  const workerUrl = getWorkerUrl();
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`${workerUrl}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
      if (!res.ok) {
        console.warn(`[Hermes Poll] /status HTTP ${res.status}, retry ${i + 1}/${MAX_POLL_ATTEMPTS}`);
        continue;
      }
      const data = await res.json() as { status?: string; result_url?: string; error?: string };
      const status = data.status || "";
      console.log(`[Hermes Poll] task=${taskId} status=${status} attempt=${i + 1}`);
      if (status === "done" || status === "failed") {
        return { status, result_url: data.result_url, error: data.error };
      }
    } catch (err) {
      console.warn(`[Hermes Poll] Lỗi kết nối /status attempt ${i + 1}:`, err);
    }
  }
  return { status: "failed", error: "Timeout: Hermes Worker không hoàn thành sau 10 phút" };
}

export const hermesService = {
  async editVideo(
    userId: string,
    videoUrl: string,
    prompt: string,
    options?: {
      modelName?: string;
      aspectRatio?: string;
      resolution?: string;
      duration?: number;
      videoDurations?: number[];
      blueprint?: any;
    }
  ): Promise<{ status: string; record: any; blueprint: any }> {
    let blueprint = options?.blueprint;
    if (!blueprint) {
      try {
        const videoDuration = options?.duration || 10;
        console.log(`[Hermes] Tự động sinh blueprint cho videoUrl=${videoUrl} duration=${videoDuration}`);
        blueprint = await videoBlueprintService.generateBlueprintFromPrompt(videoUrl, videoDuration, prompt);
      } catch (err) {
        console.warn("[Hermes] Failed to generate blueprint, using empty blueprint fallback:", err);
      }
    }

    const safePrompt = prompt || "";
    // Tạo record ban đầu với trạng thái processing
    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://hermes-worker/${userId}-${Date.now()}`,
      prompt: safePrompt,
      metadata: {
        status: "processing",
        progress: 5,
        provider: "hermes-worker",
        title: `Biên tập bằng Hermes Worker: ${safePrompt}`,
        description: "Đang gửi yêu cầu đến Hermes Worker Pool...",
        blueprint: blueprint ? JSON.stringify(blueprint) : "{}",
        renderLogs: [
          "[Hermes] Khởi tạo yêu cầu biên tập video...",
          `[Hermes] Video đầu vào: ${videoUrl}`,
          `[Hermes] Yêu cầu: ${safePrompt}`,
        ],
        aspectRatio: options?.aspectRatio || "16:9",
        resolution: options?.resolution || "720p",
      },
    });

    // Chạy background job — không await để trả về ngay cho client
    void this.executeHermesWorkerJob(record._id.toString(), userId, videoUrl, prompt, blueprint);

    return { status: "success", record, blueprint };
  },

  async executeHermesWorkerJob(
    recordId: string,
    userId: string,
    videoUrl: string,
    prompt: string,
    blueprint?: any
  ): Promise<void> {
    const workerUrl = getWorkerUrl();
    console.log(`[Hermes Job] Starting for record=${recordId} workerUrl=${workerUrl}`);

    const logs: string[] = [
      "[Hermes] Khởi tạo kết nối với Hermes Worker Pool...",
      `[Hermes] Video đầu vào: ${videoUrl}`,
      `[Hermes] Yêu cầu: ${prompt}`,
    ];

    if (blueprint) {
      logs.push("[Hermes] Đã nhận kịch bản cấu hình JSON Blueprint biên tập.");
    }

    const updateLogs = async (progress: number, description: string, newLog?: string) => {
      if (newLog) {
        console.log(`[Hermes Job] [${progress}%] ${newLog}`);
        logs.push(newLog);
      }
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.progress": progress,
        "metadata.description": description,
        "metadata.renderLogs": [...logs],
      });
    };

    try {
      // ── Bước 1: Submit task ───────────────────────────────────────────────
      await updateLogs(10, "Đang gửi yêu cầu đến Hermes Worker Pool...", "[Hermes] Đang gọi POST /submit...");

      const fullPrompt = `
Bạn là một AI Video Editor chuyên nghiệp tích hợp trong hệ thống Hermes. Nhiệm vụ của bạn là thực hiện các lệnh chỉnh sửa video thô dựa theo kịch bản yêu cầu.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📽️ TÀI NGUYÊN ĐẦU VÀO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Video gốc cần biên tập: ${videoUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 YÊU CẦU BIÊN TẬP CHI TIẾT (KỊCH BẢN CHỈNH SỬA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${prompt}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CÁC NGUYÊN TẮC CẦN TUÂN THỦ TUYỆT ĐỐI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. HIỂU CÁC LỆNH CHỈNH SỬA: Hãy đọc kỹ danh sách các hành động cắt, ghép, phóng to/thu nhỏ (zoom), bộ lọc màu (contrast, brightness, grayscale), chèn chữ (text overlays) và chèn nhạc nền/SFX trong phần yêu cầu biên tập trên.
2. ÁP DỤNG LÊN VIDEO GỐC: Thực thi tất cả các hành động này một cách chính xác lên Video nguồn (${videoUrl}).
3. ĐỒNG BỘ THỜI GIAN: Đảm bảo thời gian xuất hiện (timestamps) của các hiệu ứng chữ, zoom, chuyển cảnh được tính toán và đồng bộ hợp lý theo dòng thời gian của video nguồn.
4. KHÔNG THAY ĐỔI NỘI DUNG KHÔNG ĐƯỢC YÊU CẦU: Giữ nguyên các phần video khác nếu kịch bản không yêu cầu cắt bỏ hay sửa đổi.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☁️ KẾT XUẤT VÀ TẢI LÊN CLOUDINARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildCloudinaryPrompt()}
`.trim();

      const submitRes = await fetch(`${workerUrl}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: videoUrl,
          prompt: fullPrompt,
          user_id: userId,
          blueprint: blueprint || {},
        }),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`Hermes Worker /submit lỗi ${submitRes.status}: ${errText}`);
      }

      const submitData = await submitRes.json() as { task_id?: string; status?: string };
      const taskId = submitData.task_id;

      if (!taskId) {
        throw new Error("Hermes Worker không trả về task_id");
      }

      console.log(`[Hermes Job] Submitted. task_id=${taskId}`);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.hermesTaskId": taskId,
      });

      await updateLogs(
        20,
        `Task đã vào hàng đợi (ID: ${taskId}). Đang xử lý...`,
        `[Hermes] Submit thành công. Task ID: ${taskId}`
      );

      // ── Bước 2: Poll trạng thái ─────────────────────────────────────────
      await updateLogs(25, "Hermes Worker đang xử lý video. Đang chờ kết quả...", "[Hermes] Bắt đầu polling trạng thái task...");

      const pollResult = await pollTaskStatus(taskId);

      // ── Bước 3: Xử lý kết quả ───────────────────────────────────────────
      if (pollResult.status === "done" && pollResult.result_url) {
        await AIMediaModel.findByIdAndUpdate(recordId, {
          url: pollResult.result_url,
          "metadata.status": "completed",
          "metadata.progress": 100,
          "metadata.description": "Video đã được biên tập và upload thành công!",
          "metadata.renderLogs": [
            ...logs,
            `[Hermes] Xử lý hoàn tất!`,
            `[Hermes] Video đã upload lên Cloudinary: ${pollResult.result_url}`,
          ],
        });
        console.log(`[Hermes Job] Completed. URL=${pollResult.result_url}`);
      } else {
        const errMsg = pollResult.error || "Worker không trả về kết quả";
        throw new Error(errMsg);
      }
    } catch (error: any) {
      console.error("[Hermes Job] Failed:", error);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.status": "failed",
        "metadata.progress": 100,
        "metadata.error": error.message || String(error),
        "metadata.description": `Lỗi: ${error.message || String(error)}`,
        "metadata.renderLogs": [
          ...logs,
          `[Hermes] ❌ Lỗi: ${error.message || String(error)}`,
        ],
      });
    }
  },
};
