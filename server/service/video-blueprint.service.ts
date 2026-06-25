import { GoogleGenAI } from "@google/genai";
import { AIMediaModel } from "../model/ai-media.model";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function safeParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const match = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match) {
      cleaned = match[1].trim();
    }
  }
  return JSON.parse(cleaned);
}

function isOverloadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status;
  return status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("experiencing high demand") || msg.includes("quá tải");
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to download file: HTTP ${res.status} - ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

function buildSystemPrompt(videoUrl: string, duration: number): string {
  return `You are a professional video editing assistant. Your job is to translate a user's natural language video editing instructions (supporting both English and Vietnamese) into a precise Remotion video editing JSON blueprint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL DURATION PRESERVATION RULE (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Unless the user explicitly requests to cut, crop, skip, trim, or remove segments of the video (using words like "cắt", "bỏ", "skip", "remove", "trim"), you MUST keep the ENTIRE duration of the video.
- NEVER default to shortening the video.
- If you split a video to apply an effect (such as a zoom, speed, or filter) to a specific part, the sum of the split segments MUST equal the EXACT duration of the original source video.
- HANDLING GAPS: If the user describes edits for specific segments (e.g. 0-5s and 20-30s) but doesn't mention the middle segment (5-20s), you MUST still include the middle segment (5-20s) as a normal video clip (playbackRate: 1.0, no effects/filters) to keep the timeline continuous and preserve the entire video.
- EXACT END TIME MATCHING: The final clip in the timeline must end exactly at the video's originalDuration. If the last split segment ends at X and the video duration is D (where X < D), you MUST add a final clip from X to D.
- For example, if a video is exactly 30 seconds long:
  - If the user asks to "zoom 5 seconds at the beginning", you MUST output:
    1. Clip 1 (0s to 5s) with zoom
    2. Clip 2 (5s to 30s) without zoom
    Total duration = 30 seconds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📽️ SOURCE VIDEOS INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The original video URL is "${videoUrl}".
The original video duration is exactly ${duration} seconds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✂️ SECTION 1: CUTTING & TRIMMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "cắt bỏ X giây đầu" / "bỏ đầu X giây" -> start video clip at X.
- "cắt bỏ X giây cuối" / "bỏ cuối X giây" -> end video clip at (originalDuration - X).
- "lấy đoạn từ X đến Y giây" -> start=X, end=Y.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏩ SECTION 2: PACING & PLAYBACK RATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "tua nhanh gấp N lần" -> set playbackRate to N.
- "tua chậm N lần" -> set playbackRate to 1/N.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SECTION 3: ZOOM EFFECTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zoom is applied per clip. Split the video track at the exact second of the zoom and apply "effects.zoom": "in" or "out".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 SECTION 4: VISUAL COLOR FILTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "tăng sáng" -> filters.brightness: 1.35
- "làm tối" -> filters.brightness: 0.65
- "đen trắng" -> filters.grayscale: 1.0
- "cinematic" -> filters.contrast: 1.25, filters.saturate: 1.3, filters.brightness: 0.95

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 SECTION 5: MUSIC & SOUND DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Background Music:
▸ Upbeat/EDM/Sôi động: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
▸ Tech/Rhythmic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
▸ Corporate/Doanh nghiệp: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
▸ Lofi Chill/Thư giãn: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
▸ Acoustic/Piano/Nhẹ nhàng: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"

Sound Effects (SFX):
▸ Success/Ting sound: "https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav"
▸ Transition/Whoosh sound: "https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 SECTION 6: TEXT OVERLAYS & TITLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "chèn chữ" / "hiển thị phụ đề" / "add text" -> type: "text".
- Placement: top-left, top-center, top-right, center, bottom-left, bottom-center, bottom-right.
- Style: high-contrast colors (white '#FFFFFF', yellow '#FFD700', red '#FF3333', cyan '#00FFFF').
- Font size: title="56px", subtitle="32px", caption="24px".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 SECTION 7: TRANSITIONS & ROTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "chuyển cảnh mờ dần" / "fade transition" -> set effects.transition to "fade" on the clip that ends the scene.
- "xoay góc" / "quay nghiêng" -> set effects.rotate to degrees (e.g. 90, 180, -45).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📐 SECTION 8: TIMELINE INTEGRITY & MATH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Visual timeline must be continuous (no gaps, no overlaps between sequential video clips).
- Unless instructed to cut/trim, keep the entire original video source duration.
- All overlay elements (text, image, audio) are placed relative to the FINAL timeline, not the source video time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SECTION 9: JSON OUTPUT SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid JSON. No markdown backticks, no comments.
{
  "timeline": [
    {
      "type": "video",
      "src": "string",
      "start": number,
      "end": number,
      "playbackRate": number,
      "filters": {
        "brightness": number,
        "grayscale": number
      },
      "effects": {
        "zoom": "in" | "out" | "none",
        "transition": "fade" | "none"
      }
    },
    {
      "type": "text",
      "content": "string",
      "start": number,
      "end": number,
      "style": {
        "position": "bottom-center" | "center",
        "color": "#HEX",
        "fontSize": "32px"
      }
    },
    {
      "type": "audio",
      "src": "string",
      "start": number,
      "end": number,
      "volume": number
    }
  ]
}
`;
}

