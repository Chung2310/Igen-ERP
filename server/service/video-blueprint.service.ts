import { GoogleGenAI } from "@google/genai";
import { AIMediaModel } from "../model/ai-media.model";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { freeLLMJson, isFreeLLMConfigured } from "./freellm.service";

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

/**
 * Represents a single editing segment in the structured style JSON.
 * All timestamps are expressed as fractions (0.0 to 1.0) of the source video duration.
 * This avoids asking the LLM to do arithmetic scaling.
 */
interface StyleSegment {
  /** Relative start position in source video, 0.0 = beginning, 1.0 = end */
  startFraction: number;
  /** Relative end position in source video, 0.0 = beginning, 1.0 = end */
  endFraction: number;
  playbackRate?: number;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturate?: number;
    grayscale?: number;
  };
  effects?: {
    zoom?: "in" | "out" | "none";
    transition?: "fade" | "none";
  };
}

interface StyleTextOverlay {
  content: string;
  /** Relative start position as fraction of source video duration */
  startFraction: number;
  /** Relative end position as fraction of source video duration */
  endFraction: number;
  style?: {
    position?: string;
    color?: string;
    fontSize?: string;
  };
}

interface VideoStyleSchema {
  /** Overall editing tone / summary */
  editingStyle: string;
  /** Recommended music genre */
  musicGenre: "upbeat" | "tech" | "corporate" | "lofi" | "acoustic" | "none";
  /** Whether SFX whoosh transitions are used */
  useSFXTransitions: boolean;
  /** Video segments describing per-segment edits. ALL fractions are in [0.0, 1.0] range */
  segments: StyleSegment[];
  /** Text overlays. ALL fractions are in [0.0, 1.0] range */
  textOverlays: StyleTextOverlay[];
}

const MUSIC_URL_MAP: Record<string, string> = {
  upbeat: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  tech: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  corporate: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  lofi: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  acoustic: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
};

/**
 * Converts a VideoStyleSchema (with relative fractions) into a full Blueprint JSON
 * for a target video. All timestamp math is done here in code – not by the LLM.
 */
function buildBlueprintFromStyle(
  targetVideoUrl: string,
  targetDuration: number,
  style: VideoStyleSchema,
  userHint?: string
): any {
  const timeline: any[] = [];

  // ── Video segments ───────────────────────────────────────────────────────
  if (style.segments && style.segments.length > 0) {
    for (const seg of style.segments) {
      const start = parseFloat((seg.startFraction * targetDuration).toFixed(3));
      const end = parseFloat((seg.endFraction * targetDuration).toFixed(3));
      if (end <= start) continue;
      const entry: any = {
        type: "video",
        src: targetVideoUrl,
        start,
        end,
        playbackRate: seg.playbackRate ?? 1.0,
      };
      if (seg.filters && Object.keys(seg.filters).length > 0) {
        entry.filters = seg.filters;
      }
      if (seg.effects && Object.keys(seg.effects).length > 0) {
        entry.effects = seg.effects;
      }
      timeline.push(entry);
    }
  } else {
    // Fallback: single full-duration video clip
    timeline.push({
      type: "video",
      src: targetVideoUrl,
      start: 0,
      end: targetDuration,
      playbackRate: 1.0,
    });
  }

  // ── Ensure video timeline is continuous with no gaps ──────────────────────
  const videoEntries = timeline.filter((e) => e.type === "video");
  if (videoEntries.length > 0) {
    // Sort by start time
    videoEntries.sort((a, b) => a.start - b.start);

    // Fill gaps
    const filledEntries: any[] = [];
    let cursor = 0;
    for (const entry of videoEntries) {
      if (entry.start > cursor + 0.01) {
        // Gap detected – fill with plain video clip
        filledEntries.push({
          type: "video",
          src: targetVideoUrl,
          start: parseFloat(cursor.toFixed(3)),
          end: parseFloat(entry.start.toFixed(3)),
          playbackRate: 1.0,
        });
      }
      filledEntries.push(entry);
      cursor = entry.end;
    }
    // Fill tail gap
    if (cursor < targetDuration - 0.01) {
      filledEntries.push({
        type: "video",
        src: targetVideoUrl,
        start: parseFloat(cursor.toFixed(3)),
        end: parseFloat(targetDuration.toFixed(3)),
        playbackRate: 1.0,
      });
    }

    // Replace video entries in timeline
    const nonVideoEntries = timeline.filter((e) => e.type !== "video");
    timeline.splice(0, timeline.length, ...filledEntries, ...nonVideoEntries);
  }

  // ── Text overlays ────────────────────────────────────────────────────────
  if (style.textOverlays && style.textOverlays.length > 0) {
    for (const overlay of style.textOverlays) {
      const start = parseFloat((overlay.startFraction * targetDuration).toFixed(3));
      const end = parseFloat((overlay.endFraction * targetDuration).toFixed(3));
      if (end <= start) continue;
      timeline.push({
        type: "text",
        content: overlay.content,
        start,
        end,
        style: overlay.style ?? { position: "bottom-center", color: "#FFD700", fontSize: "32px" },
      });
    }
  }

  // ── Background music ─────────────────────────────────────────────────────
  if (style.musicGenre && style.musicGenre !== "none") {
    const musicUrl = MUSIC_URL_MAP[style.musicGenre];
    if (musicUrl) {
      timeline.push({
        type: "audio",
        src: musicUrl,
        start: 0,
        end: targetDuration,
        volume: 0.4,
      });
    }
  }

  // ── SFX transitions ──────────────────────────────────────────────────────
  if (style.useSFXTransitions) {
    const videoSegs = timeline.filter((e) => e.type === "video");
    for (let i = 0; i < videoSegs.length - 1; i++) {
      const transitionStart = videoSegs[i].end - 0.3;
      const transitionEnd = videoSegs[i].end + 0.3;
      if (transitionStart >= 0 && transitionEnd <= targetDuration) {
        timeline.push({
          type: "audio",
          src: "https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav",
          start: parseFloat(transitionStart.toFixed(3)),
          end: parseFloat(transitionEnd.toFixed(3)),
          volume: 0.6,
        });
      }
    }
  }

  return { timeline };
}

