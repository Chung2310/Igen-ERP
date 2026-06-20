import { AIMediaModel } from "../model/ai-media.model";

function getHermesWebhookUrl(recordId: string) {
  const baseUrl = String(process.env.APP_URL || "").trim();
  if (!baseUrl) {
    return "";
  }
  try {
    const webhookUrl = new URL("/api/v1/gemini/hermes-webhook", baseUrl);
    webhookUrl.searchParams.set("recordId", recordId);
    return webhookUrl.toString();
  } catch {
    return "";
  }
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
    // Save record to database with status processing
    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://hermes-agent/${userId}-${Date.now()}`,
      prompt,
      metadata: {
        status: "processing",
        progress: 5,
        provider: "hermes-agent",
        title: `Biên tập bằng Hermes Agent: ${prompt}`,
        description: `Đang kết nối tới Hermes Agent để xử lý video...`,
        blueprint: "{}",
        renderLogs: [
          "[Hermes] Khởi tạo yêu cầu biên tập video...",
          `[Hermes] Video đầu vào: ${videoUrl}`,
          `[Hermes] Yêu cầu: ${prompt}`
        ],
        aspectRatio: options?.aspectRatio || "16:9",
        resolution: options?.resolution || "720p",
      }
    });

    // Run the background task to call Hermes Agent API with webhook
    void this.executeHermesEditVideoJob(record._id.toString(), userId, videoUrl, prompt, {
      aspectRatio: options?.aspectRatio,
      resolution: options?.resolution
    });

    return {
      status: "success",
      record,
      blueprint: null
    };
  },

  async executeHermesEditVideoJob(
    recordId: string,
    userId: string,
    videoUrl: string,
    prompt: string,
    options?: {
      aspectRatio?: string;
      resolution?: string;
    }
  ) {
    console.log(`[Hermes Job] Starting task for record ${recordId}`);
    const logs = [
      "[Hermes] Khởi tạo kết nối với Hermes Agent...",
      `[Hermes] Video đầu vào: ${videoUrl}`,
      `[Hermes] Yêu cầu: ${prompt}`
    ];

    const updateLogs = async (progress: number, newLog?: string) => {
      if (newLog) {
        console.log(`[Hermes Job] [${progress}%] ${newLog}`);
        logs.push(newLog);
      }
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.progress": progress,
        "metadata.renderLogs": logs,
        "metadata.description": `Đang kết xuất video qua Hermes Agent. Tiến trình: ${progress}%`
      });
    };

    try {
      await updateLogs(10, "[Hermes] Đang gửi yêu cầu biên tập (non-stream)...");

      const cloudinaryPrompt = `
Sau khi đã hoàn thành việc chỉnh sửa video theo yêu cầu, bạn PHẢI tải (upload) video kết quả lên Cloudinary sử dụng thông tin tài khoản Cloudinary sau:
- CLOUDINARY_CLOUD_NAME: "${process.env.CLOUDINARY_CLOUD_NAME || ""}"
- CLOUDINARY_API_KEY: "${process.env.CLOUDINARY_API_KEY || ""}"
- CLOUDINARY_API_SECRET: "${process.env.CLOUDINARY_API_SECRET || ""}"

Yêu cầu đầu ra:
Bạn BẮT BUỘC phải trả về đường dẫn URL của video sau khi đã upload lên Cloudinary trong nội dung phản hồi của bạn. Đường dẫn này phải là một URL hợp lệ có định dạng của Cloudinary (ví dụ: https://res.cloudinary.com/...).
`;

      const userPrompt = `Hãy thực hiện chỉnh sửa video sau theo yêu cầu của người dùng.

Video nguồn cần chỉnh sửa: ${videoUrl}
Yêu cầu chỉnh sửa của người dùng: "${prompt}"

${cloudinaryPrompt}
`;

      const hermesBaseUrl = String(process.env.HERMES_API_URL || "https://agent.igentechsolutions.com").replace(/\/$/, "");
      const hermesUrl = `${hermesBaseUrl}/v1/chat/completions`;
      const hermesKey = process.env.HERMES_API_KEY || "";
      const webhookUrl = getHermesWebhookUrl(recordId);

      const response = await fetch(hermesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${hermesKey}`
        },
        body: JSON.stringify({
          model: "hermes",
          messages: [
            { role: "user", content: userPrompt }
          ],
          stream: false,
          webhook_url: webhookUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hermes API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      // OpenAI-compatible: id + choices[0].message.content
      const sessionId = result.id || result.session_id;
      const assistantContent: string = result.choices?.[0]?.message?.content || result.content || "";

      console.log(`[Hermes Job] Got response. Session: ${sessionId}. Content length: ${assistantContent.length}`);

      // Extract Cloudinary URL from the assistant response
      const cloudinaryMatch = assistantContent.match(/https:\/\/res\.cloudinary\.com\/[^\s"'\]>)]+/);
      const videoResultUrl = cloudinaryMatch ? cloudinaryMatch[0] : "";

      if (videoResultUrl) {
        // Video is done — update record to completed
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.status": "completed",
          "metadata.progress": 100,
          url: videoResultUrl,
          ...(sessionId ? { "metadata.hermesSessionId": sessionId } : {}),
          "metadata.renderLogs": [
            ...logs,
            `[Hermes] Xử lý hoàn tất. Session: ${sessionId || "N/A"}`,
            `[Hermes] Video đã được upload lên Cloudinary: ${videoResultUrl}`
          ],
          "metadata.description": "Video đã được biên tập và upload thành công!"
        });
        console.log(`[Hermes Job] Completed. Video URL: ${videoResultUrl}`);
      } else {
        // No Cloudinary URL found — mark as waiting for webhook (fallback)
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.progress": 30,
          ...(sessionId ? { "metadata.hermesSessionId": sessionId } : {}),
          "metadata.renderLogs": [
            ...logs,
            `[Hermes] Gửi yêu cầu thành công.${sessionId ? ` Session ID: ${sessionId}` : ""}`,
            `[Hermes] Đang đợi Hermes Agent hoàn thành chỉnh sửa...`,
            assistantContent ? `[Hermes] Phản hồi: ${assistantContent.slice(0, 300)}` : ""
          ].filter(Boolean),
          "metadata.description": "Yêu cầu đã được tiếp nhận. Đang xử lý..."
        });
      }

    } catch (error: any) {
      console.error("[Hermes Job] Failed:", error);
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.status": "failed",
        "metadata.progress": 100,
        "metadata.error": error.message || String(error),
        "metadata.description": `Lỗi: ${error.message || String(error)}`
      });
    }
  }
};

