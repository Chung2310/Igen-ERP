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
  async extractVideoStyle(videoUrl: string): Promise<string> {
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

      const analysisPrompt = `Hãy phân tích kịch bản chỉnh sửa và phong cách dựng của video mẫu này và chuyển đổi thành một kịch bản hướng dẫn dựng phim bằng tiếng Việt.

⚠️ QUY TẮC ĐẦU RA (MANDATORY):
- Viết kịch bản dưới dạng danh sách các HƯỚNG DẪN HÀNH ĐỘNG/LỆNH BIÊN TẬP CHỦ ĐỘNG, bắt đầu bằng động từ hành động (Ví dụ: "Cắt...", "Chèn...", "Áp dụng bộ lọc...", "Tua nhanh...").
- Tránh viết kiểu mô tả thụ động (Ví dụ: KHÔNG viết "Video này có nhạc...", mà PHẢI viết "Chèn nhạc nền lofi nhẹ nhàng xuyên suốt...").
- Điều này rất quan trọng để mô hình AI biên tập khác (như Hermes) có thể đọc hiểu và thực thi chính xác như một chuỗi chỉ thị.

Hãy liệt kê đầy đủ các khía cạnh sau:
1. Cắt ghép & Nhịp độ (Cuts & Pacing): Cắt video thành mấy phân đoạn, thời lượng bao nhiêu giây, có nhịp nhanh hay chậm, chuyển cảnh ở giây thứ mấy, tốc độ tua nhanh/chậm bao nhiêu.
2. Bộ lọc màu & Hiệu ứng hình ảnh (Filters & Effects): Áp dụng lọc màu gì (đen trắng, cinematic...), độ sáng/tương phản ra sao, zoom cận cảnh (zoom-in/zoom-out) tại thời điểm nào.
3. Chữ lớp phủ (Text Overlays): Chèn chữ gì, nội dung chữ là gì, xuất hiện từ giây nào đến giây nào, font chữ màu gì (nếu rõ màu HEX hoặc tiếng Việt), vị trí hiển thị ở đâu.
4. Nhạc nền & Hiệu ứng âm thanh (Audio & SFX): Chèn nhạc nền phong cách gì, hiệu ứng âm thanh (SFX) nào xuất hiện ở đâu.

Đầu ra trả về CHỈ bao gồm danh sách các lệnh biên tập bằng Tiếng Việt, ngắn gọn, súc tích và tập trung hoàn toàn vào hành động dựng phim thực tế. Không thêm lời chào, không giải thích dài dòng.`;

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

      const analysisPrompt = `Hãy phân tích chi tiết kịch bản chỉnh sửa và phong cách dựng của video này. 
Hãy mô tả chi tiết:
1. Cách cắt ghép và nhịp độ (Pacing/Transitions): Video có bị cắt ngắn không, chuyển cảnh ở giây thứ mấy, tốc độ tua nhanh/chậm như thế nào.
2. Các hiệu ứng hình ảnh (Visual filters/effects): Có lọc màu đen trắng, tăng sáng, làm tối, hay zoom cận cảnh ở các khoảng thời gian nào.
3. Chữ lớp phủ (Text overlays): Nội dung chữ là gì, xuất hiện từ giây thứ mấy đến giây thứ mấy, vị trí ở đâu.
4. Âm thanh (Audio/Music): Có chèn nhạc nền gì, hiệu ứng âm thanh (sfx) nào xuất hiện ở đâu.

Mục tiêu là mô tả thật chi tiết và chính xác để từ bản mô tả này, chúng ta có thể dựng lại một video tương tự với cùng phong cách. Trả lời bằng Tiếng Việt.`;

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
  }
};