async function generateStyleViaFreeLLM(
  userPrompt?: string,
  durationSeconds = 60,
  targetDuration?: number
): Promise<VideoStyleSchema> {
  const userHint = (userPrompt && userPrompt.trim()) ? userPrompt.trim() : "Tạo video chất lượng, nhịp điệu sinh động và có nhạc nền phù hợp.";
  const effectiveTargetDuration = targetDuration || durationSeconds;

  const promptText = `Bạn là một chuyên gia biên tập video và kiến trúc sư kịch bản Remotion chuyên nghiệp.
Chúng tôi cần bạn thiết kế một phong cách biên tập video (VideoStyleSchema) dạng JSON dưới đây để làm nền tảng sinh kịch bản chỉnh sửa cho video có tổng thời lượng gốc là ${durationSeconds} giây và video đích là ${effectiveTargetDuration} giây.

Yêu cầu chỉnh sửa / Ý tưởng từ người dùng: "${userHint}"

⚠️ YÊU CẦU ĐẦU RA (MANDATORY - CRITICAL):
Trả về CHÍNH XÁC một đối tượng JSON hợp lệ theo schema sau. KHÔNG thêm bất kỳ văn bản nào ngoài JSON.

{
  "editingStyle": "mô tả ngắn về phong cách dựng tổng thể (vd: fast-cut cinematic, slow narrative, upbeat social media)",
  "musicGenre": "upbeat | tech | corporate | lofi | acoustic | none",
  "useSFXTransitions": true | false,
  "segments": [
    {
      "startFraction": <số thập phân từ 0.0 đến 1.0 = vị trí tương đối trong video>,
      "endFraction": <số thập phân từ 0.0 đến 1.0>,
      "playbackRate": <1.0 là tốc độ thường, 2.0 là gấp đôi, 0.5 là chậm gấp đôi>,
      "filters": {
        "brightness": <0.5 đến 2.0, 1.0 là bình thường>,
        "contrast": <0.5 đến 2.0, 1.0 là bình thường>,
        "saturate": <0.0 đến 3.0>,
        "grayscale": <0.0 hoặc 1.0>
      },
      "effects": {
        "zoom": "in | out | none",
        "transition": "fade | none"
      }
    }
  ],
  "textOverlays": [
    {
      "content": "Nội dung chữ hiển thị (tiếng Việt hoặc tiếng Anh dựa trên yêu cầu người dùng)",
      "startFraction": <0.0 đến 1.0>,
      "endFraction": <0.0 đến 1.0>,
      "style": {
        "position": "bottom-center | center | top-center",
        "color": "#FFFFFF | #FFD700 | #FF3333 | #00FFFF",
        "fontSize": "56px | 32px | 24px"
      }
    }
  ]
}

QUY TẮC BẮT BUỘC VỀ PHÂN SỐ THỜI GIAN:
- startFraction và endFraction là PHÂN SỐ TƯƠNG ĐỐI trong khoảng [0.0, 1.0].
- 0.0 = đầu video, 1.0 = cuối video.
- Tổng các phân đoạn (segments) phải bao phủ từ 0.0 đến 1.0 không có khoảng trống (không bị trùng lặp hay có khoảng trống ở giữa).
- Cần tạo các textOverlays phù hợp với nội dung và thời lượng của video (để phân bổ đều từ 0.0 đến 1.0).
- Hãy sáng tạo các phụ đề hoặc tiêu đề có ý nghĩa liên quan mật thiết đến yêu cầu của người dùng.`;

  console.log(`[videoBlueprintService] Calling FreeLLM to generate fallback VideoStyleSchema...`);
  try {
    const style = await freeLLMJson<VideoStyleSchema>(promptText, {
      temperature: 0.7,
      maxTokens: 1500,
    });
    
    if (!style.segments || style.segments.length === 0) {
      style.segments = [{ startFraction: 0.0, endFraction: 1.0, playbackRate: 1.0 }];
    }
    
    style.segments.sort((a, b) => a.startFraction - b.startFraction);
    style.segments[0].startFraction = 0.0;
    style.segments[style.segments.length - 1].endFraction = 1.0;
    
    return style;
  } catch (err) {
    console.error(`[videoBlueprintService] FreeLLM fallback failed:`, err);
    return {
      editingStyle: "standard cinematic",
      musicGenre: "lofi",
      useSFXTransitions: true,
      segments: [
        {
          startFraction: 0.0,
          endFraction: 1.0,
          playbackRate: 1.0,
        }
      ],
      textOverlays: [
        {
          content: userHint.slice(0, 50),
          startFraction: 0.1,
          endFraction: 0.5,
          style: {
            position: "bottom-center",
            color: "#FFD700",
            fontSize: "32px",
          }
        }
      ]
    };
  }
}

