import { AIMediaModel } from "../model/ai-media.model";

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
    }
  ): Promise<{ status: string; record: any; blueprint: any }> {
    // Tạo record ban đầu với trạng thái processing
    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://hermes-worker/${userId}-${Date.now()}`,
      prompt,
      metadata: {
        status: "processing",
        progress: 5,
        provider: "hermes-worker",
        title: `Biên tập bằng Hermes Worker: ${prompt}`,
        description: "Đang gửi yêu cầu đến Hermes Worker Pool...",
        blueprint: "{}",
        renderLogs: [
          "[Hermes] Khởi tạo yêu cầu biên tập video...",
          `[Hermes] Video đầu vào: ${videoUrl}`,
          `[Hermes] Yêu cầu: ${prompt}`,
        ],
        aspectRatio: options?.aspectRatio || "16:9",
        resolution: options?.resolution || "720p",
      },
    });

    // Chạy background job — không await để trả về ngay cho client
    void this.executeHermesWorkerJob(record._id.toString(), userId, videoUrl, prompt);

    return { status: "success", record, blueprint: null };
  },

  async executeHermesWorkerJob(
    recordId: string,
    userId: string,
    videoUrl: string,
    prompt: string
  ): Promise<void> {
    const workerUrl = getWorkerUrl();
    console.log(`[Hermes Job] Starting for record=${recordId} workerUrl=${workerUrl}`);

    const logs: string[] = [
      "[Hermes] Khởi tạo kết nối với Hermes Worker Pool...",
      `[Hermes] Video đầu vào: ${videoUrl}`,
      `[Hermes] Yêu cầu: ${prompt}`,
    ];

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