export const videoBlueprintService = {
  /**
   * Kiểm tra xem prompt có yêu cầu sao chép kịch bản từ video trước hay không
   */
  isCopyPrompt(prompt: string): boolean {
    const normalizedPrompt = prompt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");

    const matchesVietnamese = (
      normalizedPrompt.includes("giong video truoc") ||
      normalizedPrompt.includes("giong video cu") ||
      normalizedPrompt.includes("nhu video truoc") ||
      normalizedPrompt.includes("sau giong truoc") ||
      normalizedPrompt.includes("sao chep edit") ||
      normalizedPrompt.includes("sao chep chinh sua") ||
      normalizedPrompt.includes("lay edit")
    );

    const matchesEnglish = (
      normalizedPrompt.includes("previous video") ||
      normalizedPrompt.includes("reference video") ||
      normalizedPrompt.includes("replicate") ||
      normalizedPrompt.includes("emulate") ||
      normalizedPrompt.includes("copy the style") ||
      normalizedPrompt.includes("same as the first") ||
      normalizedPrompt.includes("same as the previous")
    );

    return matchesVietnamese || matchesEnglish;
  },

  /**
   * Phân tích video mẫu để trích xuất phong cách dựng phim thành Prompt mô tả chi tiết bằng tiếng Việt
   */
  async extractVideoStyle(videoUrl: string, durationSeconds?: number): Promise<string> {
    const tempVideoPath = path.join(os.tmpdir(), `temp_style_extraction_${Date.now()}.mp4`);
    let analysisText = "";

    try {
      console.log(`[videoBlueprintService] Downloading video for style extraction: ${videoUrl}`);
      await downloadFile(videoUrl, tempVideoPath);
      console.log(`[videoBlueprintService] Downloaded successfully. Uploading to Gemini File API...`);

      const uploadResult = await ai.files.upload({
        file: tempVideoPath,
        config: {
          mimeType: "video/mp4",
        }
      });
      console.log(`[videoBlueprintService] Uploaded successfully. Name: ${uploadResult.name}. Waiting for status ACTIVE...`);

      // Chờ cho file xử lý xong trên Gemini
      let fileState = await ai.files.get({ name: uploadResult.name });
      while (fileState.state === "PROCESSING") {
        console.log("[videoBlueprintService] Video is processing by Gemini, waiting 2 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await ai.files.get({ name: uploadResult.name });
      }

      if (fileState.state !== "ACTIVE") {
        throw new Error(`Gemini File API processing failed: ${fileState.state}`);
      }

      console.log("[videoBlueprintService] File is ACTIVE. Calling Gemini model to analyze editing style...");

      const analysisPrompt = `Hãy phân tích phong cách dựng và các hiệu ứng của video mẫu này để tạo ra một kịch bản hướng dẫn biên tập bằng tiếng Việt.${durationSeconds ? `\nLưu ý quan trọng: Video mẫu này có tổng thời lượng chính xác là ${durationSeconds} giây. Hãy định vị rõ mốc thời gian (ví dụ: ở giây thứ mấy, hoặc từ giây thứ mấy đến giây thứ mấy) xảy ra các hiệu ứng hình ảnh/chữ/chuyển cảnh dựa trên tổng thời lượng ${durationSeconds} giây này.` : ""}

⚠️ QUY TẮC QUAN TRỌNG (MANDATORY):
- TẬP TRUNG HOÀN TOÀN VÀO HIỆU ỨNG VÀ KỸ THUẬT DỰNG: Chỉ trích xuất các hiệu ứng hình ảnh (zoom in/out, xoay, bộ lọc màu, độ sáng/tương phản), hiệu ứng chuyển cảnh (fade transition), nhịp độ cắt ghép (cuts & pacing), vị trí/màu sắc/kích thước hiển thị chữ (text overlays) và thể loại nhạc nền/SFX.
- TUYỆT ĐỐI KHÔNG TRÍCH XUẤT NỘI DUNG CỤ THỂ: Không mô tả các đối tượng, nhân vật, phong cảnh, hay hoạt động cụ thể xuất hiện trong video mẫu (Ví dụ: KHÔNG viết về "con rùa", "biển cả", "bàn phím", v.v.). Không lấy nội dung văn bản cụ thể của chữ nếu nó gắn liền với chủ đề video cũ; hãy thay thế bằng các chữ giả định tổng quát (như "Chèn chữ tiêu đề", "Hiển thị phụ đề mẫu").
- ĐẦU RA LÀ HƯỚNG DẪN HÀNH ĐỘNG CHỦ ĐỘNG: Viết dưới dạng danh sách các lệnh biên tập bắt đầu bằng động từ hành động (Ví dụ: "Cắt...", "Áp dụng bộ lọc...", "Thực hiện hiệu ứng zoom...", "Chèn chữ ở vị trí...").
- KHÔNG thêm lời chào, không giải thích dài dòng.`;

      const analysisResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: uploadResult.uri,
                  mimeType: uploadResult.mimeType,
                },
              },
              { text: analysisPrompt },
            ],
          },
        ],
      });

      analysisText = analysisResponse.text || "";
      console.log("[videoBlueprintService] Video style extraction completed. Description length:", analysisText.length);

      // Xóa file trên Gemini để dọn dẹp
      try {
        await ai.files.delete({ name: uploadResult.name });
        console.log(`[videoBlueprintService] Deleted file from Gemini: ${uploadResult.name}`);
      } catch (delErr) {
        console.warn("[videoBlueprintService] Failed to delete file from Gemini:", delErr);
      }
    } catch (err) {
      console.error("[videoBlueprintService] Error during multimodal analysis of video:", err);
      if (isOverloadError(err)) {
        throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
      }
      throw new Error(`Lỗi khi phân tích video mẫu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Dọn dẹp local temp file
      if (fs.existsSync(tempVideoPath)) {
        try {
          fs.unlinkSync(tempVideoPath);
        } catch (delErr) {
          console.warn("[videoBlueprintService] Failed to delete local temp file:", delErr);
        }
      }
    }

    if (!analysisText) {
      throw new Error("Không nhận diện được nội dung kịch bản phân tích từ video mẫu.");
    }

    return analysisText.trim();
  },

  /**
   * Sử dụng Gemini để phân tích video cũ, sau đó tạo Blueprint mới cho video mới
   */
  async copyAndScaleBlueprint(
    userId: string,
    urls: string[],
    urlDurations: { [url: string]: number },
    getVideoDurationFn: (url: string) => Promise<number>
  ): Promise<any> {
    if (urls.length < 2) {
      throw new Error("Vui lòng tải lên ít nhất 2 video (video đầu tiên là video mẫu đã sửa, video thứ hai là video mới cần áp dụng chỉnh sửa).");
    }

    const video1Url = urls[0];
    const video2Url = urls[1];

    const d1 = urlDurations[video1Url] || 0;
    const d2 = urlDurations[video2Url] || 0;

    const tempVideoPath = path.join(os.tmpdir(), `temp_copy_template_${Date.now()}.mp4`);
    let analysisText = "";

    try {
      console.log(`[videoBlueprintService] Downloading template video 1 for LLM analysis: ${video1Url}`);
      await downloadFile(video1Url, tempVideoPath);
      console.log(`[videoBlueprintService] Downloaded successfully. Uploading to Gemini File API...`);

      const uploadResult = await ai.files.upload({
        file: tempVideoPath,
        config: {
          mimeType: "video/mp4",
        }
      });
      console.log(`[videoBlueprintService] Uploaded successfully. Name: ${uploadResult.name}. Waiting for status ACTIVE...`);

      // Chờ cho file xử lý xong trên Gemini
      let fileState = await ai.files.get({ name: uploadResult.name });
      while (fileState.state === "PROCESSING") {
        console.log("[videoBlueprintService] Video is processing by Gemini, waiting 2 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await ai.files.get({ name: uploadResult.name });
      }

      if (fileState.state !== "ACTIVE") {
        throw new Error(`Gemini File API processing failed: ${fileState.state}`);
      }

      console.log("[videoBlueprintService] File is ACTIVE. Calling Gemini model to analyze editing style...");

      const analysisPrompt = `Hãy phân tích chi tiết phong cách biên tập, nhịp độ và các hiệu ứng dựng hình của video này.

⚠️ QUY TẮC QUAN TRỌNG (MANDATORY):
- TẬP TRUNG HOÀN TOÀN VÀO HIỆU ỨNG VÀ KỸ THUẬT DỰNG: Chỉ phân tích nhịp điệu cắt ghép, tốc độ phát (playback rate), bộ lọc màu (contrast, brightness, grayscale), các hiệu ứng chuyển cảnh (transitions), chuyển động thu phóng (zoom in, zoom out, rotate), vị trí/màu sắc/kích thước hiển thị chữ (text overlays) và thể loại nhạc nền/SFX.
- TUYỆT ĐỐI KHÔNG LẤY NỘI DUNG CỤ THỂ: Không mô tả các đối tượng, nhân vật, phong cảnh, hay hoạt động cụ thể trong video cũ (ví dụ: KHÔNG viết về "con rùa", "xe cộ", v.v.). Tổng quát hóa các lớp chữ thành chữ giả định (ví dụ: "Chèn chữ tiêu đề", "Hiển thị phụ đề mẫu").
- Trả lời bằng Tiếng Việt.`;

      const analysisResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: uploadResult.uri,
                  mimeType: uploadResult.mimeType,
                },
              },
              { text: analysisPrompt },
            ],
          },
        ],
      });

      analysisText = analysisResponse.text || "";
      console.log("[videoBlueprintService] Video analysis completed. Description length:", analysisText.length);

      // Xóa file trên Gemini để dọn dẹp
      try {
        await ai.files.delete({ name: uploadResult.name });
        console.log(`[videoBlueprintService] Deleted file from Gemini: ${uploadResult.name}`);
      } catch (delErr) {
        console.warn("[videoBlueprintService] Failed to delete file from Gemini:", delErr);
      }
    } catch (err) {
      console.error("[videoBlueprintService] Error during multimodal analysis of video 1:", err);
      if (isOverloadError(err)) {
        throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
      }
      throw new Error(`Lỗi khi phân tích video gốc: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      // Dọn dẹp local temp file
      if (fs.existsSync(tempVideoPath)) {
        try {
          fs.unlinkSync(tempVideoPath);
        } catch (delErr) {
          console.warn("[videoBlueprintService] Failed to delete local temp file:", delErr);
        }
      }
    }

    if (!analysisText) {
      throw new Error("Không nhận diện được nội dung kịch bản phân tích từ video mẫu.");
    }

    // Bước 2: Gọi Gemini tiếp để tạo kịch bản Blueprint JSON cho video mới
    const systemPrompt = buildSystemPrompt(video2Url, d2);
    const userPrompt = `Hãy tạo kịch bản chỉnh sửa video JSON Blueprint cho Video mới có URL "${video2Url}" và thời lượng ${d2} giây.
Hãy áp dụng phong cách biên tập, cắt ghép, các hiệu ứng hình ảnh, chữ lớp phủ, và âm thanh giống hệt như video mẫu đã được phân tích dưới đây:

[PHÂN TÍCH PHONG CÁCH VIDEO MẪU]
${analysisText}

Chú ý: Hãy điều chỉnh tỉ xích thời gian (scale) của các hiệu ứng, chữ và nhạc nền cho phù hợp với thời lượng ${d2} giây của video mới này (so với video mẫu có thời lượng gốc là ${d1} giây).
Đảm bảo kết quả đầu ra CHỈ là JSON thô, không chứa thẻ markdown hay lời nói thừa.`;

    console.log("[videoBlueprintService] Calling Gemini model to generate final blueprint...");
    try {
      const blueprintResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        }
      });

      const blueprintJsonText = blueprintResponse.text || "";
      const blueprint = safeParseJson(blueprintJsonText);

      // Sanity check: Ensure there is at least one video track in the timeline so we don't render a black video
      if (!blueprint.timeline || !Array.isArray(blueprint.timeline) || blueprint.timeline.filter((item: any) => item.type === "video").length === 0) {
        console.warn("[videoBlueprintService] Gemini returned blueprint without video track, adding fallback target video track.");
        if (!blueprint.timeline || !Array.isArray(blueprint.timeline)) {
          blueprint.timeline = [];
        }
        blueprint.timeline.unshift({
          type: "video",
          src: video2Url,
          start: 0,
          end: d2,
          playbackRate: 1.0
        });
      }

      console.log("[videoBlueprintService] Blueprint generated and parsed successfully.");
      return blueprint;
    } catch (err) {
      console.error("[videoBlueprintService] Error generating JSON blueprint from scenario:", err);
      if (isOverloadError(err)) {
        throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
      }
      throw new Error(`Lỗi khi sinh kịch bản JSON từ kịch bản phân tích: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  /**
   * Sinh cấu trúc JSON Blueprint trực tiếp từ Prompt chỉnh sửa của người dùng
   */
  async generateBlueprintFromPrompt(
    videoUrl: string,
    duration: number,
    prompt: string
  ): Promise<any> {
    const systemPrompt = buildSystemPrompt(videoUrl, duration);
    const userPrompt = `Hãy tạo kịch bản chỉnh sửa video JSON Blueprint cho Video có URL "${videoUrl}" và thời lượng ${duration} giây.\nYêu cầu chỉnh sửa: "${prompt}"\n\nĐảm bảo kết quả đầu ra CHỈ là JSON thô, không chứa thẻ markdown hay lời nói thừa.`;

    console.log("[videoBlueprintService] Calling Gemini model to generate blueprint from prompt...");
    try {
      const blueprintResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        }
      });

      const blueprintJsonText = blueprintResponse.text || "";
      const blueprint = safeParseJson(blueprintJsonText);

      // Sanity check: Ensure there is at least one video track
      if (!blueprint.timeline || !Array.isArray(blueprint.timeline) || blueprint.timeline.filter((item: any) => item.type === "video").length === 0) {
        if (!blueprint.timeline || !Array.isArray(blueprint.timeline)) {
          blueprint.timeline = [];
        }
        blueprint.timeline.unshift({
          type: "video",
          src: videoUrl,
          start: 0,
          end: duration,
          playbackRate: 1.0
        });
      }

      return blueprint;
    } catch (err) {
      console.error("[videoBlueprintService] Error generating blueprint from prompt:", err);
      return {
        timeline: [
          {
            type: "video",
            src: videoUrl,
            start: 0,
            end: duration,
            playbackRate: 1.0
          }
        ]
      };
    }
  }
};
