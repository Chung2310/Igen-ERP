/**
 * Claude Render Service
 * ─────────────────────
 * Gọi Claude Render Server trên VPS (hoàn toàn độc lập với Hermes).
 * VPS server dùng Anthropic Claude API để sinh HTML+GSAP → HyperFrames → FFmpeg → Cloudinary.
 *
 * Env vars:
 *   CLAUDE_RENDER_VPS_URL  — URL của VPS server (default: http://103.90.224.34:8644)
 *   CLAUDE_RENDER_API_KEY  — API key để xác thực (default: igen-render-2024)
 */

import { AIMediaModel } from "../../model/ai-media.model";
import { broadcastEvent } from "../../socket";

function getServerUrl(): string {
  return String(process.env.CLAUDE_RENDER_VPS_URL || "http://103.90.224.34:8644").replace(/\/$/, "");
}

function getApiKey(): string {
  return process.env.CLAUDE_RENDER_API_KEY || "igen-render-2024";
}

const POLL_INTERVAL_MS = 12_000;
const MAX_POLLS = 200; // 200 × 12s = 40 phút

async function pollJobStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const url = getServerUrl();
  const key = getApiKey();

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`${url}/status/${taskId}`, {
        headers: { "X-API-Key": key },
      });
      if (!res.ok) continue;
      const data = await res.json() as {
        status?: string; result_url?: string; error?: string;
      };
      const s = data.status || "";
      if (s === "done" || s === "failed") return { status: s, result_url: data.result_url, error: data.error };
    } catch {
      // retry
    }
  }
  return { status: "failed", error: "Timeout: Claude Render không hoàn thành sau 40 phút" };
}

export type ClaudeRenderOptions = {
  facecamUrl: string;
  outline: string;
  scenes?: string[];
  brandName?: string;
  bgMusicUrl?: string;
  webhookUrl?: string;
};

export const claudeRenderService = {
  async renderVideo(
    userId: string,
    options: ClaudeRenderOptions
  ): Promise<{ status: string; record: any }> {
    const {
      facecamUrl, outline, scenes,
      brandName = "iGen Tech", bgMusicUrl = "", webhookUrl = "",
    } = options;

    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://claude-render/${userId}-${Date.now()}`,
      prompt: outline,
      metadata: {
        status: "processing",
        progress: 5,
        provider: "claude-render",
        title: `Professional Video: ${outline.slice(0, 60)}`,
        description: "Claude đang tạo video chuyên nghiệp (HTML+GSAP → HyperFrames → FFmpeg)...",
        renderLogs: [
          "[Claude Render] Khởi tạo pipeline...",
          `[Claude Render] Facecam: ${facecamUrl}`,
          `[Claude Render] Scenes: ${(scenes || ["hook","story","insight","pipeline","before_after","cta"]).join(", ")}`,
        ],
        aspectRatio: "16:9",
        resolution: "720p",
      },
    });

    void this._run(record._id.toString(), userId, facecamUrl, outline, {
      scenes, brandName, bgMusicUrl, webhookUrl,
    });

    return { status: "success", record };
  },

  async _run(
    recordId: string,
    userId: string,
    facecamUrl: string,
    outline: string,
    opts: { scenes?: string[]; brandName?: string; bgMusicUrl?: string; webhookUrl?: string }
  ): Promise<void> {
    const serverUrl = getServerUrl();
    const apiKey    = getApiKey();

    function addLog(progress: number, msg: string, extraStatus?: string) {
      AIMediaModel.findByIdAndUpdate(recordId, {
        $push: { "metadata.renderLogs": msg },
        $set: { "metadata.progress": progress },
      }).catch(() => {});
      broadcastEvent("video_status_updated", {
        recordId, userId, progress, log: msg,
        status: extraStatus || (progress < 100 ? "processing" : "done"),
      });
    }

    try {
      // Kiểm tra VPS health
      const health = await fetch(`${serverUrl}/health`).then(r => r.json()).catch(() => null) as any;
      if (!health?.status || health.status !== "ok") {
        throw new Error("Claude Render VPS không phản hồi");
      }
      if (!health.anthropic_key_set) {
        throw new Error("ANTHROPIC_API_KEY chưa set trên VPS Claude Render Server");
      }

      addLog(8, "[Claude Render] VPS đang hoạt động. Gửi job...");

      // Submit job
      const submitRes = await fetch(`${serverUrl}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          facecam_url: facecamUrl,
          outline,
          scenes: opts.scenes,
          brand_name: opts.brandName,
          bg_music_url: opts.bgMusicUrl || "",
          webhook_url: opts.webhookUrl || "",
          user_id: userId,
          record_id: recordId,
        }),
      });

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({})) as any;
        throw new Error(err?.error || `VPS submit failed: HTTP ${submitRes.status}`);
      }

      const { task_id } = await submitRes.json() as { task_id: string };
      addLog(12, `[Claude Render] Job queued: ${task_id}`);
      addLog(15, "[Claude Render] Claude đang viết HTML+GSAP cho từng scene...");

      // Poll
      const result = await pollJobStatus(task_id);

      if (result.status === "done" && result.result_url) {
        await AIMediaModel.findByIdAndUpdate(recordId, {
          $set: {
            url: result.result_url,
            "metadata.status": "done",
            "metadata.progress": 100,
          },
          $push: { "metadata.renderLogs": `[Claude Render] Hoàn thành: ${result.result_url}` },
        });
        broadcastEvent("video_status_updated", {
          recordId, userId, progress: 100, status: "done", url: result.result_url,
        });
      } else {
        throw new Error(result.error || "Claude Render thất bại");
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[Claude Render] Job ${recordId} error:`, msg);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        $set: { "metadata.status": "failed", "metadata.progress": 0 },
        $push: { "metadata.renderLogs": `[Claude Render] Lỗi: ${msg}` },
      });
      broadcastEvent("video_status_updated", {
        recordId, userId, progress: 0, status: "failed", error: msg,
      });
    }
  },
};