async function generateStyleFallbackForCopy(d1: number, d2: number): Promise<VideoStyleSchema> {
  const promptText = `Bạn là một chuyên gia biên tập video chuyên nghiệp.
Do hệ thống phân tích hình ảnh đang tạm thời gián đoạn, chúng tôi cần bạn thiết kế một phong cách biên tập video (VideoStyleSchema) chất lượng cao để áp dụng từ video mẫu (thời lượng gốc ${d1} giây) sang video mới (thời lượng đích ${d2} giây).

Hãy thiết kế một sơ đồ biên tập hấp dẫn, phân chia video thành các phần hợp lý bằng tỷ lệ [0.0, 1.0], thêm bộ lọc màu sắc sinh động, hiệu ứng chuyển cảnh mượt mà, và phụ đề/tiêu đề gợi ý.

⚠️ YÊU CẦU ĐẦU RA (MANDATORY):
Trả về MỘT đối tượng JSON hợp lệ theo schema sau. KHÔNG thêm văn bản nào khác.

{
  "editingStyle": "mô tả ngắn về phong cách dựng tổng thể",
  "musicGenre": "upbeat | tech | corporate | lofi | acoustic | none",
  "useSFXTransitions": true | false,
  "segments": [
    {
      "startFraction": <số từ 0.0 đến 1.0>,
      "endFraction": <số từ 0.0 đến 1.0>,
      "playbackRate": <1.0 bình thường>,
      "filters": { "brightness": 1.0, "contrast": 1.0, "saturate": 1.0, "grayscale": 0.0 },
      "effects": { "zoom": "none | in | out", "transition": "none | fade" }
    }
  ],
  "textOverlays": [
    {
      "content": "Tiêu đề hoặc phụ đề gợi ý",
      "startFraction": <0.0 đến 1.0>,
      "endFraction": <0.0 đến 1.0>,
      "style": { "position": "bottom-center", "color": "#FFD700", "fontSize": "32px" }
    }
  ]
}

QUY TẮC PHÂN SỐ THỜI GIAN:
- startFraction và endFraction là PHÂN SỐ TƯƠNG ĐỐI [0.0, 1.0].
- Các phân đoạn phải bao phủ toàn bộ từ 0.0 đến 1.0.`;

  console.log(`[videoBlueprintService] Calling FreeLLM to generate fallback VideoStyleSchema for copyAndScale...`);
  try {
    return await freeLLMJson<VideoStyleSchema>(promptText, {
      temperature: 0.6,
      maxTokens: 1200,
    });
  } catch (err) {
    console.error(`[videoBlueprintService] FreeLLM copy fallback failed:`, err);
    return {
      editingStyle: "cinematic style transfer fallback",
      musicGenre: "acoustic",
      useSFXTransitions: true,
      segments: [
        {
          startFraction: 0.0,
          endFraction: 1.0,
          playbackRate: 1.0,
        }
      ],
      textOverlays: [
        {
          content: "Chỉnh sửa tự động",
          startFraction: 0.1,
          endFraction: 0.4,
          style: {
            position: "bottom-center",
            color: "#FFD700",
            fontSize: "32px",
          }
        }
      ]
    };
  }
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
   * Phân tích video mẫu để trích xuất phong cách dựng phim.
   *
   * PHƯƠNG PHÁP MỚI (chính xác):
   *   1. Gemini phân tích video mẫu và trả về JSON có timestamp dạng PHÂN SỐ (0.0–1.0).
   *   2. Backend tự nhân phân số với targetDuration để ra giây chính xác.
   *   => Tránh hoàn toàn việc để LLM tính toán số học.
   *
   * Kết quả trả về là prompt mô tả kịch bản dựa trên style đã scale sang target duration.
   */
  async extractVideoStyle(
    videoUrl: string,
    durationSeconds?: number,
    targetVideoUrl?: string,
    targetDuration?: number,
    userPrompt?: string
  ): Promise<string> {
    const tempVideoPath = path.join(os.tmpdir(), `temp_style_extraction_${Date.now()}.mp4`);

    let style: VideoStyleSchema | null = null;

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

      // Chờ cho file xử lý xong trên Gemini (tối đa 2 phút = 60 lần × 2s)
      let fileState = await ai.files.get({ name: uploadResult.name });
      let pollAttempts = 0;
      const MAX_POLL = 60;
      while (fileState.state === "PROCESSING") {
        if (pollAttempts >= MAX_POLL) {
          throw new Error("Gemini File API timeout: video đang xử lý quá lâu (> 2 phút).");
        }
        console.log(`[videoBlueprintService] Video is processing by Gemini, waiting 2 seconds... (attempt ${pollAttempts + 1}/${MAX_POLL})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await ai.files.get({ name: uploadResult.name });
        pollAttempts++;
      }

      if (fileState.state !== "ACTIVE") {
        throw new Error(`Gemini File API processing failed: ${fileState.state}`);
      }

      console.log("[videoBlueprintService] File is ACTIVE. Calling Gemini model to extract structured style JSON...");

      const sourceDuration = durationSeconds || 60;

      const userHintSection = (userPrompt && userPrompt.trim())
        ? `\n\nNgoài ra, hãy kết hợp thêm ý tưởng/yêu cầu chỉnh sửa cụ thể này từ người dùng vào khi xây dựng kịch bản: "${userPrompt.trim()}"`
        : "";

      const analysisPrompt = `Hãy phân tích phong cách biên tập và kỹ thuật dựng hình của video này (tổng thời lượng ${sourceDuration} giây).

⚠️ YÊU CẦU ĐẦU RA (MANDATORY - CRITICAL):
Trả về CHÍNH XÁC một đối tượng JSON hợp lệ theo schema sau. KHÔNG thêm bất kỳ văn bản nào ngoài JSON.

{
  "editingStyle": "mô tả ngắn về phong cách dựng tổng thể (vd: fast-cut cinematic, slow narrative, upbeat social media)",
  "musicGenre": "upbeat | tech | corporate | lofi | acoustic | none",
  "useSFXTransitions": true | false,
  "segments": [
    {
      "startFraction": <số thập phân từ 0.0 đến 1.0 = vị trí tương đối trong video>,
      "endFraction": <số thập phân từ 0.0 đến 1.0>,
      "playbackRate": <1.0 là tốc độ thường, 2.0 là gấp đôi, 0.5 là chậm gấp đôi>,
      "filters": {
        "brightness": <0.5 đến 2.0, 1.0 là bình thường>,
        "contrast": <0.5 đến 2.0, 1.0 là bình thường>,
        "saturate": <0.0 đến 3.0>,
        "grayscale": <0.0 hoặc 1.0>
      },
      "effects": {
        "zoom": "in | out | none",
        "transition": "fade | none"
      }
    }
  ],
  "textOverlays": [
    {
      "content": "Chèn chữ tiêu đề mẫu",
      "startFraction": <0.0 đến 1.0>,
      "endFraction": <0.0 đến 1.0>,
      "style": {
        "position": "bottom-center | center | top-center",
        "color": "#FFFFFF | #FFD700 | #FF3333 | #00FFFF",
        "fontSize": "56px | 32px | 24px"
      }
    }
  ]
}

QUY TẮC BẮT BUỘC VỀ PHÂN SỐ THỜI GIAN:
- startFraction và endFraction là PHÂN SỐ TƯƠNG ĐỐI trong khoảng [0.0, 1.0].
- 0.0 = đầu video, 1.0 = cuối video.
- Ví dụ: nếu một hiệu ứng xảy ra ở giây thứ 15 trong video 60 giây, thì startFraction = 15/60 = 0.25.
- KHÔNG dùng giây thực, KHÔNG dùng millisecond.
- Tổng các phân đoạn (segments) phải bao phủ từ 0.0 đến 1.0 không có khoảng trống.

QUY TẮC VỀ NỘI DUNG:
- TUYỆT ĐỐI KHÔNG mô tả nội dung cụ thể (nhân vật, đồ vật, cảnh vật) của video.
- CHỈ trích xuất kỹ thuật dựng: nhịp cắt ghép, bộ lọc màu, hiệu ứng zoom/fade, text overlay chung, nhạc.
- Nội dung text overlay phải là chung chung (ví dụ: "Chèn tiêu đề ở đây", "Phụ đề mẫu").
${userHintSection}`;

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
        config: {
          responseMimeType: "application/json",
        }
      });

      const rawJson = analysisResponse.text || "";
      console.log("[videoBlueprintService] Raw style JSON from Gemini (first 500 chars):", rawJson.substring(0, 500));

      style = safeParseJson(rawJson) as VideoStyleSchema;

      // Xóa file trên Gemini để dọn dẹp
      try {
        await ai.files.delete({ name: uploadResult.name });
        console.log(`[videoBlueprintService] Deleted file from Gemini: ${uploadResult.name}`);
      } catch (delErr) {
        console.warn("[videoBlueprintService] Failed to delete file from Gemini:", delErr);
      }
    } catch (err) {
      console.error("[videoBlueprintService] Error during multimodal analysis of video:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isQuotaOrLimitError = (err as any)?.status === 429 || 
                                  errorMsg.includes("429") || 
                                  errorMsg.includes("RESOURCE_EXHAUSTED") || 
                                  errorMsg.includes("quota") ||
                                  errorMsg.includes("prepayment credits are depleted") ||
                                  errorMsg.includes("billing");

      if ((isQuotaOrLimitError || isOverloadError(err)) && isFreeLLMConfigured()) {
        console.warn("[videoBlueprintService] Gemini failed during style extraction. Falling back to FreeLLM...");
        try {
          style = await generateStyleViaFreeLLM(userPrompt, durationSeconds || 60, targetDuration);
        } catch (fallbackErr) {
          console.error("[videoBlueprintService] FreeLLM fallback style generation failed:", fallbackErr);
        }
      }

      if (!style) {
        if (isOverloadError(err)) {
          throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
        }
        throw new Error(`Lỗi khi phân tích video mẫu: ${err instanceof Error ? err.message : String(err)}`);
      }
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

    if (!style) {
      throw new Error("Không nhận diện được nội dung kịch bản phân tích từ video mẫu.");
    }

    // ── Code-side scaling: convert fractions to actual seconds for the target ──
    const effectiveDuration = durationSeconds || 60;
    const scaledDuration = targetDuration || effectiveDuration;

    // Build a human-readable prompt from the structured style JSON so the rest of
    // the pipeline (prompt field in UI, generateBlueprintFromPrompt) works correctly.
    const lines: string[] = [
      `Đây là hướng dẫn biên tập video được trích xuất từ video mẫu (tổng thời lượng gốc: ${effectiveDuration}s) và được điều chỉnh cho video đích (${scaledDuration}s).`,
      ``,
      `**Phong cách dựng tổng thể:** ${style.editingStyle}`,
      ``,
      `**Nhạc nền:** ${style.musicGenre !== "none" ? style.musicGenre : "Không dùng nhạc"}`,
      `**Hiệu ứng SFX chuyển cảnh:** ${style.useSFXTransitions ? "Có" : "Không"}`,
      ``,
      `**Các phân đoạn (đã scale sang video đích ${scaledDuration}s):**`,
    ];

    if (style.segments && style.segments.length > 0) {
      for (const seg of style.segments) {
        const startSec = parseFloat((seg.startFraction * scaledDuration).toFixed(2));
        const endSec = parseFloat((seg.endFraction * scaledDuration).toFixed(2));
        const rate = seg.playbackRate ?? 1.0;
        const filterDesc = seg.filters
          ? Object.entries(seg.filters).map(([k, v]) => `${k}=${v}`).join(", ")
          : "none";
        const effectDesc = seg.effects
          ? `zoom=${seg.effects.zoom ?? "none"}, transition=${seg.effects.transition ?? "none"}`
          : "none";
        lines.push(
          `- Từ ${startSec}s đến ${endSec}s: playbackRate=${rate}, filters=[${filterDesc}], effects=[${effectDesc}]`
        );
      }
    }

    if (style.textOverlays && style.textOverlays.length > 0) {
      lines.push(``, `**Text Overlays (đã scale sang video đích ${scaledDuration}s):**`);
      for (const overlay of style.textOverlays) {
        const startSec = parseFloat((overlay.startFraction * scaledDuration).toFixed(2));
        const endSec = parseFloat((overlay.endFraction * scaledDuration).toFixed(2));
        const pos = overlay.style?.position ?? "bottom-center";
        const color = overlay.style?.color ?? "#FFD700";
        const size = overlay.style?.fontSize ?? "32px";
        lines.push(
          `- Chèn chữ "${overlay.content}" từ ${startSec}s đến ${endSec}s, vị trí: ${pos}, màu: ${color}, cỡ chữ: ${size}`
        );
      }
    }

    if (userPrompt && userPrompt.trim()) {
      lines.push(``, `**Ý tưởng bổ sung từ người dùng:** ${userPrompt.trim()}`);
    }

    const result = lines.join("\n");
    console.log("[videoBlueprintService] Style extraction completed. Result length:", result.length);

    // Attach raw style JSON as metadata comment for downstream fast-path use.
    // Guard: targetDuration must be > 0 to produce valid blueprint later.
    const effectiveTargetDuration = scaledDuration > 0 ? scaledDuration : effectiveDuration;
    const jsonMeta = `\n\n<!-- STYLE_JSON:${JSON.stringify({ style, targetDuration: effectiveTargetDuration, targetVideoUrl: targetVideoUrl || null })} -->`;
    return result + jsonMeta;
  },

  /**
   * Sử dụng Gemini để phân tích video cũ, sau đó tạo Blueprint mới cho video mới.
   * Được gọi khi có 2+ video trong danh sách (video[0] = mẫu, video[1] = đích).
   */
  async copyAndScaleBlueprint(
    userId: string,
    urls: string[],
    urlDurations: { [url: string]: number }
  ): Promise<any> {
    if (urls.length < 2) {
      throw new Error("Vui lòng tải lên ít nhất 2 video (video đầu tiên là video mẫu đã sửa, video thứ hai là video mới cần áp dụng chỉnh sửa).");
    }

    const video1Url = urls[0];
    const video2Url = urls[1];

    const d1 = urlDurations[video1Url] || 0;
    const d2 = urlDurations[video2Url] || 0;

    const tempVideoPath = path.join(os.tmpdir(), `temp_copy_template_${Date.now()}.mp4`);
    let style: VideoStyleSchema | null = null;

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

      // Chờ cho file xử lý xong trên Gemini (tối đa 2 phút = 60 lần × 2s)
      let fileState = await ai.files.get({ name: uploadResult.name });
      let pollAttempts = 0;
      const MAX_POLL = 60;
      while (fileState.state === "PROCESSING") {
        if (pollAttempts >= MAX_POLL) {
          throw new Error("Gemini File API timeout: video đang xử lý quá lâu (> 2 phút).");
        }
        console.log(`[videoBlueprintService] Video is processing by Gemini, waiting 2 seconds... (attempt ${pollAttempts + 1}/${MAX_POLL})`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        fileState = await ai.files.get({ name: uploadResult.name });
        pollAttempts++;
      }

      if (fileState.state !== "ACTIVE") {
        throw new Error(`Gemini File API processing failed: ${fileState.state}`);
      }

      console.log("[videoBlueprintService] File is ACTIVE. Calling Gemini model to extract structured style JSON...");

      const analysisPrompt = `Phân tích kỹ thuật dựng hình và phong cách biên tập của video này (tổng thời lượng ${d1} giây).

⚠️ YÊU CẦU ĐẦU RA (MANDATORY):
Trả về MỘT đối tượng JSON hợp lệ theo schema sau. KHÔNG thêm văn bản nào khác.

{
  "editingStyle": "mô tả ngắn về phong cách dựng tổng thể",
  "musicGenre": "upbeat | tech | corporate | lofi | acoustic | none",
  "useSFXTransitions": true | false,
  "segments": [
    {
      "startFraction": <số từ 0.0 đến 1.0 — vị trí tương đối trong video>,
      "endFraction": <số từ 0.0 đến 1.0>,
      "playbackRate": <1.0 bình thường>,
      "filters": { "brightness": 1.0, "contrast": 1.0, "saturate": 1.0, "grayscale": 0.0 },
      "effects": { "zoom": "none | in | out", "transition": "none | fade" }
    }
  ],
  "textOverlays": [
    {
      "content": "Chèn chữ tiêu đề",
      "startFraction": <0.0 đến 1.0>,
      "endFraction": <0.0 đến 1.0>,
      "style": { "position": "bottom-center", "color": "#FFD700", "fontSize": "32px" }
    }
  ]
}

QUY TẮC PHÂN SỐ THỜI GIAN:
- startFraction và endFraction là PHÂN SỐ TƯƠNG ĐỐI [0.0, 1.0]. Ví dụ: giây 15 trong video 60s → fraction = 0.25.
- KHÔNG dùng giây thực. KHÔNG dùng millisecond.
- Các phân đoạn phải bao phủ toàn bộ từ 0.0 đến 1.0.
- KHÔNG mô tả nội dung cụ thể (nhân vật, đồ vật), chỉ mô tả kỹ thuật dựng.`;

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
        config: {
          responseMimeType: "application/json",
        }
      });

      const rawJson = analysisResponse.text || "";
      console.log("[videoBlueprintService] copyAndScale: Raw style JSON (first 500):", rawJson.substring(0, 500));
      style = safeParseJson(rawJson) as VideoStyleSchema;

      // Xóa file trên Gemini để dọn dẹp
      try {
        await ai.files.delete({ name: uploadResult.name });
        console.log(`[videoBlueprintService] Deleted file from Gemini: ${uploadResult.name}`);
      } catch (delErr) {
        console.warn("[videoBlueprintService] Failed to delete file from Gemini:", delErr);
      }
    } catch (err) {
      console.error("[videoBlueprintService] Error during multimodal analysis of video 1:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isQuotaOrLimitError = (err as any)?.status === 429 || 
                                  errorMsg.includes("429") || 
                                  errorMsg.includes("RESOURCE_EXHAUSTED") || 
                                  errorMsg.includes("quota") ||
                                  errorMsg.includes("prepayment credits are depleted") ||
                                  errorMsg.includes("billing");

      if ((isQuotaOrLimitError || isOverloadError(err)) && isFreeLLMConfigured()) {
        console.warn("[videoBlueprintService] Gemini failed in copyAndScale. Falling back to FreeLLM...");
        try {
          style = await generateStyleFallbackForCopy(d1, d2);
        } catch (fallbackErr) {
          console.error("[videoBlueprintService] FreeLLM copy fallback style generation failed:", fallbackErr);
        }
      }

      if (!style) {
        if (isOverloadError(err)) {
          throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
        }
        throw new Error(`Lỗi khi phân tích video gốc: ${err instanceof Error ? err.message : String(err)}`);
      }
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

    if (!style) {
      throw new Error("Không nhận diện được nội dung kịch bản phân tích từ video mẫu.");
    }

    // BUG-13 guard: d2 must be > 0 or all timestamps will be 0
    if (d2 <= 0) {
      throw new Error("Không xác định được thời lượng video đích. Vui lòng kiểm tra lại video đầu vào.");
    }

    // ── Code-side scaling: multiply fractions by target duration ──────────────
    console.log(`[videoBlueprintService] Building blueprint for target video (${d2}s) from style (source ${d1}s)...`);
    const blueprint = buildBlueprintFromStyle(video2Url, d2, style);

    // Sanity check
    if (!blueprint.timeline || !Array.isArray(blueprint.timeline) || blueprint.timeline.filter((item: any) => item.type === "video").length === 0) {
      console.warn("[videoBlueprintService] Blueprint has no video track, adding fallback.");
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

    console.log("[videoBlueprintService] Blueprint generated successfully via code-side scaling.");
    return blueprint;
  },

  /**
   * Sinh cấu trúc JSON Blueprint trực tiếp từ Prompt chỉnh sửa của người dùng.
   * Nếu prompt có chứa metadata STYLE_JSON, tạo blueprint từ structured style.
   * Ngược lại, dùng LLM để sinh blueprint từ văn bản mô tả.
   */
  async generateBlueprintFromPrompt(
    videoUrl: string,
    duration: number,
    prompt: string
  ): Promise<any> {
    if (!prompt || !prompt.trim()) {
      console.log("[videoBlueprintService] Prompt is empty, returning default unedited timeline blueprint.");
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

    // ── Fast path: if prompt contains embedded STYLE_JSON, use code-side builder ──
    const styleJsonMatch = prompt.match(/<!--\s*STYLE_JSON:(.*?)\s*-->/s);
    if (styleJsonMatch) {
      try {
        const meta = JSON.parse(styleJsonMatch[1]);
        const style = meta.style as VideoStyleSchema;
        const targetDuration = meta.targetDuration ?? duration;
        const targetVideoUrl = meta.targetVideoUrl ?? videoUrl;

        // Extract user hints from the text (before the JSON comment)
        const textPart = prompt.replace(/<!--\s*STYLE_JSON:.*?-->/s, "").trim();

        console.log(`[videoBlueprintService] Using code-side blueprint builder from embedded STYLE_JSON (targetDuration=${targetDuration}s)`);
        const blueprint = buildBlueprintFromStyle(targetVideoUrl || videoUrl, targetDuration, style, textPart);

        if (!blueprint.timeline || blueprint.timeline.filter((e: any) => e.type === "video").length === 0) {
          blueprint.timeline = [{ type: "video", src: videoUrl, start: 0, end: duration, playbackRate: 1.0 }];
        }

        return blueprint;
      } catch (parseErr) {
        console.warn("[videoBlueprintService] Failed to parse embedded STYLE_JSON, falling back to LLM:", parseErr);
      }
    }

    // ── Standard LLM path ─────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(videoUrl, duration);
    const userPromptText = `Hãy tạo kịch bản chỉnh sửa video JSON Blueprint cho Video có URL "${videoUrl}" và thời lượng ${duration} giây.\nYêu cầu chỉnh sửa: "${prompt}"\n\nĐảm bảo kết quả đầu ra CHỈ là JSON thô, không chứa thẻ markdown hay lời nói thừa.`;

    console.log("[videoBlueprintService] Calling Gemini model to generate blueprint from prompt...");
    try {
      const blueprintResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPromptText,
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
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isQuotaOrLimitError = (err as any)?.status === 429 || 
                                  errorMsg.includes("429") || 
                                  errorMsg.includes("RESOURCE_EXHAUSTED") || 
                                  errorMsg.includes("quota") ||
                                  errorMsg.includes("prepayment credits are depleted") ||
                                  errorMsg.includes("billing");

      if ((isQuotaOrLimitError || isOverloadError(err)) && isFreeLLMConfigured()) {
        console.warn("[videoBlueprintService] Gemini failed in generateBlueprintFromPrompt. Falling back to FreeLLM...");
        try {
          const systemInstruction = buildSystemPrompt(videoUrl, duration);
          const blueprint = await freeLLMJson(userPromptText, {
            systemPrompt: systemInstruction,
            temperature: 0.7,
            maxTokens: 2000,
          });

          if (blueprint && blueprint.timeline && Array.isArray(blueprint.timeline)) {
            if (blueprint.timeline.filter((item: any) => item.type === "video").length === 0) {
              blueprint.timeline.unshift({
                type: "video",
                src: videoUrl,
                start: 0,
                end: duration,
                playbackRate: 1.0
              });
            }
            console.log("[videoBlueprintService] Generated blueprint via FreeLLM fallback successfully.");
            return blueprint;
          }
        } catch (fallbackErr) {
          console.error("[videoBlueprintService] FreeLLM blueprint generation failed:", fallbackErr);
        }
      }

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
