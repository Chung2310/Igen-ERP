import { AIMediaModel } from "../model/ai-media.model";

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

    // Run the background task to call Hermes Agent API with streaming
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
      await updateLogs(10, "[Hermes] Đang gửi yêu cầu và khởi tạo stream...");

      const cloudinaryPrompt = `
Sau khi đã hoàn thành việc chỉnh sửa video theo yêu cầu, bạn PHẢI tải (upload) video kết quả lên Cloudinary sử dụng thông tin tài khoản Cloudinary sau:
- CLOUDINARY_CLOUD_NAME: "${process.env.CLOUDINARY_CLOUD_NAME || ""}"
- CLOUDINARY_API_KEY: "${process.env.CLOUDINARY_API_KEY || ""}"
- CLOUDINARY_API_SECRET: "${process.env.CLOUDINARY_API_SECRET || ""}"

Yêu cầu đầu ra:
Bạn BẮT BUỘC phải trả về đường dẫn URL của video sau khi đã upload lên Cloudinary trong nội dung phản hồi của bạn. Đường dẫn này phải là một URL hợp lệ có định dạng của Cloudinary (ví dụ: https://res.cloudinary.com/...).
`;

      const systemPrompt = `Bạn là một trợ lý ảo hỗ trợ chỉnh sửa và biên tập video chuyên nghiệp. Bạn có khả năng gọi các MCP tools/skills để xử lý video và tải lên Cloudinary.`;
      const userPrompt = `Hãy thực hiện chỉnh sửa video sau theo yêu cầu của người dùng.

Video nguồn cần chỉnh sửa: ${videoUrl}
Yêu cầu chỉnh sửa của người dùng: "${prompt}"

${cloudinaryPrompt}
`;
      const hermesUrl = `${process.env.HERMES_API_URL || "https://agent.igentechsolutions.com"}/v1/chat/completions`;
      const hermesKey = process.env.HERMES_API_KEY || "";

      const response = await fetch(hermesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${hermesKey}`
        },
        body: JSON.stringify({
          model: "hermes",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hermes API error: ${response.status} - ${errorText}`);
      }

      const reader = response.body;
      if (!reader) {
        throw new Error("No response body from Hermes Agent");
      }

      await updateLogs(20, "[Hermes] Đang nhận phản hồi từ Hermes Agent...");

      let fullText = "";
      const decoder = new TextDecoder();
      let buffer = "";
      let lastProgressUpdate = Date.now();
      let chunkCount = 0;

      if (typeof (reader as any)[Symbol.asyncIterator] === "function") {
        for await (const chunk of reader as any) {
          chunkCount++;
          buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });

          let lineEnd;
          while ((lineEnd = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);

            if (line.startsWith("data:")) {
              const dataStr = line.slice(5).trim();
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  fullText += content;
                }
              } catch (e) {
                // Ignore partial/invalid JSON chunks
              }
            }
          }

          if (Date.now() - lastProgressUpdate > 3000) {
            const progressPercent = Math.min(85, 20 + Math.floor(chunkCount / 10));
            const previewText = fullText.slice(-100);
            await updateLogs(progressPercent, `[Hermes Streaming] ...${previewText}`);
            lastProgressUpdate = Date.now();
          }
        }
      } else {
        const streamReader = (reader as any).getReader();
        let done = false;
        while (!done) {
          const { value, done: isDone } = await streamReader.read();
          done = isDone;
          if (value) {
            chunkCount++;
            buffer += decoder.decode(value, { stream: true });

            let lineEnd;
            while ((lineEnd = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, lineEnd).trim();
              buffer = buffer.slice(lineEnd + 1);

              if (line.startsWith("data:")) {
                const dataStr = line.slice(5).trim();
                if (dataStr === "[DONE]") {
                  break;
                }
                try {
                  const parsed = JSON.parse(dataStr);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    fullText += content;
                  }
                } catch (e) {
                  // Ignore partial/invalid JSON chunks
                }
              }
            }
          }

          if (Date.now() - lastProgressUpdate > 3000) {
            const progressPercent = Math.min(85, 20 + Math.floor(chunkCount / 10));
            const previewText = fullText.slice(-100);
            await updateLogs(progressPercent, `[Hermes Streaming] ...${previewText}`);
            lastProgressUpdate = Date.now();
          }
        }
      }

      await updateLogs(90, `[Hermes Completed] Nhận phản hồi hoàn tất. Đang trích xuất URL video...`);
      console.log("[Hermes Job] Full response:", fullText);

      // Search for Cloudinary URL inside fullText
      const cloudinaryRegex = /(https:\/\/res\.cloudinary\.com\/[^\s\)\"\`\'\>]+)/i;
      const match = fullText.match(cloudinaryRegex);
      const extractedUrl = match ? match[1] : null;

      if (extractedUrl) {
        await updateLogs(95, `[Hermes] Tìm thấy URL video đã upload: ${extractedUrl}`);

        await AIMediaModel.findByIdAndUpdate(recordId, {
          url: extractedUrl,
          "metadata.status": "completed",
          "metadata.progress": 100,
          "metadata.description": "Biên tập video hoàn tất."
        });
      } else {
        // Try searching for any valid http/https URL that might be a video URL as fallback
        const anyUrlRegex = /(https?:\/\/[^\s\)\"\`\'\>]+)/i;
        const fallbackMatch = fullText.match(anyUrlRegex);
        const fallbackUrl = fallbackMatch ? fallbackMatch[1] : null;

        if (fallbackUrl) {
          await updateLogs(95, `[Hermes] Không tìm thấy URL Cloudinary nhưng phát hiện URL thay thế: ${fallbackUrl}`);
          await AIMediaModel.findByIdAndUpdate(recordId, {
            url: fallbackUrl,
            "metadata.status": "completed",
            "metadata.progress": 100,
            "metadata.description": "Biên tập video hoàn tất (URL fallback)."
          });
        } else {
          throw new Error("Hermes Agent không trả về URL video hợp lệ trong nội dung phản hồi.");
        }
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
