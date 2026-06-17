import { GoogleGenAI, Type } from "@google/genai";
import { AIMediaModel } from "../model/ai-media.model";
import { cloudinaryService } from "./cloudinary.service";
import { remotionService } from "./remotion.service";
import { piapiService } from "./piapi.service";
import { remotionQueueService } from "./remotion-queue.service";
import { videoBlueprintService } from "./video-blueprint.service";
import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GEMINI_TEXT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_HEAVY_MODEL = process.env.GEMINI_HEAVY_MODEL || "gemini-3.5-flash";
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "piapi-flux";
const GEMINI_VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL || "veo31-video-fast-audio";

function getGeminiClient() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
}

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

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        }
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} - ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }
    if (i < retries - 1) {
      console.warn(`[fetchWithRetry] Failed to fetch ${url}. Retrying in ${delay}ms... Error: ${lastError?.message || lastError}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw lastError;
}

async function getVideoDuration(url: string): Promise<number> {
  try {
    const matchedRecord = await AIMediaModel.findOne({ url }).lean();
    if (matchedRecord?.metadata?.duration) {
      const dur = Number(matchedRecord.metadata.duration);
      if (dur > 0) return dur;
    }
  } catch (dbErr) {
    console.warn("[geminiService.getVideoDuration] DB query failed:", dbErr);
  }

  return new Promise<number>((resolve) => {
    const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${url}"`;
    exec(cmd, (error, stdout) => {
      if (!error && stdout) {
        const dur = parseFloat(stdout.trim());
        if (!isNaN(dur) && dur > 0) {
          resolve(dur);
          return;
        }
      }
      resolve(5); // default fallback
    });
  });
}

function normalizePiapiVideoModel(modelName?: string): string {
  const rawModel = (modelName || GEMINI_VIDEO_MODEL || "").trim();
  const normalizedModel = rawModel.toLowerCase();

  if (
    normalizedModel === "veo-3.1-generate-preview" ||
    normalizedModel === "veo31-video-audio" ||
    normalizedModel === "piapi-veo31-video-audio" ||
    normalizedModel === "veo"
  ) {
    return "veo31-video-audio";
  }

  if (
    normalizedModel === "veo-3.1-fast-generate-preview" ||
    normalizedModel === "veo31-video-fast-audio" ||
    normalizedModel === "piapi-veo31-video-fast-audio"
  ) {
    return "veo31-video-fast-audio";
  }

  if (
    normalizedModel === "veo-3.1-lite-generate-preview" ||
    normalizedModel === "veo31-video-fast-no-audio" ||
    normalizedModel === "piapi-veo31-video-fast-no-audio"
  ) {
    return "veo31-video-fast-no-audio";
  }

  if (normalizedModel.includes("veo-3.1") || normalizedModel.includes("veo31") || normalizedModel.startsWith("veo3")) {
    return "veo31-video-audio";
  }

  if (normalizedModel.startsWith("piapi-")) {
    return rawModel;
  }

  return "veo31-video-fast-audio";
}

function extractSourceBrief(rawText: string): {
  userRequest: string;
  attachedDocumentName: string;
  attachedDocumentExcerpt: string;
  normalizedBrief: string;
} {
  const text = String(rawText || "").trim();
  if (!text) {
    return {
      userRequest: "",
      attachedDocumentName: "",
      attachedDocumentExcerpt: "",
      normalizedBrief: "",
    };
  }

  const docMarker = "TÀI LIỆU ĐÍNH KÈM:";
  const docMarkerIndex = text.indexOf(docMarker);
  const userRequest = (docMarkerIndex >= 0 ? text.slice(0, docMarkerIndex) : text).trim();
  const attachedBlock = docMarkerIndex >= 0 ? text.slice(docMarkerIndex + docMarker.length).trim() : "";

  let attachedDocumentName = "";
  let attachedDocumentExcerpt = "";

  if (attachedBlock) {
    const nameMatch = attachedBlock.match(/Tên tài liệu:\s*(.+)/i);
    attachedDocumentName = String(nameMatch?.[1] || "").trim();

    const contentMatch = attachedBlock.match(/Nội dung tài liệu:\s*([\s\S]+)/i);
    attachedDocumentExcerpt = String(contentMatch?.[1] || attachedBlock)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2200);
  }

  const normalizedBrief = [
    userRequest ? `User request: ${userRequest}` : "",
    attachedDocumentName ? `Attached document: ${attachedDocumentName}` : "",
    attachedDocumentExcerpt ? `Attached document facts: ${attachedDocumentExcerpt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    userRequest,
    attachedDocumentName,
    attachedDocumentExcerpt,
    normalizedBrief,
  };
}

function buildFaithfulVisualGuardrail(input: {
  sourceBrief?: string;
  title?: string;
  summary?: string;
  suggestedContent?: string;
  outline?: string;
  bodyText?: string;
  channels?: string[];
  selectedPillars?: string[];
}) {
  const source = extractSourceBrief(input.sourceBrief || "");

  return [
    "STRICT SOURCE-OF-TRUTH REQUIREMENT:",
    source.userRequest ? `Original user brief in Vietnamese: ${source.userRequest}` : "",
    source.attachedDocumentName ? `Attached source file: ${source.attachedDocumentName}` : "",
    source.attachedDocumentExcerpt ? `Facts extracted from the attached file: ${source.attachedDocumentExcerpt}` : "",
    input.title ? `Campaign title: ${input.title}` : "",
    input.summary ? `Campaign summary: ${input.summary}` : "",
    input.suggestedContent ? `Suggested content direction: ${input.suggestedContent}` : "",
    input.outline ? `Post outline: ${input.outline}` : "",
    input.bodyText ? `Post body/caption: ${input.bodyText}` : "",
    Array.isArray(input.channels) && input.channels.length > 0 ? `Target channels: ${input.channels.join(", ")}.` : "",
    Array.isArray(input.selectedPillars) && input.selectedPillars.length > 0 ? `Required pillars: ${input.selectedPillars.join(", ")}.` : "",
    "The English media prompt must preserve the exact meaning of the Vietnamese brief and attached file.",
    "If the brief mentions a company name, logo, product, salary, location, or other business details, these must appear in the generated image prompt.",
    "Do not omit or paraphrase critical business details that are present in the input.",
    "Do not add products, people, locations, industries, outfits, props, or use-cases that are not grounded in the source brief.",
    "Do not generalize into generic office, lifestyle, beauty, fashion, product showcase, or abstract marketing scenes unless the source explicitly asks for that.",
    "If the source is about software, ecommerce, logistics, education, training, omnichannel, operations, CRM, warehouse, or business workflow, the visual must clearly show that exact context.",
    "Translate faithfully into English for image/video generation, but keep the original business meaning, subject, context, and constraints unchanged.",
    "If the user mentions a brand, company name, or campaign name, include it in the image prompt as visible text, signage, uniform, or logo.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function generateText(
  model: string,
  contents: any,
  config?: {
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: any;
    images?: string[];
  }
): Promise<{ text: string }> {
  const ai = getGeminiClient();
  let modelId = model || GEMINI_TEXT_MODEL;
  if (modelId === "gemini-3.5-flash") {
    modelId = "gemini-2.5-flash";
  }

  // Build Gemini-native contents
  const geminiContents: any[] = [];

  if (typeof contents === "string") {
    const parts: any[] = [{ text: contents }];
    if (config?.images && config.images.length > 0) {
      for (const img of config.images) {
        if (img.startsWith("data:")) {
          const mimeMatch = img.match(/^data:([^;]+);base64,(.+)$/);
          if (mimeMatch) {
            parts.push({ inlineData: { mimeType: mimeMatch[1], data: mimeMatch[2] } });
          }
        } else {
          parts.push({ fileData: { fileUri: img } });
        }
      }
    }
    geminiContents.push({ role: "user", parts });
  } else if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === "string") {
        geminiContents.push({ role: "user", parts: [{ text: item }] });
      } else if (item.role && item.parts) {
        geminiContents.push({ role: item.role === "model" ? "model" : "user", parts: item.parts });
      } else if (item.text) {
        geminiContents.push({ role: "user", parts: [{ text: item.text }] });
      }
    }
  }

  const geminiConfig: any = {
    temperature: config?.temperature ?? 0.7,
  };

  if (config?.systemInstruction) {
    geminiConfig.systemInstruction = config.systemInstruction;
  }

  if (config?.responseMimeType) {
    geminiConfig.responseMimeType = config.responseMimeType;
  }

  if (config?.responseSchema) {
    geminiConfig.responseMimeType = "application/json";
    geminiConfig.responseSchema = config.responseSchema;
  }

  const geminiStartTime = Date.now();
  console.log(`[generateText] Calling Gemini API | model=${modelId} | contentParts=${geminiContents.length} | hasSchema=${!!geminiConfig.responseSchema} | hasImages=${!!(config?.images?.length)}`);

  const maxRetries = 4;
  let delay = 1000;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: geminiContents,
        config: geminiConfig,
      });

      const geminiElapsed = Date.now() - geminiStartTime;
      const text = response.text || "";
      console.log(`[generateText] Gemini API responded | ${geminiElapsed}ms (${(geminiElapsed / 1000).toFixed(1)}s) | responseLen=${text.length}`);
      return { text };
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const isRateLimit = error?.status === 429 || errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("quota");
      const isUnavailable = error?.status === 503 || errorMsg.includes("503") || errorMsg.includes("UNAVAILABLE") || errorMsg.includes("experiencing high demand");
      const isNetworkError = errorMsg.includes("fetch failed") || errorMsg.includes("ENOTFOUND") || errorMsg.includes("ECONNRESET") || errorMsg.includes("ETIMEDOUT") || errorMsg.includes("socket");

      if ((isRateLimit || isUnavailable || isNetworkError) && attempt < maxRetries) {
        console.warn(`[generateText] Attempt ${attempt} failed with API error (rate-limit/unavailable/network). Retrying in ${delay}ms... Error: ${errorMsg}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else if (isUnavailable) {
        // Throw user-friendly message for overload errors after all retries are exhausted
        throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
      } else {
        throw error;
      }
    }
  }

  // Final check: if last error was an overload error, return friendly message
  const lastErrorMsg = lastError?.message || String(lastError);
  const wasOverloaded = lastError?.status === 503 || lastErrorMsg.includes("503") || lastErrorMsg.includes("UNAVAILABLE") || lastErrorMsg.includes("experiencing high demand");
  if (wasOverloaded) {
    throw new Error("Mô hình AI quá tải, vui lòng thử lại sau.");
  }
  throw lastError;
}

export const geminiService = {
  normalizeMarketingChannel(rawChannel: string): string {
    if (!rawChannel) return "Facebook";
    const c = String(rawChannel).toLowerCase().trim();
    if (c.includes("facebook") || c === "fb") return "Facebook";
    if (c.includes("tiktok") || c.includes("tik tok")) return "TikTok";
    if (c.includes("linkedin") || c.includes("linked in")) return "LinkedIn";
    if (c.includes("instagram") || c === "ig" || c.includes("insta")) return "Instagram";
    if (c.includes("zalo")) return "Zalo";
    return "Facebook";
  },

  sanitizeHashtags(rawHashtags: unknown, fallbackTitle: string): string[] {
    const hashtags = Array.isArray(rawHashtags) ? rawHashtags : [];
    const normalized = hashtags
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
      .map((tag) => tag.replace(/\s+/g, ""))
      .filter((tag, index, arr) => arr.indexOf(tag) === index);

    if (normalized.length > 0) {
      return normalized.slice(0, 6);
    }

    const fallback = String(fallbackTitle || "")
      .split(/[^A-Za-z0-9À-ỹ]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
      .slice(0, 3)
      .map((part) => `#${part}`);

    return fallback.length > 0 ? fallback : ["#Marketing"];
  },

  /**
   * Trợ lý Chat CRM Omni-Inbox
   */
  async chat(
    message: string,
    history: any[],
    aiConfig: any,
    ragContext?: { contextText?: string; companyCode?: string; matches?: number }
  ): Promise<{ text: string; isMock: boolean }> {
    const getMockResponse = () => {
      return new Promise<{ text: string; isMock: boolean }>((resolve) => {
        setTimeout(() => {
          let replyText = `[Giả lập Trợ lý AI] Cảm ơn bạn đã phản hồi! Với cài đặt Trợ lý AI (Cấu hình: ${aiConfig.autoClassify ? "Tự phân loại" : "Thường"
            }), tôi đề xuất phương án tối ưu cho bạn.`;

          const msgLower = message.toLowerCase();
          if (msgLower.includes("giá") || msgLower.includes("bao nhiêu")) {
            replyText =
              "Chào bạn! Hiện tại dòng sản phẩm Thiết bị đeo thông minh X1 đang có giá ưu đãi là 1.890.000đ (giảm từ 2.450.000đ). Trợ lý AI có thể hỗ trợ tạo đơn hàng ngay lập tức nếu bạn sẵn sàng!";
          } else if (msgLower.includes("khuyến mãi") || msgLower.includes("ưu đãi")) {
            replyText =
              "Dạ, bên mình đang có chương trình khuyến mãi 'SIÊU ƯU ĐÃI THÁNG 10': giảm giá lên đến 30% cho toàn bộ linh kiện robot và tặng voucher 200k cho đơn hàng sau đó. Bạn có muốn nhận mã voucher không ạ?";
          } else if (msgLower.includes("vận chuyển") || msgLower.includes("ship")) {
            replyText =
              "Đơn hàng của bạn sẽ được hỗ trợ Freeship toàn quốc cho các hóa đơn từ 500k trở lên. Thời gian giao hàng dự kiến là từ 2-3 ngày làm việc đối với khu vực tỉnh thành khác, Hà Nội/HCM sẽ nhận hàng trong ngày ạ!";
          }
          resolve({ text: replyText, isMock: true });
        }, 800);
      });
    };

    if (!process.env.GEMINI_API_KEY) {
      return getMockResponse();
    }

    const hasCompanyKnowledge = !!ragContext?.contextText;
    const assistantMode = hasCompanyKnowledge ? "COMPANY_TRAINED_MODE" : "DEFAULT_ASSISTANT_MODE";

    const systemInstruction = `
Bạn là một Trợ lý Chăm sóc Khách hàng AI đỉnh cao cho hệ thống iGen ERP doanh nghiệp.
Bạn đang hỗ trợ khách hàng trong khung chat Omni-Inbox.

QUY CHUẨN XƯNG HÔ VÀ CHÀO HỎI CHUYÊN NGHIỆP:
- Luôn mở đầu câu trả lời bằng lời chào lịch sự như: "Dạ, [Tên doanh nghiệp] xin chào anh/chị ạ!" hoặc "Dạ, em chào anh/chị ạ!" hoặc "Dạ xin kính chào Quý khách!".
- Luôn xưng hô là "Dạ, bên em..." hoặc "Dạ, [Tên doanh nghiệp]..." hoặc "Dạ, em..." và gọi khách hàng là "Quý khách" hoặc "Anh/Chị".
- Luôn sử dụng kính ngữ "Dạ" ở đầu câu và "ạ" ở cuối câu để đảm bảo sự lịch thiệp, tôn trọng và chuyên nghiệp tuyệt đối.
- Tuyệt đối KHÔNG sử dụng các từ xưng hô quá thân mật hoặc thiếu trang trọng như "cậu", "tớ", "bạn", "mày", "tao".
- Trả lời bằng ngôn phong tiếng Việt chuẩn mực, tinh tế, tích cực, không dùng ngôn ngữ teen, từ lóng hoặc icon quá đà.

Quy tắc và chỉ dẫn hành xử từ doanh nghiệp:
${aiConfig.advancedInstructions ? `- ${aiConfig.advancedInstructions}` : "- Không có chỉ dẫn đặc biệt."}

Dữ liệu vận hành hiện tại:
- Chế độ trả lời: ${assistantMode}
- COMPANY_TRAINED_MODE: đã có tài liệu/chính sách riêng của công ty, hãy bám sát tài liệu và nói theo chỉ dẫn doanh nghiệp.
- DEFAULT_ASSISTANT_MODE: chưa có tài liệu riêng, vẫn trả lời khách mặc định một cách lịch sự, hỗ trợ hỏi thêm nhu cầu và chuyển nhân viên khi cần.

Dữ liệu tri thức đã truy xuất riêng cho doanh nghiệp ${ragContext?.companyCode || "hiện tại"}:
${ragContext?.contextText ? ragContext.contextText : "- Không tìm thấy tri thức phù hợp trong kho dữ liệu."}

Quy tắc an toàn bắt buộc:
- Khi ở DEFAULT_ASSISTANT_MODE, vẫn được chào hỏi, xác nhận nhu cầu, hỏi thêm thông tin, hướng dẫn khách để lại số điện thoại/nhu cầu và nói sẽ có nhân viên hỗ trợ.
- Chỉ trả lời các thông tin cụ thể về giá, bảo hành, giao hàng, đổi trả, khuyến mãi nếu có trong dữ liệu tri thức ở trên hoặc trong lịch sử hội thoại.
- Nếu khách hỏi chính sách/giá/thông tin cụ thể mà không có dữ liệu phù hợp, hãy nói rằng bạn cần chuyển nhân viên kiểm tra lại, tuyệt đối không tự bịa.
- Không trộn lẫn thông tin giữa các công ty khác nhau.

Thông tin cấu hình hiện tại của bạn:
- Tự động phân loại khách hàng: ${aiConfig.autoClassify ? "Đang BẬT. Hãy phân loại khách dựa trên xu hướng hội thoại và thông báo khéo léo." : "Đang TẮT"}
- Tự động chốt đơn hàng: ${aiConfig.autoCloseDeal ? "Đang BẬT. Hãy tìm cơ hội khéo léo hướng khách hàng chốt mua sản phẩm một cách nhanh gọn, gửi thông tin tạo đơn." : "Đang TẮT"}
- Tự động xin feedback cuối hội thoại: ${aiConfig.autoFeedback ? "Đang BẬT. Nếu cuộc đối thoại đi đến hồi kết, hãy lịch sự xin ý kiến đánh giá chất lượng dịch vụ." : "Đang TẮT"}
- Với Nguyễn Thị Mai (khách VIP): hãy đối xử cực kỳ chu đáo, tặng voucher riêng VIP-10 nếu có ý than phiền hoặc hỏi giá.
`;

    const contents = history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    try {
      const selectedModel = aiConfig?.model || GEMINI_TEXT_MODEL;
      const response = await generateText(
        selectedModel,
        contents,
        {
          systemInstruction,
          temperature: 0.8,
        }
      );

      return {
        text: response.text || "Xin lỗi, tôi chưa thể xử lý yêu cầu lúc này. Vui lòng thử lại.",
        isMock: false,
      };
    } catch (error: any) {
      console.error("[geminiService.chat] Error:", error);
      throw error;
    }
  },

  /**
   * Tự động băm/chuyển đổi tài liệu dài thành danh sách FAQs rút gọn
   */
  async convertDocToFAQ(docText: string): Promise<string> {
    const getMockFAQ = () => {
      return `--- BẢN FAQ ĐÃ ĐƯỢC CHUẨN HÓA (CHẾ ĐỘ MÔ PHỎNG AI) ---
Q: Tài liệu này nói về chủ đề gì?
A: Tài liệu giới thiệu thông tin vận hành, chính sách bán hàng của doanh nghiệp.

Q: Làm thế nào để liên hệ hỗ trợ kỹ thuật?
A: Vui lòng liên hệ số hotline 1900xxxx hoặc email support@igen.com.

Q: Chính sách vận chuyển của chúng tôi là gì?
A: Giao hàng toàn quốc. Miễn phí vận chuyển cho đơn hàng trị giá từ 500k trở lên.`;
    };

    if (!process.env.GEMINI_API_KEY) {
      return getMockFAQ();
    }

    try {
      const prompt = `Bạn là một chuyên gia huấn luyện AI bán hàng và chăm sóc khách hàng.
Hãy đọc kỹ tài liệu bán hàng/quy trình/chính sách sau đây của doanh nghiệp và chuyển đổi toàn bộ thông tin quan trọng thành một danh sách các câu hỏi thường gặp FAQs định dạng chuẩn để làm dữ liệu huấn luyện cho Chatbot.

YÊU CẦU:
1. Định dạng câu trả lời bắt buộc là:
Q: [Câu hỏi của khách hàng]
A: [Câu trả lời chuẩn mực của AI]

Q: [Câu hỏi tiếp theo]
A: [Câu trả lời tiếp theo]

2. Hãy chắt lọc toàn bộ số hotline, bảng giá dịch vụ/sản phẩm, chính sách giao hàng, chính sách đổi trả/bảo hành, giờ mở cửa.
3. Không tự tiện bịa đặt thông tin không có trong tài liệu.
4. Trả lời bằng tiếng Việt lịch sự, súc tích và chính xác.

NỘI DUNG TÀI LIỆU CẦN CHUYỂN ĐỔI:
${docText}
`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt
      );

      return response.text || "Không thể trích xuất được dữ liệu FAQ từ tài liệu.";
    } catch (error: any) {
      console.error("[geminiService.convertDocToFAQ] Error, fallback to mock FAQ:", error);
      return getMockFAQ();
    }
  },

  /**
   * Tạo 3 gợi ý chủ đề marketing chung
   */
  async getMarketingSuggestions(): Promise<string[]> {
    const fallbackSuggestions = [
      "Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân kỷ niệm thành lập",
      "Chương trình khuyến mãi mùa hè giảm giá cực sốc kích cầu mua sắm",
      "Sự kiện ra mắt dòng sản phẩm mới hướng tới phong cách sống xanh bảo vệ môi trường",
    ];

    if (!process.env.GEMINI_API_KEY) {
      return fallbackSuggestions;
    }

    try {
      const prompt = `Bạn là trợ lý AI Marketing chuyên nghiệp. Hãy đề xuất đúng 3 ý tưởng/chủ đề chiến dịch marketing chung, mang tính phổ quát cao để nhiều loại hình doanh nghiệp hoặc công ty khác nhau đều có thể áp dụng được (ví dụ: chiến dịch khuyến mãi theo mùa, sự kiện tri ân khách hàng, ra mắt dòng sản phẩm mới, chương trình ưu đãi đặc biệt).
Mỗi ý tưởng đề xuất phải là một câu ngắn gọn (dưới 25 từ) sẵn sàng làm mục tiêu marketing, ví dụ: 'Chiến dịch tri ân khách hàng thân thiết và tặng quà tri ân'.
Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách đúng 3 ý tưởng/chủ đề gợi ý ngắn gọn",
              },
            },
            required: ["suggestions"],
          },
        }
      );

      const responseText = response.text || "{}";
      const parsedData = safeParseJson(responseText);
      return parsedData.suggestions || fallbackSuggestions;
    } catch (error: any) {
      console.error("[geminiService.getMarketingSuggestions] Fallback to mock suggestions:", error);
      return fallbackSuggestions;
    }
  },

  /**
   * Đề xuất Content Pillars
   */
  async analyzeMarketingPillars(campaignTopic: string, images?: string[]): Promise<{ pillars: any[]; isMock: boolean }> {
    const getMockPillars = () => {
      let mockPillars = [
        {
          id: "giao_duc_gia_tri",
          title: "Giáo dục & Giá trị hữu ích",
          ratio: "35% tỉ trọng",
          description: `Giải đáp trực quan, hướng dẫn tối ưu và chia sẻ kiến thức nền tảng giúp khách hàng hiểu sâu về giá trị dòng sản phẩm liên quan "${campaignTopic || "Sản phẩm công nghệ"
            }".`,
        },
        {
          id: "cau_chuyen_social_proof",
          title: "Trải nghiệm & Câu chuyện thực tế",
          ratio: "40% tỉ trọng",
          description: `Kịch bản review thực tế, kết quả và phát biểu từ khách hàng uy tín, tạo dựng lòng tin tuyệt đối cho thương hiệu.`,
        },
        {
          id: "uu_dai_tuong_tac",
          title: "Ưu đãi & Kích cầu hành động",
          ratio: "25% tỉ trọng",
          description:
            "Chiến dịch giờ vàng, đặc quyền dùng thử hoặc voucher độc quyền nhằm thúc giục khách hàng ra quyết định mua sắm ngay lập tức.",
        },
      ];

      const topicLower = campaignTopic ? campaignTopic.toLowerCase() : "";
      if (topicLower.includes("bàn phím") || topicLower.includes("keyboard") || topicLower.includes("workspace")) {
        mockPillars = [
          {
            id: "kien_thuc_cong_thai_hoc",
            title: "Kiến thức & Trải nghiệm Công thái học",
            ratio: "35% tỉ trọng",
            description:
              "Hướng dẫn tư thế ngồi gõ phím chuẩn khoa học, cách test switch phím cơ, mẹo lập trình không mỏi tay cho coder chuyên nghiệp.",
          },
          {
            id: "review_coder_thuc_te",
            title: "Đánh giá & Trải nghiệm Lập trình viên",
            ratio: "40% tỉ trọng",
            description:
              "Cảm âm đầm chắc của iGen Workspace V2, quá trình tăng 150% hiệu suất viết mã của kiến trúc sư phần mềm.",
          },
          {
            id: "uu_dai_ra_mat",
            title: "Ưu đãi đặc quyền Early Bird",
            ratio: "25% tỉ trọng",
            description:
              "Quà tặng kệ kê tay gỗ sồi cao cấp và chiết khấu 10% ra mắt độc quyền dành cho 50 khách hàng đầu tiên.",
          },
        ];
      } else if (topicLower.includes("tai nghe") || topicLower.includes("nghe nhạc") || topicLower.includes("pro max")) {
        mockPillars = [
          {
            id: "am_thanh_bao_ve_tai",
            title: "Khoa học Âm thanh & Sức khỏe tai",
            ratio: "30% tỉ trọng",
            description:
              "Nguyên lý hoạt động của chống ồn chủ động ANC và cách bảo vệ thính lực khi đeo tai nghe cường độ cao thường xuyên.",
          },
          {
            id: "phong_cach_unboxing",
            title: "Đập hộp & Định hình Phong cách sống",
            ratio: "45% tỉ trọng",
            description:
              "Phối đồ thời trang dạo phố sành điệu cùng Pro Max, tạo phong thái năng động tự tin cho giới trẻ công nghệ.",
          },
          {
            id: "uu_dai_gio_vang",
            title: "Flash Sale giờ vàng - Săn cực đỉnh",
            ratio: "25% tỉ trọng",
            description:
              "Cơ hội săn deal giảm giá sốc đến 45% độc quyền trong khung giờ trưa từ 12h - 14h, số lượng cực hạn.",
          },
        ];
      } else if (topicLower.includes("vip") || topicLower.includes("voucher") || topicLower.includes("tri ân")) {
        mockPillars = [
          {
            id: "dac_quyen_thanh_vien",
            title: "Giá trị đặc quyền Tri ân",
            ratio: "35% tỉ trọng",
            description:
              "Chi tiết đặc quyền thăng hạng thẻ, chính sách bảo hành trọn đời và tích điểm đổi quà VIP của hệ sinh thái iGen.",
          },
          {
            id: "cau_chuyen_thanh_cong",
            title: "Khoảnh khắc & Khách hàng VIP",
            ratio: "40% tỉ trọng",
            description:
              "Ghi dấu những bức ảnh, cuộc hẹn và cảm ơn chân thành từ iGen ERP tới các đối tác doanh nghiệp lớn đồng hành lâu năm.",
          },
          {
            id: "uu_dai_han_muc",
            title: "Quà tặng và Voucher VIP độc bản",
            ratio: "25% tỉ trọng",
            description:
              "Gửi mã voucher VIP-10 độc bá kèm hộp quà tặng chạm khắc thủ công đặc biệt thiết kế riêng cho khách hàng VIP.",
          },
        ];
      }

      return mockPillars;
    };

    if (!process.env.GEMINI_API_KEY) {
      return { pillars: getMockPillars(), isMock: true };
    }

    try {
      const prompt = `Phân tích mục tiêu/chủ đề chiến dịch marketing sau: "${campaignTopic}"
Hãy đề xuất chính xác 3 trụ cột nội dung cốt lõi (Content Pillars) giúp doanh nghiệp định hình khung nội dung (framework) chuẩn chỉnh ngay từ đầu, đảm bảo tỷ lệ nội dung phân bổ đa dạng, tránh việc chỉ đăng bài bán hàng gây nhàm chán và mất tương tác.

Mỗi trụ cột phải có thông tin:
1. id: chuỗi ngắn gọn, không dấu cách, viết thường (ví dụ: "kien_thuc_huong_dan", "trai_nghiem_khach_hang", "khuyen_mai_dac_quyen")
2. title: Tiêu đề trụ cột nội dung tối ưu sáng tạo bằng tiếng Việt (Ví dụ: "Giáo dục & Hướng dẫn", "Câu chuyện khách hàng", "Ưu đãi & Khuyến mãi", "Giá trị cốt lõi")
3. ratio: Tỷ lệ phần trăm phân bổ hợp lý hiển thị dưới dạng chuỗi (Ví dụ: "35% tỉ trọng", "40% tỉ trọng") đảm bảo tổng 3 cái là 100%. Đa dạng tỷ trọng, tránh bán hàng quá nhiều.
4. description: Mô tả ngắn gọn trực quan bằng tiếng Việt hướng dẫn cách triển khai cụ thể trụ cột này đối với chiến dịch "${campaignTopic}".

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pillars: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "ID ngắn gọn viết liền không dấu" },
                    title: { type: Type.STRING, description: "Tiêu đề tiếng Việt của trụ cột" },
                    ratio: { type: Type.STRING, description: "Tỷ lệ phân bổ" },
                    description: { type: Type.STRING, description: "Mô tả triển khai chi tiết" },
                  },
                  required: ["id", "title", "ratio", "description"],
                },
                description: "Danh sách đúng 3 trụ cột nội dung",
              },
            },
            required: ["pillars"],
          },
          images
        }
      );

      const responseText = response.text || "{}";
      const parsedData = safeParseJson(responseText);
      return { pillars: parsedData.pillars || [], isMock: false };
    } catch (error: any) {
      console.error("[geminiService.analyzeMarketingPillars] Error, fallback to mock pillars:", error);
      return { pillars: getMockPillars(), isMock: true };
    }
  },

  /**
   * Thay thế 1 Content Pillar bằng 1 Trụ cột khác mới hoàn toàn
   */
  async swapMarketingPillar(
    campaignTopic: string,
    currentPillars: any[],
    pillarIdToReplace: string,
    images?: string[]
  ): Promise<{ pillar: any; isMock: boolean }> {
    const getMockSwapPillar = () => {
      const replacementOptions = [
        {
          id: "kien_thuc_chuyen_sau",
          title: "Pillar D: Kiến thức chuyên sâu & Khác biệt",
          ratio: "35% tỉ trọng",
          description: "Chia sẻ những phân tích độc quyền, thông số kỹ thuật ấn tượng và so sánh chi tiết để chứng minh tính ưu việt vượt trội của sản phẩm.",
        },
        {
          id: "phong_cach_loi_song",
          title: "Pillar E: Phong cách sống & Cảm hứng",
          ratio: "30% tỉ trọng",
          description: "Truyền tải thông điệp tích cực, xây dựng phong cách cá nhân hiện đại và kết nối sản phẩm với thói quen hàng ngày của khách hàng mục tiêu.",
        },
        {
          id: "tu_ong_tuong_tac",
          title: "Pillar F: Hỏi đáp & Tương tác Cộng đồng",
          ratio: "25% tỉ trọng",
          description: "Tổ chức các buổi mini-game, thảo luận mở hoặc giải đáp thắc mắc trực tiếp nhằm gắn kết người dùng và gia tăng tỷ lệ phản hồi tự nhiên.",
        },
        {
          id: "cam_nhan_chuyen_gia",
          title: "Pillar G: Góc nhìn Chuyên gia & Uy tín",
          ratio: "40% tỉ trọng",
          description: "Trích dẫn nhận xét từ các chuyên gia đầu ngành, người có sức ảnh hưởng (KOLs) để bảo chứng chất lượng và nâng cao vị thế thương hiệu.",
        }
      ];

      const existingIds = new Set(currentPillars.map(p => p.id));
      const available = replacementOptions.filter(opt => !existingIds.has(opt.id));
      const selected = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : replacementOptions[0];

      const targetPillar = currentPillars.find(p => p.id === pillarIdToReplace);
      if (targetPillar) {
        selected.ratio = targetPillar.ratio;
      }
      return selected;
    };

    if (!process.env.GEMINI_API_KEY) {
      return { pillar: getMockSwapPillar(), isMock: true };
    }

    try {
      const existingPillarsStr = currentPillars
        .map(p => `- ID: "${p.id}", Tiêu đề: "${p.title}", Mô tả: "${p.description}"`)
        .join("\n");
      
      const toReplace = currentPillars.find(p => p.id === pillarIdToReplace);
      const replaceStr = toReplace 
        ? `ID: "${toReplace.id}", Tiêu đề: "${toReplace.title}" (Tỷ lệ phân bổ: ${toReplace.ratio})`
        : pillarIdToReplace;

      const prompt = `Phân tích mục tiêu/chủ đề chiến dịch marketing sau: "${campaignTopic}"
Hiện tại, chúng tôi đang sử dụng các trụ cột nội dung (Content Pillars) sau đây:
${existingPillarsStr}

Chúng tôi muốn THAY THẾ (đổi) trụ cột sau đây:
${replaceStr}

YÊU CẦU:
Hãy đề xuất 1 trụ cột nội dung (Content Pillar) mới và hoàn toàn KHÁC BIỆT so với các trụ cột hiện có ở trên để thay thế cho trụ cột muốn đổi. Trụ cột mới này phải bổ trợ tốt cho chiến dịch và mục tiêu "${campaignTopic}".
Trụ cột mới phải có thông tin cấu trúc sau:
1. id: chuỗi ngắn gọn, không dấu cách, viết thường (ví dụ: "kien_thuc_chuyen_sau", "goc_nhin_chuyen_gia") và KHÔNG ĐƯỢC TRÙNG với bất kỳ ID nào của các trụ cột hiện tại.
2. title: Tiêu đề trụ cột nội dung mới tối ưu bằng tiếng Việt (Ví dụ: "Pillar D: Kiến thức chuyên sâu", "Pillar E: Phong cách sống").
3. ratio: Tỷ lệ phân bổ hợp lý hiển thị dưới dạng chuỗi (Ví dụ: "35% tỉ trọng"). Hãy giữ nguyên tỉ lệ của trụ cột cũ là: "${toReplace?.ratio || "33% tỉ trọng"}".
4. description: Mô tả ngắn gọn trực quan bằng tiếng Việt hướng dẫn cách triển khai cụ thể trụ cột này đối với chiến dịch "${campaignTopic}".

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_TEXT_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "ID ngắn gọn viết liền không dấu, không trùng ID hiện tại" },
              title: { type: Type.STRING, description: "Tiêu đề tiếng Việt của trụ cột" },
              ratio: { type: Type.STRING, description: "Tỷ lệ phân bổ (giữ nguyên tỷ lệ cũ)" },
              description: { type: Type.STRING, description: "Mô tả triển khai chi tiết" },
            },
            required: ["id", "title", "ratio", "description"],
          },
          images
        }
      );

      const responseText = response.text || "{}";
      const parsedPillar = safeParseJson(responseText);
      return { pillar: parsedPillar, isMock: false };
    } catch (error: any) {
      console.error("[geminiService.swapMarketingPillar] Error, fallback to mock swap pillar:", error);
      return { pillar: getMockSwapPillar(), isMock: true };
    }
  },

  /**
   * Phát sinh bản nháp ý tưởng chiến dịch
   */
  async generateMarketingIdeas(
    campaignTopic: string,
    selectedPillars: string[],
    channels?: string[],
    mediaType?: string,
    images?: string[]
  ): Promise<{ concepts: any[]; isMock: boolean }> {
    const pillarsStr =
      selectedPillars && selectedPillars.length > 0
        ? `(Định hướng Trụ cột nội dung: ${selectedPillars.join(", ")})`
        : "";

    const getMockConcepts = () => {
      const concepts = [
        {
          title: `Chiến dịch: Chạm Đột Phá - ${campaignTopic || "Mua Sắm Cuối Năm"}`,
          matchPercent: 95,
          summary: `Đột phá doanh số nhắm vào đối tượng trẻ tuổi. ${pillarsStr
            ? `Tập trung sâu vào định hướng truyền thông từ các trụ cột lựa chọn: ${selectedPillars.join(", ")}.`
            : "Tạo lối sống trải nghiệm công nghệ đeo và phong cách sống lành mạnh."
            }`,
          channels: channels && channels.length > 0 ? channels : ["TikTok", "Facebook", "Zalo"],
          suggestedContent:
            "🎬 Kịch bản Tiktok: Biến đổi phong cách thường ngày thành phong cách năng động thể thao chỉ sau 1 cái chạm màn hình X1.",
          hashtags: ["#iGenX1", "#SmartWearable", "#NangTamCuocSong"],
          mediaPrompt: `A dynamic lifestyle photoshoot featuring a young professional using ${campaignTopic || "smart wearable device"} in an urban setting, bright natural lighting, modern cityscape background, energetic mood, 8k high-resolution product photography.`,
        },
        {
          title: `Trải nghiệm Đỉnh Cao - Tri Ân Hội Viên`,
          matchPercent: 88,
          summary: `Quảng bá giá trị cốt lõi bền vững thông qua chuỗi bài viết phỏng vấn các đối tác trung thành thực tế đang nâng tầm công việc cùng Workspace V2. ${pillarsStr ? `Điều phối theo: ${selectedPillars.join(", ")}.` : ""
            }`,
          channels: channels && channels.length > 0 ? channels : ["Facebook", "Zalo"],
          suggestedContent:
            "✍️ Facebook Post: 'Gặp gỡ anh Hùng, Giám đốc Sáng tạo, người đã nâng cấp 200% tốc độ gõ nhờ Bàn phím cơ Workspace V2...'",
          hashtags: ["#WorkspaceV2", "#KeyboardMechanic", "#TangHieuSuat"],
          mediaPrompt: `A premium flatlay product photograph of a mechanical keyboard on a clean wooden desk, warm ambient lighting, coffee cup and notebook nearby, professional workspace aesthetic, detailed textures, 4k resolution.`,
        },
        {
          title: `Giờ Vàng Giá Sốc - Săn Độc Quyền AI`,
          matchPercent: 78,
          summary: `Tạo sự gấp rút bằng tính năng đếm ngược flash sale được quản lý tự động bởi thuật toán đề xuất của iGen ERP. ${pillarsStr ? `Kế thừa ý tưởng từ các Content Pillar được cấu hình: ${selectedPillars.join(", ")}.` : ""
            }`,
          channels: channels && channels.length > 0 ? channels : ["Facebook", "Zalo"],
          suggestedContent:
            "🔥 Tin nhắn Zalo: 'Duy nhất hôm nay! Giờ vàng từ 12h-14h, giảm giá 30% toàn bộ tai nghe Không dây Pro Max. Đặt ngay!'",
          hashtags: ["#FlashSale", "#TaiNgheProMax", "#AmThanhDinhCao"],
          mediaPrompt: `A vibrant flash sale promotional banner featuring wireless headphones with neon glow effects, countdown timer overlay, bold typography, dark background with electric blue and orange accents, high-energy commercial style.`,
        },
      ];
      return concepts;
    };

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    try {
      const sourceBrief = extractSourceBrief(campaignTopic);
      const pillarsContext =
        selectedPillars && selectedPillars.length > 0
          ? `\nCác Trụ cột nội dung (Content Pillars) bắt buộc phải tích hợp và bám sát: ${selectedPillars.join(
            ", "
          )}. Hãy sáng tạo các ý tưởng tập trung xoay quanh các trụ cột này.`
          : "";

      const channelsContext =
        channels && channels.length > 0
          ? `\nKênh truyền thông bắt buộc: Bắt buộc các ý tưởng của bạn phải phân phối và đăng bài chính xác trên các kênh: ${channels.join(", ")}.`
          : "";

      const mediaContext =
        mediaType === "image"
          ? "\nYêu cầu về phương tiện: Các ý tưởng phải thiết kế đi kèm hình ảnh làm chủ đạo."
          : mediaType === "video"
            ? "\nYêu cầu về phương tiện: Các ý tưởng phải thiết kế đi kèm video làm chủ đạo."
            : mediaType === "human-video"
              ? "\nYÃªu cáº§u vá» phÆ°Æ¡ng tiá»‡n: CÃ¡c Ã½ tÆ°á»Ÿng pháº£i phÃ¹ há»£p cho video ngÆ°á»i tháº­t/avatar nÃ³i trÆ°á»›c camera, Æ°u tiÃªn hook máº¡nh, lá»i thoáº¡i tá»± nhiÃªn, cáº£nh quay Ä‘Æ¡n giáº£n vÃ  cÃ³ thá»ƒ chuyá»ƒn thÃ nh voice script trá»±c tiáº¿p."
            : mediaType === "none"
              ? "\nYêu cầu về phương tiện: Các bài đăng không đi kèm hình ảnh hoặc video (chỉ văn bản/caption)."
              : "";

      const prompt = `Bạn là một chuyên gia marketing xuất sắc.
Hãy tạo đúng 3 ý tưởng/bản nháp chiến dịch marketing chi tiết cho chủ đề/chiến dịch này: "${campaignTopic}".${pillarsContext}${channelsContext}${mediaContext}
Yêu cầu kết quả đầu ra:
1. Đề xuất tiêu đề chiến dịch sáng tạo.
2. Tỷ lệ phần trăm phù hợp (matchPercent) ước lượng (số nguyên từ 50-100).
3. Tóm tắt ý tưởng triển khai ngắn gọn.
4. Các kênh truyền thông phù hợp đề xuất đăng bài (mảng các chuỗi, ví dụ: ["Facebook", "TikTok"] - Bắt buộc phải trùng khớp với danh sách kênh đã được yêu cầu ở trên).
5. Ý tưởng nội dung gợi ý ban đầu để triển khai bài đăng trên kênh.
6. Hashtags liên quan phù hợp.
7. mediaPrompt: Một đoạn mô tả chi tiết bằng tiếng Anh (visual prompt) mô tả chính xác hình ảnh hoặc video phù hợp nhất cho ý tưởng này, dùng để gửi tới AI Image/Video Generator. Prompt phải bao gồm: chủ thể chính, bối cảnh, ánh sáng, phong cách nghệ thuật, mood/tone, và chi tiết kỹ thuật.
8. mediaPrompt phải dịch đúng nghĩa và bám sát nhất với input người dùng và nội dung phân tích từ file đính kèm. Không được thêm bớt chủ đề hay làm generic hóa bối cảnh.

NGUỒN SỰ THẬT BẮT BUỘC:
${sourceBrief.normalizedBrief || campaignTopic}

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

      const response = await generateText(
        GEMINI_HEAVY_MODEL,
        prompt,
        {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              concepts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Tiêu đề ý tưởng chiến dịch" },
                    matchPercent: { type: Type.INTEGER, description: "Tỷ lệ phù hợp" },
                    summary: { type: Type.STRING, description: "Tóm tắt ý tưởng" },
                    channels: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Các kênh đề xuất đăng bài",
                    },
                    suggestedContent: { type: Type.STRING, description: "Ý tưởng nội dung gợi ý ban đầu" },
                    hashtags: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Hashtags liên quan",
                    },
                    mediaPrompt: {
                      type: Type.STRING,
                      description: "A detailed English visual prompt describing the ideal image or video for this concept, including subject, setting, lighting, art style, mood, and technical details.",
                    },
                  },
                  required: ["title", "matchPercent", "summary", "channels", "suggestedContent", "hashtags", "mediaPrompt"],
                },
                description: "Danh sách 3 ý tưởng/bản nháp chiến dịch marketing",
              },
            },
            required: ["concepts"],
          },
          images
        }
      );

      const responseText = response.text || "{}";
      const parsedData = safeParseJson(responseText);
      const groundedConcepts = (parsedData.concepts || []).map((concept: any) => {
        const groundedConcept = buildFaithfulVisualGuardrail({
          sourceBrief: campaignTopic,
          title: concept?.title,
          summary: concept?.summary,
          suggestedContent: concept?.suggestedContent,
          channels,
          selectedPillars,
        });

        return {
          ...concept,
          title: String(concept?.title || "").trim(),
          summary: String(concept?.summary || "").trim(),
          suggestedContent: String(concept?.suggestedContent || "").trim(),
          matchPercent: Math.max(50, Math.min(100, Number(concept?.matchPercent || 50))),
          channels: (Array.isArray(concept?.channels) ? concept.channels : (channels || ["Facebook"]))
            .map((channel: string) => this.normalizeMarketingChannel(channel))
            .filter((channel: string, index: number, arr: string[]) => arr.indexOf(channel) === index),
          hashtags: this.sanitizeHashtags(concept?.hashtags, concept?.title || campaignTopic),
          mediaPrompt: concept?.mediaPrompt
            ? `${groundedConcept} ${concept.mediaPrompt}`.trim()
            : groundedConcept,
        };
      }).filter((concept: any) => concept.title && concept.summary && concept.suggestedContent);

      if (groundedConcepts.length === 0) {
        throw new Error("AI khong tra ve concept hop le.");
      }
      return { concepts: groundedConcepts, isMock: false };
    } catch (error: any) {
      console.error("[geminiService.generateMarketingIdeas] Failed to generate grounded concepts:", error);
      throw new Error(error?.message || "Khong the phat sinh y tuong marketing tu AI.");
    }
  },

  async developMarketingIdea(
    title: string,
    summary: string,
    suggestedContent: string,
    channels: string[],
    mediaOptions?: {
      mediaType?: string;
      imageModel?: string;
      imageResolution?: string;
      imageAspectRatio?: string;
      videoModel?: string;
      videoQuality?: string;
      videoDuration?: number;
      videoAspectRatio?: string;
      mediaPrompt?: string;
      humanVoiceId?: string;
      humanVoiceModel?: string;
      humanDurationSeconds?: number;
    }
  ): Promise<{ posts: any[]; isMock: boolean }> {
    const validChannels = ["Facebook", "TikTok", "LinkedIn", "Instagram", "Zalo"];
    const sourceBriefText = String(mediaOptions?.mediaPrompt || suggestedContent || `${title}. ${summary}`).trim();

    // Normalize target channels: filter out invalid channels, map input to valid ones
    const normalizeChannel = (chan: string): string => {
      if (!chan) return "Facebook";
      const c = chan.toLowerCase().trim();
      if (c.includes("facebook") || c.includes("fb")) return "Facebook";
      if (c.includes("tiktok") || c.includes("tik tok") || c.includes("reels") || c.includes("video ngắn")) return "TikTok";
      if (c.includes("linkedin") || c.includes("linked in") || c.includes("link")) return "LinkedIn";
      if (c.includes("instagram") || c.includes("insta") || c.includes("ig")) return "Instagram";
      if (c.includes("zalo")) return "Zalo";
      return "Facebook";
    };

    let targetChannels = (Array.isArray(channels) ? channels : ["Facebook"])
      .map(ch => normalizeChannel(ch))
      .filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

    if (targetChannels.length === 0) {
      targetChannels = ["Facebook"];
    }

    let posts: any[] = [];
    let isMock = false;

    const getMockPosts = () => {
      return targetChannels.map((chan) => {
        let contentType = "Bài viết truyền thông";
        let outline = "";
        let bodyText = "";
        let mockMediaPrompt = "";
        if (chan === "Facebook") {
          contentType = "Hình ảnh kèm Caption";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Hình ảnh: Ảnh flatlay thiết bị sang trọng trên bàn làm việc hiện đại.
2. Tiêu đề: Độc vị phong cách - Chọn ${title}.
3. Nội dung chính: Giải quyết vấn đề mỏi tay, tăng tốc gõ và tối ưu hóa không gian làm việc.
4. Call to Action: Đăng ký nhận ưu đãi 10% ra mắt.`;
          bodyText = `🔥 BẬT PHONG CÁCH - NHÂN HIỆU SUẤT CÙNG ${title}! 🔥

Bạn có biết 90% hiệu suất làm việc phụ thuộc vào sự thoải mái của thiết bị đồng hành? Với chiến dịch ${summary}, chúng tôi mang đến giải pháp tối ưu cho bạn:
💻 Thiết kế công thái học tinh tế.
⚡ Tăng tốc độ phản hồi phím gõ lên 150%.
🎁 Quà tặng kèm kê tay gỗ sồi đặc quyền.

💡 Ý tưởng cốt lõi: "${suggestedContent}"

📲 Nhắn tin ngay cho iGen để nhận deal hời! #iGenERP #WorkspaceV2 #CongNgheSo #Success`;
          mockMediaPrompt = `A professional product photoshoot of ${title} on a modern wooden desk, warm cozy lighting, detailed textures, 8k resolution.`;
        } else if (chan === "TikTok") {
          contentType = "Kịch bản Video ngắn 8s";
          outline = `🎬 KỊCH BẢN QUAY (TIMELINE VIDEO SCRIPTS - MAX 8S):
[0:00 - 0:03]
- Visual: Hook so sánh tư thế làm việc gù lưng/mỏi tay với tư thế chuẩn.
- Audio (Voiceover): "Bạn có đang làm việc sai tư thế?"

[0:03 - 0:08]
- Visual: Show cận cảnh thiết kế sang trọng & âm thanh gõ phím đầm chắc của ${title}.
- Audio (Voiceover): "Nâng cấp hiệu năng làm việc cực đỉnh cùng ${summary}"`;
          bodyText = `🔥 Cứu tinh deadline của bạn đây rồi! Nâng cấp hiệu năng làm việc cực đỉnh với ${title}. Đăng ký trải nghiệm ngay hôm nay để nhận voucher giảm giá 45% độc quyền! #iGenERP #WorkspaceV2 #WorkSmart #Deadline`;
          mockMediaPrompt = `An energetic, dynamic lifestyle video showing someone typing fast on ${title}, neon lighting, high-tech vibes, cinematic look.`;
        } else if (chan === "LinkedIn") {
          contentType = "Bài viết chuyên sâu (Article)";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Đặt vấn đề: Xu hướng chuyển đổi số và nâng cao năng suất doanh nghiệp.
2. Phân tích: Vai trò của thiết bị chuẩn công thái học đối với nhân sự IT/Lập trình.
3. Chiến dịch ${summary} đóng góp giá trị như thế nào.
4. CTA kết nối nhận tư vấn.`;
          bodyText = `[XU HƯỚNG VẬN HÀNH] TỐI ƯU HÓA TRẠI NGHIỆM NHÂN SỰ ĐỂ ĐỘT PHÁ HIỆU SUẤT

Kính gửi quý đối tác và cộng đồng doanh nghiệp,

Trong quản trị hiện đại, sự hài lòng và sức khỏe thể chất của nhân viên chính là đòn bẩy hiệu năng lớn nhất. Với chiến dịch "${title}" cùng định hướng: ${summary}.

Dựa trên gợi ý đề xuất: "${suggestedContent}", iGen ERP mang tới góc nhìn mới giúp doanh nghiệp:
✅ Giảm thiểu chấn thương cổ tay (RSI) ở bộ phận kỹ thuật.
✅ Gia tăng sự tập trung và gắn kết công việc.
✅ Xây dựng môi trường làm việc thông minh và hiện đại.

💼 Hãy thảo luận cùng chúng tôi để thiết kế giải pháp chuyển đổi số toàn diện cho doanh nghiệp của bạn.

#ChuyenDoiSo #iGenERP #LinkedInArticle #CongNgheTuongLai`;
          mockMediaPrompt = `A minimalist, clean corporate office setting showing a laptop and ${title}, professional corporate workspace, bright natural light.`;
        } else {
          contentType = "Bài viết truyền thông đa kênh";
          outline = `📋 DÀN Ý CHI TIẾT (OUTLINE):
1. Mở bài cuốn hút.
2. Phân tích cốt lõi.
3. CTA kêu gọi hành động.`;
          bodyText = `Giới thiệu chiến dịch: ${title}!

Định hướng ý tưởng: ${summary}.
Nội dung chi tiết gợi ý: ${suggestedContent}`;
          mockMediaPrompt = `A creative, appealing social media visual representing ${title}.`;
        }
        const voiceScript = `Xin chao, day la noi dung gioi thieu ngan gon cho chien dich ${title}. ${summary}. Hay lien he ngay de nhan tu van chi tiet va uu dai phu hop.`;
        const motionText = `Confident presenter, natural hand gestures, clear eye contact, upbeat delivery, topic-focused marketing explainer.`;
        return { channel: chan, contentType, outline, bodyText, mediaPrompt: mockMediaPrompt, voiceScript, motionText };
      });
    };

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    } else {
      try {
        const isHumanVideo = mediaOptions?.mediaType === "human-video";
        const humanDurationSeconds = Number(mediaOptions?.humanDurationSeconds || 15);
        const minWords = Math.floor(humanDurationSeconds * 2.2);
        const maxWords = Math.ceil(humanDurationSeconds * 2.8);
        const humanVoiceRules = isHumanVideo
          ? `

YÊU CẦU RIÊNG CHO VIDEO NGƯỜI THẬT:
1. Mỗi bài viết bắt buộc phải có thêm trường "voiceScript" bằng tiếng Việt tự nhiên, mượt mà, chuẩn văn phong nói tiếng Việt và không bị cảm giác dịch máy.
2. "voiceScript" phải là đoạn lời thoại hoàn chỉnh để đưa trực tiếp sang bộ chuyển đổi Text-to-Speech (TTS). Tuyệt đối không chứa ký hiệu markdown, không chứa gạch đầu dòng (bullet points), không chứa bất kỳ nhãn dẫn hay lời ghi chú nào (ví dụ: không có "MC:", "Voiceover:", "Cảnh 1:", v.v.).
3. RÀNG BUỘC ĐỘ DÀI VÀ THỜI LƯỢNG NGHIÊM NGẶT: Thời lượng đọc mục tiêu là đúng ${humanDurationSeconds} giây. Để đảm bảo điều này, số lượng từ/âm tiết tiếng Việt trong "voiceScript" bắt buộc phải nằm trong giới hạn từ ${minWords} đến ${maxWords} từ. Tránh việc viết quá dài hoặc quá ngắn sẽ làm hỏng thời lượng video.
4. "bodyText" vẫn là phần caption/nội dung ngắn gọn đăng lên kênh mạng xã hội, còn "voiceScript" mới là kịch bản thoại được đọc thành tiếng. Hai trường này phải nhất quán nhưng tách biệt.
5. "outline" phải mô tả các cảnh quay, góc máy, nhịp cắt khớp hoàn hảo với diễn biến của "voiceScript".
6. "motionText" là mô tả chi tiết bằng TIẾNG VIỆT về cử chỉ, biểu cảm gương mặt, cử động cơ thể và hành động của avatar người thật trong video (ví dụ: "Người thuyết trình tự tin, gật đầu nhẹ nhàng, biểu cảm thân thiện, cử chỉ tay cởi mở"). Mô tả phải tự nhiên, bám sát nội dung và ngữ điệu lời thoại.
7. Tuyệt đối không viết "voiceScript" chung chung. Nội dung phải tập trung làm nổi bật tiêu đề, tóm tắt chiến dịch, insight khách hàng và thông điệp bán hàng cụ thể được cung cấp.
`
          : "";

        const prompt = `Bạn là một chuyên gia viết kịch bản và AI Copywriter xuất sắc.
Hãy lập Dàn ý (Outline) và viết Bản nháp nội dung (Draft Content) cho các kênh sau đây: ${targetChannels.join(", ")}

QUY TẮC PHÂN TÁCH DỮ LIỆU BẮT BUỘC CHO TỪNG KÊNH:
1. Đối với kênh TikTok:
   - Trường "outline" (Dàn ý): PHẢI chứa toàn bộ kịch bản quay chi tiết (Shooting Script / Storyboard), bao gồm phân đoạn visual (hình ảnh/hành động), audio (lời thoại/âm thanh/voiceover) và mốc thời gian (Timeline dạng [0:00 - 0:03], [0:03 - 0:08]...) cho từng cảnh. Tổng thời lượng kịch bản không được vượt quá 8 giây.
   - Trường "bodyText" (Nội dung chính): PHẢI là Caption/Description giới thiệu video sạch, cuốn hút kèm hashtag để đăng tải trực tiếp lên TikTok (ví dụ: "🔥 Cứu tinh deadline của bạn đây... #iGenERP..."). TUYỆT ĐỐI không chứa bất kỳ mốc thời gian timeline, phân cảnh, Visual hay Audio nào ở trường này.
2. Đối với các kênh khác (Facebook, LinkedIn, Instagram...):
   - Trường "outline": Lập dàn ý chi tiết, cụ thể và tối ưu của bài viết.
   - Trường "bodyText": Lưu bản nháp nội dung bài viết sạch hoàn chỉnh để đăng tải trực tiếp (không chứa dàn ý hay tiêu đề nháp).
3. Đối với mọi kênh: Sinh thêm trường "mediaPrompt" là một đoạn mô tả chi tiết bằng tiếng Anh (visual prompt) mô phỏng chính xác nội dung trực quan (hình ảnh hoặc video) phù hợp cho bài viết này để gửi tới AI Generator.
4. mediaPrompt phải là bản dịch trung thành sang tiếng Anh từ dữ liệu gốc, không được đổi nghĩa, không được tự ý thêm chi tiết không có trong input hoặc tài liệu đính kèm, không được biến thành bối cảnh generic.
5. Nếu input chứa tên công ty, thông tin lương, địa điểm, hay tên chiến dịch, bắt buộc phải nhắc lại chính xác chúng trong mediaPrompt dưới dạng nội dung trực quan.
6. mediaPrompt phải ghi rõ cách hiển thị nội dung đó trên ảnh/video: logo, banner, bảng hiệu, đồng phục, biển chỉ dẫn, hoặc văn bản nổi bật.
${humanVoiceRules}

Thông tin chiến dịch marketing:
- Tiêu đề ý tưởng: "${title}"
- Tóm tắt ý tưởng: "${summary}"
- Nội dung gợi ý ban đầu: "${suggestedContent}"

NGUỒN SỰ THẬT BẮT BUỘC:
${extractSourceBrief(sourceBriefText).normalizedBrief || sourceBriefText}

Trả về kết quả ở định dạng JSON phù hợp chính xác với cấu trúc yêu cầu.`;

        const response = await generateText(
          GEMINI_HEAVY_MODEL,
          prompt,
          {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                posts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      channel: { type: Type.STRING, description: "Kênh đăng bài (ví dụ: Facebook, TikTok, LinkedIn, Instagram, Zalo)" },
                      contentType: { type: Type.STRING, description: "Loại nội dung" },
                      outline: {
                        type: Type.STRING,
                        description: "Dàn ý chi tiết của bài viết. ĐẶC BIỆT với TikTok: Phải lưu KỊCH BẢN QUAY (timeline video script) chi tiết bao gồm Visual, Audio và mốc thời gian dạng [0:00 - 0:03], [0:03 - 0:08]... với tổng thời lượng tối đa không quá 8 giây."
                      },
                      bodyText: {
                        type: Type.STRING,
                        description: "Nội dung bài đăng/caption sạch để đăng tải trực tiếp. ĐẶC BIỆT với TikTok: Chỉ là Caption/Description giới thiệu video kèm hashtag và call-to-action (TUYỆT ĐỐI không chứa kịch bản quay, visual, audio hay timeline video ở trường này)."
                      },
                      mediaPrompt: {
                        type: Type.STRING,
                        description: `A detailed visual description prompt in English for generating a matching image or video. It must:
1. Preserve all business details from the original Vietnamese brief.
2. Include company name, campaign name, salary, location, and product or role details when present.
3. Describe exact visual composition, lighting, text placement, and environment.
4. Avoid adding elements not present in the original input.
5. Avoid generic phrasing and instead use specific, grounded language related to the campaign.
Example: 'Recruitment poster for PHÚC CƯƠNG PDCA at Quế Võ, Bắc Ninh, showing a worker in blue uniform with salary text "4 triệu + 8 triệu" visible on a banner.'`,
                      },
                      voiceScript: {
                        type: Type.STRING,
                        description: "Natural Vietnamese narration script for human-video voice generation. Strictly limited to " + minWords + "-" + maxWords + " words/syllables. Keep empty string when not needed."
                      },
                      motionText: {
                        type: Type.STRING,
                        description: "Short motion and expression direction in Vietnamese for the avatar/presenter (e.g., 'Người thuyết trình tự tin, gật đầu thân thiện, cử chỉ tay mở rộng'). Keep empty string when not needed."
                      }
                    },
                    required: ["channel", "contentType", "outline", "bodyText", "mediaPrompt"],
                  },
                },
              },
              required: ["posts"],
            },
          }
        );

        const responseText = response.text || "{}";
        const parsedData = safeParseJson(responseText);
        posts = (parsedData.posts || []).map((post: any) => {
          const groundedPrompt = buildFaithfulVisualGuardrail({
            sourceBrief: sourceBriefText,
            title,
            summary,
            suggestedContent,
            outline: post?.outline,
            bodyText: post?.bodyText,
            channels: [this.normalizeMarketingChannel(post.channel)],
          });

          return {
            ...post,
            channel: this.normalizeMarketingChannel(post.channel),
            contentType: String(post?.contentType || "").trim(),
            outline: String(post?.outline || "").trim(),
            bodyText: String(post?.bodyText || "").trim(),
            voiceScript: typeof post?.voiceScript === "string" ? post.voiceScript.trim() : "",
            motionText: typeof post?.motionText === "string" ? post.motionText.trim() : "",
            mediaPrompt: post?.mediaPrompt
              ? `${groundedPrompt} ${post.mediaPrompt}`.trim()
              : groundedPrompt,
          };
        }).filter((post: any) => post.channel && post.contentType && post.bodyText);

        if (posts.length === 0) {
          throw new Error("AI khong tra ve post hop le.");
        }
      } catch (error: any) {
        console.error("[geminiService.developMarketingIdea] Failed to develop grounded posts:", error);
        throw new Error(error?.message || "Khong the phat trien noi dung marketing tu AI.");
      }
    }

    // Auto-generate media if mediaType is requested
    if (mediaOptions && mediaOptions.mediaType && mediaOptions.mediaType !== "none") {
      console.log(`[developMarketingIdea] Generating media of type: ${mediaOptions.mediaType}`);
      for (const post of posts) {
        if (mediaOptions.mediaType === "image") {
          try {
            const promptToUse = post.mediaPrompt || mediaOptions.mediaPrompt || `A professional photo matching the campaign topic: ${title}`;
            const imageResult = await geminiService.generateImage(promptToUse, {
              modelName: mediaOptions.imageModel,
              resolution: mediaOptions.imageResolution,
              aspectRatio: mediaOptions.imageAspectRatio,
            });

            if (imageResult.isMock) {
              post.imageUrl = imageResult.url;
            } else {
              try {
                const uploadedUrl = await cloudinaryService.uploadMedia(imageResult.url, "igen_erp");
                post.imageUrl = uploadedUrl;
              } catch (clErr) {
                console.error("[developMarketingIdea] Cloudinary upload image failed, fallback to raw url:", clErr);
                post.imageUrl = imageResult.url;
              }
            }
          } catch (err) {
            console.error(`[developMarketingIdea] Error generating image for post on ${post.channel}:`, err);
            // Fallback to mock image in case of PiAPI credit/service failures
            const seed = Math.floor(Math.random() * 1000000);
            post.imageUrl = `https://picsum.photos/seed/${seed}/800/600`;
            console.log(`[developMarketingIdea] Fallback to mock image: ${post.imageUrl}`);
          }
        } else if (mediaOptions.mediaType === "video") {
          try {
            const promptToUse = post.mediaPrompt || mediaOptions.mediaPrompt || `A cinematic video clip matching the campaign topic: ${title}`;
            const durationSec = mediaOptions.videoDuration ? Number(mediaOptions.videoDuration) : 6;
            const videoResult = await geminiService.generateVideo(promptToUse, durationSec, {
              modelName: mediaOptions.videoModel,
              resolution: mediaOptions.videoQuality,
              aspectRatio: mediaOptions.videoAspectRatio,
            });

            if (videoResult.isMock) {
              post.videoUrl = videoResult.url;
            } else {
              try {
                const uploadedUrl = await cloudinaryService.uploadMedia(videoResult.url, "igen_erp");
                post.videoUrl = uploadedUrl;
              } catch (clErr) {
                console.error("[developMarketingIdea] Cloudinary upload video failed, fallback to raw url:", clErr);
                post.videoUrl = videoResult.url;
              }
            }
          } catch (err) {
            console.error(`[developMarketingIdea] Error generating video for post on ${post.channel}:`, err);
            // Fallback to mock video in case of PiAPI credit/service failures
            post.videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
            console.log(`[developMarketingIdea] Fallback to mock video: ${post.videoUrl}`);
          }
        }
      }
    }

    return { posts, isMock };
  },


  /**
   * Sinh ảnh AI bằng model Nano-Banana hoặc Imagen 4
   */
  async generateImage(
    prompt: string,
    options?: { aspectRatio?: string; modelName?: string; resolution?: string; existingImageUris?: string[] }
  ): Promise<{ url: string; isMock: boolean }> {
    let modelToUse = options?.modelName || GEMINI_IMAGE_MODEL;
    // Route all calls to PiAPI
    if (modelToUse === "igen-image-pro" || modelToUse === "nano-banana-pro") {
      modelToUse = "nano-banana-pro";
    } else if (modelToUse === "igen-image-flash" || modelToUse === "nano-banana-2") {
      modelToUse = "nano-banana-2";
    } else {
      modelToUse = "nano-banana-pro";
    }

    if (!process.env.PIAPI_API_KEY) {
      const seed = Math.floor(Math.random() * 1000000);
      return { url: `https://picsum.photos/seed/${seed}/800/600`, isMock: true };
    }

    return piapiService.generateImage(prompt, modelToUse, { aspectRatio: options?.aspectRatio });
  },

  /**
   * Sinh video AI bằng model Veo3 hoặc Veo2
   */
  async generateVideo(
    prompt: string,
    durationSeconds: number = 6,
    options?: {
      aspectRatio?: string;
      modelName?: string;
      resolution?: string;
      referenceVideoUri?: string;
      referenceImageUris?: string[];
      frameMode?: "standard" | "first_last";
    }
  ): Promise<{ url: string; isMock: boolean }> {
    let actualPrompt = prompt;
    try {
      const parsed = safeParseJson(prompt);
      if (parsed.optimized_english_prompt) {
        actualPrompt = parsed.optimized_english_prompt;
        if (parsed.motion_analysis) actualPrompt += `. Motion: ${parsed.motion_analysis}`;
        if (parsed.camera_movement) actualPrompt += `. Camera: ${parsed.camera_movement}`;
      }
    } catch (e) {
      // not JSON, use as is
    }

    const modelToUse = normalizePiapiVideoModel(options?.modelName);

    if (!process.env.PIAPI_API_KEY) {
      throw new Error("Chưa cấu hình PIAPI_API_KEY. Không thể sinh video.");
    }

    const { taskId } = await piapiService.createVideoTask(actualPrompt, modelToUse, durationSeconds, {
      aspectRatio: options?.aspectRatio,
      referenceImageUris: options?.referenceImageUris,
    });
    return { url: `pending://piapi/${taskId}`, isMock: false, taskId } as any;
  },

  /**
   * Tạo giọng nói TTS (Gemini Voice Modality)
   */
  async generateVoice(userId: string, input: any) {
    const { textToSpeak, styleInstructions, mode, temperature, modelName, voiceName, speakerA, speakerB, title, description, stability, similarityBoost, useSpeakerBoost } = input;

    // ElevenLabs Voice Mapping Table
    const ELEVENLABS_VOICE_MAP: Record<string, string> = {
      // Male voices
      'Sadaltager': 'pNInz6obpgqjGQJe7v5C', // Adam
      'Charon': 'IKne3meq5aP759yEl2s8',    // Charlie
      'Orus': 'JBF2zhBk4EKq12v0tw9H',      // George
      'Puck': 'TxGEqn7nUaNZTRXjOFaQ',      // Josh
      'Fenrir': 'VR6A4UBqILHN73idDuEx',    // Arnold
      'Enceladus': 'N2lVS1w4EtoT3sAHBSz1', // Callum
      'Iapetus': 'ODq5FpeHgnsMrZsnXCw8',   // Patrick
      'Umbriel': 'SOYhlJg1783U4EcYUPgl',   // Harry
      'Algenib': 'TX329t22vkzCsaeeH8ui',   // Liam
      'Rasalgethi': 'CYw3moM5B48wqvQUxxTL',// Dave
      'Achernar': 'GBv7mTt0atIp3u8bJvhg',  // Thomas
      'Zephyr': 'D38z5qw23EIviwc77s33',    // Fin
      'Alnilam': '2EiwXtPIZgojA6xnRghf',   // Clyde
      'Gacrux': '2EiwXtPIZgojA6xnRghf',    // Clyde fallback
      'Achird': 'pNInz6obpgqjGQJe7v5C',    // Adam fallback
      'Zubenelgenubi': 'pNInz6obpgqjGQJe7v5C', // Adam fallback
      'Sulafat': 'pNInz6obpgqjGQJe7v5C',   // Adam fallback

      // Female voices
      'Aoede': 'EXAVITQu4vr4xnSDxMaL',     // Bella
      'Callirrhoe': 'AZnzlk1XvdvUeBnXmlld',// Domi
      'Kore': '21m00Tcm4TlvDq8ikWAM',      // Rachel
      'Leda': 'Lcfc5O6IFm67RCg5pQA1',      // Emily
      'Autonoe': 'MF3mGyEYCl7XYWbV9VbO',   // Ellie
      'Algieba': 'ThT50A1aJnqfgCzz94ks',   // Dorothy
      'Despina': 'zrHiDhphv9RcmhlC3AEg',   // Mimi
      'Erinome': 'EXAVITQu4vr4xnSDxMaL',   // Bella fallback
      'Laomedeia': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Schedar': 'EXAVITQu4vr4xnSDxMaL',   // Bella fallback
      'Pulcherrima': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Vindemiatrix': 'EXAVITQu4vr4xnSDxMaL', // Bella fallback
      'Sadachbia': 'EXAVITQu4vr4xnSDxMaL'  // Bella fallback
    };

    let audioDataUri = "";
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;

    if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
      console.log("[geminiService.generateVoice] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
      audioDataUri = "data:audio/wav;base64,UklGRigAAABXQVZFlm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAG";
    } else {
      try {
        const targetVoice = mode === 'multi' ? (speakerA || 'Aoede') : (voiceName || 'Aoede');
        const mappedVoiceId = ELEVENLABS_VOICE_MAP[targetVoice] || targetVoice || 'pNInz6obpgqjGQJe7v5C';

        console.log(`[geminiService.generateVoice] Generating voice using ElevenLabs with voice: ${mappedVoiceId}`);

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${mappedVoiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey.trim()
          },
          body: JSON.stringify({
            text: textToSpeak,
            model_id: modelName || "eleven_v3",
            voice_settings: {
              stability: typeof stability === 'number' ? stability : 0.5,
              similarity_boost: typeof similarityBoost === 'number' ? similarityBoost : 0.75,
              use_speaker_boost: typeof useSpeakerBoost === 'boolean' ? useSpeakerBoost : true
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`ElevenLabs API error: ${response.status} - ${errText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString('base64');
        audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;
      } catch (error: any) {
        console.error("[geminiService.generateVoice] ElevenLabs API error:", error);
        throw error;
      }
    }

    // Upload to Cloudinary
    const cloudinaryUrl = await cloudinaryService.uploadMedia(audioDataUri, "igen_erp/marketing/voice");

    // Save to MongoDB
    const record = await AIMediaModel.create({
      userId,
      mediaType: "voice",
      url: cloudinaryUrl,
      prompt: textToSpeak,
      metadata: {
        voiceName: mode === 'multi' ? `Multi (${speakerA} & ${speakerB})` : voiceName,
        duration: estimateAudioDuration(textToSpeak),
        resolution: modelName || "eleven_v3",
        title: title || undefined,
        description: description || undefined,
      }
    });

    return record;
  },

  /**
   * Tối ưu kịch bản giọng nói
   */
  async optimizeScript(text: string, readingStyle: string, model?: string) {
    if (!process.env.GEMINI_API_KEY) {
      return { optimizedText: `[Tối ưu hóa Giả lập] ${text}` };
    }
    try {
      const systemInstruction = `Bạn là một chuyên gia biên soạn kịch bản và phát thanh viên chuyên nghiệp của Đài Tiếng nói Việt Nam (VOV).
Hãy tối ưu hóa văn bản gốc của người dùng để biến nó thành một kịch bản thoại (voiceover script) chất lượng cao, lưu loát, chuẩn tiếng Việt và cực kỳ tự nhiên.

Áp dụng các quy tắc biên tập và phát thanh nghiêm ngặt sau:
1. SỰ TỰ NHIÊN VÀ TRÔI CHẢY: Chuyển đổi văn bản thành văn phong nói tự nhiên, chuẩn ngôn ngữ phát thanh. Loại bỏ các cụm từ rườm rà, lặp ý hoặc mang tính chất văn viết khô khan.
2. NGẮT NGHỈ HỢP LÝ BẰNG DẤU CÂU: Tự động chèn thêm dấu phẩy (,), dấu chấm (.) hoặc dấu ba chấm (...) tại các vị trí cần ngắt nghỉ, lấy hơi tự nhiên của phát thanh viên. Điều này rất quan trọng để giúp công cụ Text-to-Speech (TTS) đọc với nhịp điệu vừa phải, nhấn nhá chính xác, không bị đọc liền một mạch quá nhanh hay dính chữ.
3. PHÁT ÂM VÀ CHỮ SỐ (BẮT BUỘC):
   - Đọc và viết rõ hoàn toàn các từ viết tắt thành tiếng Việt chuẩn (Ví dụ: "KH" -> "khách hàng", "SP" -> "sản phẩm", "DN" -> "doanh nghiệp", "VS" -> "với").
   - Viết rõ các từ tiếng Anh thông dụng theo cách đọc tự nhiên của tiếng Việt hoặc phiên âm dễ đọc (Ví dụ: "ERP" -> "E-R-P", "AI" -> "A-I", "IT" -> "I-T", "Sales" -> "sale", "Marketing" -> "mác-két-tinh").
   - Viết chữ hoàn toàn cho tất cả các con số, phần trăm, ký hiệu, ngày tháng hoặc số tiền (Ví dụ: "10%" -> "mười phần trăm", "24/7" -> "hai mươi tư trên bảy", "2026" -> "năm hai nghìn không trăm hai mươi sáu", "15s" -> "mười lăm giây", "$100" -> "một trăm đô la").
4. PHONG CÁCH ĐỌC: Bám sát và thể hiện rõ nét phong cách đọc yêu cầu (ví dụ: hào hứng, sâu lắng, chậm rãi...).
5. KẾT QUẢ TRẢ VỀ: Chỉ trả về DUY NHẤT văn bản kịch bản thoại tiếng Việt đã được tối ưu hóa hoàn chỉnh. Không thêm lời bình luận, không có ký tự markdown (như **, ##, *), không chứa tiêu đề kịch bản, lời mở đầu hay bất kỳ lời giải thích nào.`;
      const selectedModel = model || GEMINI_TEXT_MODEL;
      const response = await generateText(
        selectedModel,
        `Phong cách: ${readingStyle || "hấp dẫn, lôi cuốn"}\nVăn bản gốc:\n${text}`,
        {
          systemInstruction,
          temperature: 0.7,
        }
      );
      return { optimizedText: response.text || text };
    } catch (error: any) {
      console.error("[geminiService.optimizeScript] Error, fallback to mock script:", error);
      return { optimizedText: `[Tối ưu hóa Giả lập] ${text}` };
    }
  },

  /**
   * Tối ưu prompt hình ảnh (cấu trúc JSON)
   */
  async optimizeImagePrompt(description: string, imageUris?: string[], modelName?: string) {
    const normalizedDescription = String(description || "").trim();

    const getMockImagePrompt = () => {
      return {
        subject: normalizedDescription || "image concept",
        clothing_material: "",
        action_pose: "",
        setting_lighting: "",
        camera_parameters: "",
        optimized_english_prompt: `A precise visual that faithfully represents this exact marketing or business concept: ${normalizedDescription || "the provided concept"}`,
        negative_prompt: "ugly, blurry, low quality",
      };
    };

    if (!normalizedDescription) {
      return getMockImagePrompt();
    }

    if (!process.env.GEMINI_API_KEY) {
      return getMockImagePrompt();
    }

    try {
      const optimizeMessages: any[] = [
        {
          role: "system",
          content: `You are an expert prompt engineer for image generators. Optimize the user's image description into a high-quality, descriptive English prompt.
Preserve the exact business topic, audience, use-case, and key message from the user's input.
Do not convert a concrete brief into a generic product shot, generic lifestyle image, abstract office scene, or unrelated beauty visual.
If the prompt is about software, ecommerce, omnichannel, logistics, operations, training, consulting, customer growth, or workflow, explicitly visualize that real context.
Translate faithfully from Vietnamese to English when needed. Semantic fidelity is more important than creative embellishment.
Do not introduce new objects, characters, industries, locations, demographics, props, outfits, or claims unless they are explicitly grounded in the source input or attached references.
When source files or images are provided, use them as constraints and preserve the same meaning as closely as possible.
Output MUST be a valid JSON object matching this schema:
{
  "subject": "string",
  "clothing_material": "string",
  "action_pose": "string",
  "setting_lighting": "string",
  "camera_parameters": "string",
  "optimized_english_prompt": "string of the final detailed prompt in English",
  "negative_prompt": "string of negative prompts"
}
Do not include markdown blocks or any text other than the JSON object.`
        }
      ];

      const systemMessage = optimizeMessages[0].content;
      const userText = `Translate and optimize this media brief into English while preserving the exact topic, context, audience, business meaning, and factual constraints from the original input: ${normalizedDescription}`;
      const result = await generateText(GEMINI_TEXT_MODEL, userText, {
        systemInstruction: systemMessage,
        responseMimeType: "application/json",
        images: imageUris?.filter((u: string) => u && typeof u === "string"),
      });
      return safeParseJson(result.text);
    } catch (error: any) {
      console.error("[geminiService.optimizeImagePrompt] Gemini Error, fallback to local optimizer:", error);
      return getMockImagePrompt();
    }
  },

  /**
   * Tối ưu prompt video (cấu trúc JSON)
   */
  async optimizeVideoPrompt(description: string, imageUris?: string[]) {
    const normalizedDescription = String(description || "").trim();

    const getMockVideoPrompt = () => {
      const text = normalizedDescription.toLowerCase().trim();
      const isEnglish = !/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(normalizedDescription);
      if (isEnglish) {
        return {
          motion_analysis: "smooth cinematic motion of the subject",
          camera_movement: "slow pan, dynamic focus tracking",
          optimized_english_prompt: `A high quality cinematic video representing: ${normalizedDescription || "the provided concept"}`,
        };
      }

      // Default values
      let englishSubject = "a cinematic scene";
      let motion = "subtle and realistic movements of the subject";
      let camera = "slow cinematic pan, smooth tracking shot";
      let lighting = "cinematic lighting, soft volumetric rays";
      let style = "photorealistic, 8k resolution, highly detailed, masterpiece";

      // Translation mappings
      const dict: { [key: string]: string } = {
        "câu chuyện ngắn về tuna": "a short narrative story about a character named Tuna",
        "câu chuyện về tuna": "a narrative story featuring Tuna",
        "tập truyện về tuna": "a short story about Tuna",
        "tuna": "a character named Tuna",
        "núi tuyết": "majestic snow-capped mountains under a clear sky",
        "núi": "picturesque mountain ranges",
        "hoàng hôn": "sunset during golden hour with warm amber tones",
        "bình minh": "sunrise during blue hour, soft morning mist",
        "sản phẩm": "a premium commercial product showcase",
        "quảng cáo": "high-end promotional commercial video",
        "người mẫu": "an elegant fashion model",
        "sàn diễn": "a glamorous fashion show catwalk runway",
        "runway": "fashion catwalk runway with bright studio lights",
        "flycam": "aerial drone perspective sweeping across the landscape",
        "bay": "soaring aerial shot",
        "xoay": "360-degree rotating showcase",
        "cận cảnh": "extreme close-up macro details",
        "toàn cảnh": "wide-angle scenic overview",
        "xe": "a sleek modern luxury sports car",
        "ô tô": "a luxury car driving along a scenic route",
        "biển": "crystal clear ocean waves gently crashing on a sandy beach",
        "đại dương": "vast deep blue ocean landscape",
        "thành phố": "modern cityscape with towering skyscrapers",
        "công nghệ": "futuristic technology environment with holographic displays",
        "phim": "cinematic movie style footage",
        "điện ảnh": "cinematic film style",
        "chậm": "dramatic slow-motion video",
        "nhanh": "dynamic fast-paced cuts and motion",
      };

      // Sort keys by length descending to match longest phrases first
      const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
      let remainingText = text;
      const detectedKeywords: string[] = [];

      for (const key of keys) {
        if (remainingText.includes(key)) {
          detectedKeywords.push(dict[key]);
          remainingText = remainingText.replace(new RegExp(key, 'g'), '');
        }
      }

      if (detectedKeywords.length > 0) {
        englishSubject = detectedKeywords.join(", ");
      } else {
        const cleanText = normalizedDescription
          .replace(/tiến hành/gi, "")
          .replace(/tạo 1/gi, "")
          .replace(/tạo một/gi, "")
          .replace(/tạo/gi, "")
          .replace(/làm/gi, "")
          .trim();
        if (cleanText) {
          englishSubject = `a cinematic representation of: "${cleanText}"`;
        }
      }

      // Adjust motion and camera based on keyword detection
      if (text.includes("chậm") || text.includes("slow")) {
        motion = "dramatic slow-motion action with elegant fluid dynamics";
        camera = "ultra-smooth slow tracking camera";
      } else if (text.includes("nhanh") || text.includes("fast")) {
        motion = "high-energy fast-paced dynamic actions";
        camera = "rapid cuts, active handheld tracking, whip pans";
      }

      if (text.includes("flycam") || text.includes("bay") || text.includes("trên cao")) {
        camera = "high-altitude aerial drone sweep, panning down smoothly";
      } else if (text.includes("xoay") || text.includes("360")) {
        camera = "orbiting 360-degree rotation around the subject";
      } else if (text.includes("cận cảnh") || text.includes("cận")) {
        camera = "macro close-up focus with shallow depth of field";
      }

      if (text.includes("sản phẩm") || text.includes("product")) {
        lighting = "professional studio key lighting, soft box diffusion, edge highlight";
        style = "commercial grade, high-end product commercial, 8k, photorealistic";
      } else if (text.includes("người mẫu") || text.includes("fashion") || text.includes("runway")) {
        lighting = "bright runway stage lights, high-contrast spotlighting, camera flashes";
        style = "high-fashion editorial look, cinematic 4k, vibrant colors";
      }

      const optimized_english_prompt = `Cinematic, photorealistic video of ${englishSubject}. ${motion}. Camera movement: ${camera}. Lighting: ${lighting}. Visual style: ${style}. Rendered in crisp 4k, volumetric atmosphere, hyper-detailed textures.`;

      return {
        motion_analysis: motion,
        camera_movement: camera,
        optimized_english_prompt,
      };
    };

    if (!normalizedDescription) {
      return {
        motion_analysis: "smooth cinematic motion of the subject",
        camera_movement: "slow pan, dynamic focus tracking",
        optimized_english_prompt: "A high quality cinematic video with clear subject focus and natural movement.",
      };
    }

    if (!process.env.GEMINI_API_KEY) {
      return getMockVideoPrompt();
    }

    try {
      const messages: any[] = [
        {
          role: "system",
          content: `You are an expert prompt engineer for video generators. Optimize the description into a high-quality video prompt.
Preserve the exact meaning of the original input. Translate faithfully from Vietnamese to English when needed.
Do not add unrelated cinematic elements, fashion cues, generic lifestyle filler, or abstract visuals that are not grounded in the source brief.
If source images are provided, treat them as grounding constraints and keep the prompt semantically aligned with them.
Output MUST be a valid JSON object matching this schema:
{
  "motion_analysis": "Detailed description of the motion of subjects, speed changes, and physics of the scene",
  "camera_movement": "Detailed description of camera movements, panning, focal adjustments, depth of field, and camera paths",
  "optimized_english_prompt": "A complete, highly descriptive visual prompt in English, combining composition, lighting, cinematic style, and subject details"
}
Do not include markdown blocks or any text other than the JSON object.`
        }
      ];

      const videoSystemMessage = messages[0].content;
      const videoUserText = `Translate and optimize this video brief into English while preserving the exact topic, context, audience, and factual meaning from the original input: ${normalizedDescription}`;
      const videoResult = await generateText(GEMINI_TEXT_MODEL, videoUserText, {
        systemInstruction: videoSystemMessage,
        responseMimeType: "application/json",
        images: imageUris?.filter((u: string) => u && typeof u === "string"),
      });
      return safeParseJson(videoResult.text);
    } catch (error: any) {
      console.error("[geminiService.optimizeVideoPrompt] Gemini Error, fallback to local optimizer:", error);
      return getMockVideoPrompt();
    }
  },

  /**
   * Biên tập video bằng prompt (LLM sinh JSON Blueprint + Render Engine)
   */
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
    const urls = videoUrl.split(/,\s*(?=https?:\/\/)/).map(u => u.trim()).filter(Boolean);
    const isMultiple = urls.length > 1;
    const clientDurations = options?.videoDurations || [];

    const urlDurations: { [url: string]: number } = {};
    let totalComputedDuration = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      let dur = clientDurations[i] ? Number(clientDurations[i]) : 0;
      if (dur <= 0) {
        dur = await getVideoDuration(url);
      }
      urlDurations[url] = dur;
      totalComputedDuration += dur;
    }

    let originalDuration = options?.duration || totalComputedDuration;

    const getFallbackBlueprint = () => {
      let currentOffset = 0;
      const timeline: any[] = [];
      for (const url of urls) {
        const dur = urlDurations[url] || 5;
        timeline.push({
          type: "video",
          src: url,
          start: 0,
          end: dur,
          playbackRate: 1.0
        });
        currentOffset += dur;
      }
      timeline.push({
        type: "text",
        content: "Bản ghép Video",
        start: 0,
        end: Math.min(3, currentOffset),
        style: {
          position: "bottom-center",
          color: "#FFFFFF",
          fontSize: "32px"
        }
      });
      return { timeline };
    };

    let blueprint = getFallbackBlueprint();

    try {
      const isCopyPrompt = videoBlueprintService.isCopyPrompt(prompt);

      if (isCopyPrompt) {
        blueprint = await videoBlueprintService.copyAndScaleBlueprint(
          userId,
          urls,
          urlDurations,
          getVideoDuration
        );
      } else if (process.env.GEMINI_API_KEY) {
        const systemPrompt = `You are a professional video editing assistant. Your job is to translate a user's natural language video editing instructions (supporting both English and Vietnamese) into a precise Remotion video editing JSON blueprint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CRITICAL DURATION PRESERVATION RULE (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Unless the user explicitly requests to cut, crop, skip, trim, or remove segments of the video (using words like "cắt", "bỏ", "skip", "remove", "trim"), you MUST keep the ENTIRE duration of the video.
- NEVER default to shortening the video.
- If you split a video to apply an effect (such as a zoom, speed, or filter) to a specific part, the sum of the split segments MUST equal the EXACT duration of the original source video.
- HANDLING GAPS: If the user describes edits for specific segments (e.g. 0-5s and 20-30s) but doesn't mention the middle segment (5-20s), you MUST still include the middle segment (5-20s) as a normal video clip (playbackRate: 1.0, no effects/filters) to keep the timeline continuous and preserve the entire video.
- EXACT END TIME MATCHING: The final clip in the timeline must end exactly at the video's originalDuration (or the end of the last source video). If the last split segment ends at X and the video duration is D (where X < D), you MUST add a final clip from X to D.
- For example, if a video is exactly 30 seconds long:
  - If the user asks to "zoom 5 seconds at the beginning", you MUST output:
    1. Clip 1 (0s to 5s) with zoom
    2. Clip 2 (5s to 30s) without zoom
    Total duration = 30 seconds.
  - If the user asks to "zoom in/out every 3s", you must partition the full 30s into chunks of 3s: [0-3s], [3-6s], [6-9s], ..., [27-30s]. All parts must sum up to exactly 30s.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 CRITICAL AUDIO & SFX POSITIONING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "start" and "end" for all elements (text, image, audio) are specified relative to the FINAL COMPILED video timeline.
- Background music (nhạc nền) or songs should span the exact requested range. If the user requests "10s cuối cho nhạc" (last 10 seconds for music) in a 30s video, the audio start MUST be 20, and end MUST be 30.
- If the user wants background music throughout the video, start MUST be 0 and end MUST be total_final_duration.
- Sound effects (SFX like "ting", "whoosh") should start exactly at the highlighted transition and last only 1-2 seconds (e.g., if a zoom happens at 5s, the ting SFX should start at 5 and end at 6.5).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📽️ SOURCE VIDEOS INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isMultiple 
  ? `The user has provided MULTIPLE input videos. Here is the list of source videos available:
${urls.map((url, idx) => `▸ Video ${idx + 1}: URL: "${url}", Duration: ${urlDurations[url]} seconds.`).join("\n")}

You MUST map each video clip segment to its correct source URL by setting the "src" property of the video clip to the exact URL of that video from the list above. 
CRITICAL MULTI-VIDEO RULES:
- Join them in the logical order requested (e.g. Video 1, then Video 2).
- The total target duration of the compiled video MUST be the EXACT sum of all source video durations: (Duration of Video 1 + Duration of Video 2 + ... + Duration of Video N) unless there is a specific instruction to trim or cut a video.
- For each source video, you MUST generate segments that cover its ENTIRE original duration. For example, if Video 1 is 10s and Video 2 is 15s, you must create video clips for Video 1 covering [0s to 10s] and video clips for Video 2 covering [0s to 15s]. The final video length must be exactly 25s.
- The "start" and "end" timestamps inside each video segment must be relative to that source video's original timeline (from 0 to its specific duration).
- Keep the timeline continuous. Calculate the cumulative duration of all preceding clips (taking playbackRate into account) to know the start/end offsets for text overlays, audio tracks, and logos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🇻🇳 QUY TẮC GHÉP VIDEO TIẾNG VIỆT (VIETNAMESE CONCATENATION RULES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Khi người dùng yêu cầu ghép video (sử dụng các từ như "ghép video", "nối video", "ghép lại", "nối lại", "gộp video", "ghép các clip", "nối các clip lại với nhau"):
  - Bạn MUST sắp xếp tất cả các video được cung cấp theo đúng thứ tự (Video 1, Video 2,... Video N).
  - Trừ khi có yêu cầu cắt/trim cụ thể, mỗi video phải chạy trọn vẹn thời lượng gốc của nó (start: 0, end: duration).
  - Tổng thời lượng của video đầu ra phải bằng tổng thời lượng của các video gốc cộng lại.
  - Vẫn giữ nguyên các layer text, nhạc nền hay logo chạy song song trong final timeline nếu được yêu cầu.` 
  : `The original video URL is "${urls[0]}".
The original video duration is exactly ${originalDuration || 5} seconds.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✂️ SECTION 1: CUTTING & TRIMMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "cắt bỏ X giây đầu" / "bỏ đầu X giây" / "skip first X seconds" -> start video clip at X.
- "cắt bỏ X giây cuối" / "bỏ cuối X giây" / "remove last X seconds" -> end video clip at (originalDuration - X).
- "lấy đoạn từ X đến Y giây" / "keep from X to Y" -> start=X, end=Y.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏩ SECTION 2: PACING & PLAYBACK RATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "tua nhanh gấp N lần" -> set playbackRate to N (e.g. 2.0).
- "tua chậm N lần" -> set playbackRate to 1/N (e.g. 0.5).
* SPEED MATH RULE:
If a segment from source time S to E is speed-ramped by rate R:
Its final duration in the compiled video = (E - S) / R.
You MUST split the video clip into multiple sequential clips whenever the playback rate changes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SECTION 3: ZOOM EFFECTS (TIMING & FREQUENCY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zoom is applied per clip. Split the video track at the exact second of the zoom and apply "effects.zoom": "in" or "out".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 SECTION 4: VISUAL COLOR FILTERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "tăng sáng" / "brighten" -> filters.brightness: 1.35
- "làm tối" / "darken" -> filters.brightness: 0.65
- "đen trắng" / "grayscale" -> filters.grayscale: 1.0
- "cinematic" / "màu phim điện ảnh" -> filters.contrast: 1.25, filters.saturate: 1.3, filters.brightness: 0.95

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 SECTION 5: MUSIC & SOUND DESIGN (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST choose the exact URL from the preloaded library below. NEVER make up URLs.
Background Music:
▸ Upbeat/EDM/Sôi động: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
▸ Tech/Rhythmic/Công nghệ nhịp nhàng: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
▸ Corporate/Doanh nghiệp/Quảng cáo: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"
▸ Lofi Chill/Thư giãn: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"
▸ Acoustic/Piano/Nhẹ nhàng: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"

Sound Effects (SFX):
▸ Success/Ting sound/Thành công: "https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav"
▸ Transition/Whoosh sound/Lướt qua: "https://assets.mixkit.co/active_storage/sfx/2013/2013-84.wav"
▸ Laughter/Tiếng cười: "https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav"
▸ Explosion/Tiếng nổ: "https://assets.mixkit.co/active_storage/sfx/2798/2798-84.wav"
▸ Censor Beep/Tiếng tít: "https://assets.mixkit.co/active_storage/sfx/1076/1076-84.wav"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 SECTION 6: TEXT OVERLAYS & TITLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "chèn chữ" / "hiển thị phụ đề" / "add text" -> type: "text".
- Placement: bottom-center (for captions/lyrics), center (for main titles), top-left/top-right (for logos/branding).
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
Return ONLY valid JSON. No markdown backticks, no comments, no conversational text.
{
  "timeline": [
    {
      "type": "video",
      "src": "string (source video url exactly)",
      "start": number (seconds),
      "end": number (seconds),
      "playbackRate": number (default 1.0),
      "filters": {
        "brightness": number (optional),
        "grayscale": number (optional),
        "blur": number (optional),
        "sepia": number (optional),
        "contrast": number (optional),
        "saturate": number (optional),
        "hueRotate": number (optional)
      },
      "effects": {
        "zoom": "in" | "out" | "none",
        "rotate": number (degrees),
        "transition": "fade" | "none"
      }
    },
    {
      "type": "text",
      "content": "string",
      "start": number (seconds in final timeline),
      "end": number (seconds in final timeline),
      "style": {
        "position": "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right",
        "color": "#HEX",
        "fontSize": "32px"
      }
    },
    {
      "type": "audio",
      "src": "string (exact URL from library)",
      "start": number (seconds in final timeline),
      "end": number (seconds in final timeline),
      "volume": number (0 to 1)
    }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 WORKED EXAMPLES FOR COMPLEX PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ Example A: "Nối Video 1 (10s) và Video 2 (15s). Chèn nhạc lofi thư giãn xuyên suốt."
- IMPORTANT: "start" and "end" inside each video clip are the timestamp range WITHIN THAT SOURCE VIDEO, always starting from 0 for each new source.
- The total output duration = 10 + 15 = 25s. Audio spans 0 to 25s of the final output.
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO_1", "start": 0, "end": 10, "playbackRate": 1.0 },
    { "type": "video", "src": "URL_VIDEO_2", "start": 0, "end": 15, "playbackRate": 1.0 },
    { "type": "audio", "src": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", "start": 0, "end": 25, "volume": 0.7 }
  ]
}

▸ Example B: "Nối 3 video (V1=5s, V2=7s, V3=10s). Không có hiệu ứng gì."
- Total output = 5 + 7 + 10 = 22s. Each source video is fully used from 0 to its duration.
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO_1", "start": 0, "end": 5, "playbackRate": 1.0 },
    { "type": "video", "src": "URL_VIDEO_2", "start": 0, "end": 7, "playbackRate": 1.0 },
    { "type": "video", "src": "URL_VIDEO_3", "start": 0, "end": 10, "playbackRate": 1.0 }
  ]
}

▸ Example C: "Cắt bỏ 3 giây đầu của video. Đoạn 5s tiếp theo zoom vào và làm đen trắng. Phần còn lại bình thường." (Duration: 15s)
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO", "start": 3, "end": 8, "playbackRate": 1.0, "filters": { "grayscale": 1.0 }, "effects": { "zoom": "in" } },
    { "type": "video", "src": "URL_VIDEO", "start": 8, "end": 15, "playbackRate": 1.0 }
  ]
}

▸ Example D: "Tua nhanh 4s đầu gấp 2 lần, zoom vào giây thứ 2. Thêm phụ đề 'Bắt đầu' từ 0 đến 2s." (Duration: 8s)
- Original 0-4s at 2x becomes 2s final. Zoom-in starts at original 2s (which is final 1s).
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO", "start": 0, "end": 2, "playbackRate": 2.0 },
    { "type": "video", "src": "URL_VIDEO", "start": 2, "end": 4, "playbackRate": 2.0, "effects": { "zoom": "in" } },
    { "type": "video", "src": "URL_VIDEO", "start": 4, "end": 8, "playbackRate": 1.0 },
    { "type": "text", "content": "Bắt đầu", "start": 0, "end": 2, "style": { "position": "bottom-center", "color": "#FFFFFF", "fontSize": "32px" } }
  ]
}

▸ Example E: "Nối 2 video (V1=6s, V2=8s). Làm đen trắng V1. Zoom vào lúc giây thứ 3 của V1. Chèn tiếng cười sfx lúc bắt đầu V2."
- V1 is 6s (split into 0-3s and 3-6s to apply zoom at second 3). V2 is 8s starting fresh from 0.
- IMPORTANT: For each source video, start/end are timestamps within THAT video, not the final output timeline.
- SFX "start" 6 = lúc V2 bắt đầu trong final timeline (sau V1=6s). SFX "end" 8 = 6s(V1) + 2s(SFX duration).
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO_1", "start": 0, "end": 3, "playbackRate": 1.0, "filters": { "grayscale": 1.0 } },
    { "type": "video", "src": "URL_VIDEO_1", "start": 3, "end": 6, "playbackRate": 1.0, "filters": { "grayscale": 1.0 }, "effects": { "zoom": "in" } },
    { "type": "video", "src": "URL_VIDEO_2", "start": 0, "end": 8, "playbackRate": 1.0 },
    { "type": "audio", "src": "https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav", "start": 6, "end": 8, "volume": 0.9 }
  ]
}

▸ Example F: "Ghép các video này lại với nhau, thêm nhạc lofi thư giãn" (V1=8s, V2=12s)
- Total output = 8 + 12 = 20s. Both videos are played sequentially in full.
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO_1", "start": 0, "end": 8, "playbackRate": 1.0 },
    { "type": "video", "src": "URL_VIDEO_2", "start": 0, "end": 12, "playbackRate": 1.0 },
    { "type": "audio", "src": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", "start": 0, "end": 20, "volume": 0.7 }
  ]
}

▸ Example G: "Ghép video 1 và video 2 lại, chèn chữ 'Kết quả' ở giây thứ 5 đến 8" (V1=6s, V2=10s)
- Total output = 6 + 10 = 16s.
{
  "timeline": [
    { "type": "video", "src": "URL_VIDEO_1", "start": 0, "end": 6, "playbackRate": 1.0 },
    { "type": "video", "src": "URL_VIDEO_2", "start": 0, "end": 10, "playbackRate": 1.0 },
    { "type": "text", "content": "Kết quả", "start": 5, "end": 8, "style": { "position": "bottom-center", "color": "#FFFFFF", "fontSize": "32px" } }
  ]
}
`;

        const messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the video editing JSON blueprint for: "${prompt}"` }
        ];

        const editResult = await generateText(GEMINI_TEXT_MODEL, `Generate JSON blueprint for: "${prompt}"`, {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        });
        blueprint = safeParseJson(editResult.text);
      }
    } catch (error) {
      console.error("[geminiService.editVideo] Failed to get LLM blueprint:", error);
      throw error;
    }

    // Save record to database with status processing (queued state description)
    const record = await AIMediaModel.create({
      userId,
      mediaType: "video",
      url: `pending://local-render/${userId}-${Date.now()}`,
      prompt,
      metadata: {
        status: "processing",
        progress: 5,
        provider: "local-render",
        title: `Biên tập: ${prompt}`,
        description: `Đang xếp hàng chờ kết xuất video bằng FFMPEG / Cloud Render.`,
        blueprint: JSON.stringify(blueprint),
        renderLogs: [
          "[LLM] Đang phân tích prompt...",
          `[LLM] Đã phân tích thành công JSON Blueprint: ${JSON.stringify(blueprint, null, 2)}`,
          "[Hàng đợi] Đã thêm yêu cầu render vào hàng đợi Redis."
        ],
        aspectRatio: options?.aspectRatio || "16:9",
        resolution: options?.resolution || "720p",
      }
    });

    // Add render task to Redis queue
    try {
      await remotionQueueService.addRenderJob(record._id.toString(), videoUrl, blueprint, userId);
    } catch (queueErr: any) {
      console.warn(`[Remotion Queue] Không thể dùng hàng đợi Redis (lỗi: ${queueErr.message || queueErr}). Đang tự động xử lý render trực tiếp.`);
      // Run the rendering task in the background directly without queue
      void geminiService.executeLocalRenderJob(record._id.toString(), videoUrl, blueprint, userId);
    }

    return {
      status: "success",
      record,
      blueprint
    };
  },

  async executeLocalRenderJob(recordId: string, videoUrl: string, blueprint: any, userId: string) {
    console.log(`[Remotion Queue Worker] Starting task for record ${recordId}`);
    const timeline = blueprint.timeline || [];
    
    const currentRecord = await AIMediaModel.findById(recordId);
    const logs = currentRecord?.metadata?.renderLogs || [
      "[LLM] Đang phân tích prompt...",
      `[LLM] Đã phân tích thành công JSON Blueprint: ${JSON.stringify(blueprint, null, 2)}`,
      "[Hàng đợi] Đã thêm yêu cầu render vào hàng đợi Redis."
    ];
    
    logs.push("[Render Engine] Bắt đầu xử lý tác vụ từ hàng đợi...");
    
    const updateLogs = async (progress: number, newLog?: string) => {
      if (newLog) {
        console.log(`[Remotion Queue Worker] [${progress}%] ${newLog}`);
        logs.push(newLog);
      }
      await AIMediaModel.findByIdAndUpdate(recordId, {
        "metadata.progress": progress,
        "metadata.renderLogs": logs,
        "metadata.description": `Đang kết xuất video tự động bằng FFMPEG / Cloud Render. Tiến trình: ${progress}%`
      });
    };

    try {
      const record = await AIMediaModel.findById(recordId);
      const aspect = record?.metadata?.aspectRatio || "16:9";
      const resolution = record?.metadata?.resolution || "720p";

      let targetWidth = 1280;
      let targetHeight = 720;

      if (aspect === "9:16") {
        if (resolution === "1080p") {
          targetWidth = 1080;
          targetHeight = 1920;
        } else {
          targetWidth = 720;
          targetHeight = 1280;
        }
      } else if (aspect === "1:1") {
        if (resolution === "1080p") {
          targetWidth = 1080;
          targetHeight = 1080;
        } else {
          targetWidth = 720;
          targetHeight = 720;
        }
      } else { // default 16:9
        if (resolution === "1080p") {
          targetWidth = 1920;
          targetHeight = 1080;
        } else {
          targetWidth = 1280;
          targetHeight = 720;
        }
      }

      let finalVideoUrl = "";
      let renderSuccess = false;

      try {
        await updateLogs(25, "[Render Engine] Bắt đầu kết xuất video bằng Remotion...");
        
        finalVideoUrl = await remotionService.renderVideo(
          blueprint,
          { aspectRatio: aspect, resolution },
          async (progress, msg) => {
            await updateLogs(progress, msg);
          }
        );
        renderSuccess = true;
      } catch (remotionError: any) {
        await updateLogs(
          35,
          `[Render Engine Warning] Remotion Engine không thể kết xuất (có thể do thiếu Chromium): ${remotionError.message || String(remotionError)}. Đang tự động chuyển sang công cụ Render Fallback...`
        );
      }

      if (!renderSuccess) {
        finalVideoUrl = videoUrl;

        await updateLogs(40, "[Render Engine Fallback] Đang kiểm tra môi trường FFMPEG...");
        
        const hasFfmpeg = await new Promise<boolean>((resolve) => {
          exec("ffmpeg -version", (error) => {
            resolve(!error);
          });
        });

        await updateLogs(45, `[Render Engine Fallback] Kết quả FFMPEG: ${hasFfmpeg ? "Đã cài đặt" : "Chưa cài đặt"}`);
        if (hasFfmpeg) {
          const cacheDir = path.join(process.cwd(), "server/cache/videos");
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }

          const videoClips = timeline.filter((item: any) => item.type === "video");
          const textElements = timeline.filter((item: any) => item.type === "text");
          const imageElements = timeline.filter((item: any) => item.type === "image");
          const audioElements = timeline.filter((item: any) => item.type === "audio");

          // Extract all unique source video URLs from timeline video clips
          let uniqueVideoUrls: string[] = Array.from(new Set(videoClips.map((clip: any) => clip.src).filter(Boolean))) as string[];
          
          // If the timeline didn't specify any source URLs (fallback case), extract them from the request videoUrl
          if (uniqueVideoUrls.length === 0) {
            uniqueVideoUrls = videoUrl.split(/,\s*(?=https?:\/\/)/).map(u => u.trim()).filter(Boolean);
          }

          const videoTempPaths: string[] = [];
          const urlToInputIdx: { [url: string]: number } = {};

          for (let i = 0; i < uniqueVideoUrls.length; i++) {
            const url = uniqueVideoUrls[i];
            const tempInput = path.join(os.tmpdir(), `input_${ recordId }_${ i }.mp4`);
            
            const urlParts = url.split("/");
            const filename = urlParts[urlParts.length - 1];
            const localCachePath = path.join(cacheDir, filename);

            if (filename && filename.match(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/) && fs.existsSync(localCachePath)) {
              await updateLogs(50, `[Render Engine Cache]Phát hiện video nguồn ${ i + 1} trong cache cục bộ(${ filename }).Sao chép...`);
              fs.copyFileSync(localCachePath, tempInput);
            } else {
              await updateLogs(50, `[Render Engine Fallback] Đang tải video gốc ${ i + 1 }/${uniqueVideoUrls.length} xuống server tạm...`);
const response = await fetchWithRetry(url);
if (!response.ok) {
  throw new Error(`Tải video gốc ${i + 1} thất bại: HTTP ${response.status}`);
}
const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync(tempInput, buffer);
            }
videoTempPaths.push(tempInput);
urlToInputIdx[url] = i;
          }

await updateLogs(55, "[Render Engine Fallback] Đang phát hiện luồng âm thanh...");
const hasAudioMap: { [idx: number]: boolean } = {};
for (let i = 0; i < videoTempPaths.length; i++) {
  const tempInputPath = videoTempPaths[i];
  const hasAudio = await new Promise<boolean>((resolve) => {
    exec(`ffmpeg -i "${tempInputPath}"`, (error, stdout, stderr) => {
      const info = stderr || stdout || "";
      resolve(info.includes("Audio:"));
    });
  });
  hasAudioMap[i] = hasAudio;
}

await updateLogs(60, `[Render Engine Fallback] Âm thanh nguồn các video: ${videoTempPaths.map((_, i) => `Video ${i + 1}: ${hasAudioMap[i] ? "Có" : "Không"}`).join(", ")}`);
await updateLogs(65, "[Render Engine Fallback] Đang xử lý các tài nguyên lớp phủ (overlay)...");

// 1. Download image overlays to temp files
const imageTempPaths: string[] = [];
for (let i = 0; i < imageElements.length; i++) {
  const img = imageElements[i];
  const tempImgPath = path.join(os.tmpdir(), `overlay_img_${recordId}_${i}${path.extname(img.src || '.png')}`);
  try {
    const imgRes = await fetchWithRetry(img.src);
    if (imgRes.ok) {
      fs.writeFileSync(tempImgPath, Buffer.from(await imgRes.arrayBuffer()));
      imageTempPaths.push(tempImgPath);
    } else {
      imageTempPaths.push("");
    }
  } catch (err) {
    imageTempPaths.push("");
  }
}

// 2. Download audio overlays to temp files
const audioTempPaths: string[] = [];
for (let i = 0; i < audioElements.length; i++) {
  const aud = audioElements[i];
  const tempAudPath = path.join(os.tmpdir(), `overlay_aud_${recordId}_${i}${path.extname(aud.src || '.mp3')}`);
  try {
    const audRes = await fetchWithRetry(aud.src);
    if (audRes.ok) {
      fs.writeFileSync(tempAudPath, Buffer.from(await audRes.arrayBuffer()));
      audioTempPaths.push(tempAudPath);
    } else {
      audioTempPaths.push("");
    }
  } catch (err) {
    audioTempPaths.push("");
  }
}

// 3. Build FFMPEG filter graph
let filterComplex = "";
let inputArgs: string[] = [];

// Image and audio inputs start after the video inputs
let currentInputIdx = videoTempPaths.length;
const imageInputMappings: { [key: number]: number } = {};
const audioInputMappings: { [key: number]: number } = {};

imageElements.forEach((img: any, idx: number) => {
  const localPath = imageTempPaths[idx];
  if (localPath) {
    inputArgs.push(`-i "${localPath}"`);
    imageInputMappings[idx] = currentInputIdx;
    currentInputIdx++;
  }
});

audioElements.forEach((aud: any, idx: number) => {
  const localPath = audioTempPaths[idx];
  if (localPath) {
    inputArgs.push(`-i "${localPath}"`);
    audioInputMappings[idx] = currentInputIdx;
    currentInputIdx++;
  }
});

// PRE-SPLIT: Each video input may be referenced by multiple clips (e.g. applying different
// effects to different time ranges of the same source video). FFMPEG does NOT allow reading
// the same input stream [N:v] or [N:a] multiple times in a filter_complex. We must pre-split
// each unique video input into as many copies as needed using the `split` filter.
const inputClipCounts: { [inputIdx: number]: number } = {};
const inputSplitCounters: { [inputIdx: number]: number } = {};
videoClips.forEach((clip: any) => {
  const inputIdx = urlToInputIdx[clip.src] ?? 0;
  inputClipCounts[inputIdx] = (inputClipCounts[inputIdx] || 0) + 1;
});

// Build split filters for video streams that are referenced more than once
Object.keys(inputClipCounts).forEach((idxStr) => {
  const inputIdx = parseInt(idxStr);
  const count = inputClipCounts[inputIdx];
  inputSplitCounters[inputIdx] = 0;
  if (count > 1) {
    const splitOutputs = Array.from({ length: count }, (_, i) => `[vsplit_${inputIdx}_${i}]`).join("");
    filterComplex += `[${inputIdx}:v]split=${count}${splitOutputs};`;
  }
});

// Build split filters for audio streams that are referenced more than once
const inputAudioSplitCounters: { [inputIdx: number]: number } = {};
Object.keys(inputClipCounts).forEach((idxStr) => {
  const inputIdx = parseInt(idxStr);
  const count = inputClipCounts[inputIdx];
  inputAudioSplitCounters[inputIdx] = 0;
  const hasAudioForInput = hasAudioMap[inputIdx] ?? false;
  if (count > 1 && hasAudioForInput) {
    const splitOutputs = Array.from({ length: count }, (_, i) => `[asplit_${inputIdx}_${i}]`).join("");
    filterComplex += `[${inputIdx}:a]asplit=${count}${splitOutputs};`;
  }
});

// Track silence inputs that will be added as extra ffmpeg inputs
const silenceInputIdxMap: { [clipIdx: number]: number } = {};
let silenceCount = 0;

let concatInputs = "";
videoClips.forEach((clip: any, idx: number) => {
  const start = clip.start ?? 0;
  const end = clip.end ?? 5;
  const rate = clip.playbackRate ?? 1;
  const clipDuration = (end - start) / rate;
  const inputIdx = urlToInputIdx[clip.src] ?? 0;
  const hasAudio = hasAudioMap[inputIdx] ?? false;
  const usesSplit = inputClipCounts[inputIdx] > 1;

  // Determine the video source label (split or direct)
  let vSrcLabel: string;
  if (usesSplit) {
    const splitI = inputSplitCounters[inputIdx];
    vSrcLabel = `[vsplit_${inputIdx}_${splitI}]`;
    inputSplitCounters[inputIdx] = splitI + 1;
  } else {
    vSrcLabel = `[${inputIdx}:v]`;
  }

  // Video stream processing
  let vFilter = `${vSrcLabel}trim=start=${start}:end=${end},setpts=PTS-STARTPTS`;
  if (clip.filters?.grayscale !== undefined && clip.filters.grayscale > 0) {
    vFilter += `,hue=s=${1 - clip.filters.grayscale}`;
  }
  if (clip.filters?.brightness !== undefined && clip.filters.brightness !== 1) {
    vFilter += `,eq=brightness=${clip.filters.brightness - 1}`;
  }
  if (clip.effects?.rotate !== undefined && clip.effects.rotate !== 0) {
    const rad = (clip.effects.rotate * Math.PI) / 180;
    vFilter += `,rotate=${rad}`;
  }
  if (clip.effects?.transition === "fade") {
    const fadeDur = Math.min(0.5, clipDuration / 2);
    vFilter += `,fade=in:st=0:d=${fadeDur},fade=out:st=${clipDuration - fadeDur}:d=${fadeDur}`;
  }
  if (rate !== 1) {
    vFilter += `,setpts=${1 / rate}*(PTS-STARTPTS)`;
  }
  vFilter += `,scale=w='min(${targetWidth},iw*${targetHeight}/ih)':h='min(${targetHeight},ih*${targetWidth}/iw)',pad=w=${targetWidth}:h=${targetHeight}:x='(${targetWidth}-iw)/2':y='(${targetHeight}-ih)/2':color=black,setsar=1`;
  vFilter += `,fps=fps=30`;
  vFilter += `[v_proc_${idx}];`;
  filterComplex += vFilter;
  concatInputs += `[v_proc_${idx}]`;

  // Audio stream processing
  if (hasAudio) {
    const usesSplitA = inputClipCounts[inputIdx] > 1;
    let aSrcLabel: string;
    if (usesSplitA) {
      const splitAi = inputAudioSplitCounters[inputIdx];
      aSrcLabel = `[asplit_${inputIdx}_${splitAi}]`;
      inputAudioSplitCounters[inputIdx] = splitAi + 1;
    } else {
      aSrcLabel = `[${inputIdx}:a]`;
    }
    let aFilter = `${aSrcLabel}atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS`;
    if (rate !== 1) {
      const clampedRate = Math.max(0.5, Math.min(2.0, rate));
      aFilter += `,atempo=${clampedRate}`;
    }
    aFilter += `[a_proc_${idx}];`;
    filterComplex += aFilter;
    concatInputs += `[a_proc_${idx}]`;
  } else {
    // For videos without audio: we use a silence input added via -f lavfi -i anullsrc
    // Track which extra input index this silence clip will be
    silenceInputIdxMap[idx] = currentInputIdx + silenceCount;
    silenceCount++;
    concatInputs += `[a_proc_${idx}]`; // will be resolved after building silence inputs
  }
});

// Add silence inputs for clips without audio (as -f lavfi -i anullsrc before filter_complex)
// We'll inject them at the correct positions using inputArgs prefix
const silenceInputArgs: string[] = [];
videoClips.forEach((clip: any, idx: number) => {
  const inputIdx = urlToInputIdx[clip.src] ?? 0;
  const hasAudio = hasAudioMap[inputIdx] ?? false;
  if (!hasAudio) {
    const start = clip.start ?? 0;
    const end = clip.end ?? 5;
    const rate = clip.playbackRate ?? 1;
    const clipDuration = (end - start) / rate;
    const silenceInputIdx = silenceInputIdxMap[idx];
    silenceInputArgs.push(`-f lavfi -i anullsrc=sample_rate=44100:channel_layout=stereo`);
    // Add filter to trim silence to exact clip duration
    filterComplex = filterComplex + `[${silenceInputIdx}:a]atrim=duration=${clipDuration}[a_proc_${idx}];`;
  }
});

// Insert silence inputs before the overlay inputs in the correct order
if (silenceInputArgs.length > 0) {
  inputArgs = [...silenceInputArgs, ...inputArgs];
  // Remap overlay input indices (they shifted by silenceCount)
  const remappedImageMappings: { [k: number]: number } = {};
  const remappedAudioMappings: { [k: number]: number } = {};
  Object.keys(imageInputMappings).forEach(k => {
    remappedImageMappings[parseInt(k)] = imageInputMappings[parseInt(k)] + silenceCount;
  });
  Object.keys(audioInputMappings).forEach(k => {
    remappedAudioMappings[parseInt(k)] = audioInputMappings[parseInt(k)] + silenceCount;
  });
  // Remap references in filterComplex for image/audio overlays
  Object.keys(imageInputMappings).forEach(k => {
    const oldIdx = imageInputMappings[parseInt(k)];
    const newIdx = remappedImageMappings[parseInt(k)];
    filterComplex = filterComplex.replaceAll(`[${oldIdx}:v]`, `[${newIdx}:v]`);
  });
  Object.keys(audioInputMappings).forEach(k => {
    const oldIdx = audioInputMappings[parseInt(k)];
    const newIdx = remappedAudioMappings[parseInt(k)];
    filterComplex = filterComplex.replaceAll(`[${oldIdx}:a]`, `[${newIdx}:a]`);
  });
  Object.assign(imageInputMappings, remappedImageMappings);
  Object.assign(audioInputMappings, remappedAudioMappings);
}

const numClips = videoClips.length;
filterComplex += `${concatInputs}concat=n=${numClips}:v=1:a=1[concatv][concata];`;

let currentVideoOut = "[concatv]";
const isWin = os.platform() === "win32";
const fontfileArg = isWin ? "fontfile='C\\:/Windows/Fonts/arial.ttf':" : "";

textElements.forEach((textItem: any, idx: number) => {
  const start = textItem.start ?? 0;
  const end = textItem.end ?? 5;
  const content = (textItem.content || "").replace(/'/g, "'\\\\''").replace(/:/g, "\\:");
  const style = textItem.style || {};
  const color = style.color || "white";

  let fontSizeNum = 32;
  if (style.fontSize) {
    const matched = String(style.fontSize).match(/(\d+)/);
    if (matched) {
      fontSizeNum = parseInt(matched[1]);
    }
  }

  let x = "(w-text_w)/2";
  let y = "h-text_h-80";

  // Vertical position mapping
  if (style.position?.startsWith("top-")) {
    y = "40";
  } else if (style.position === "center") {
    y = "(h-text_h)/2";
  } else if (style.position?.startsWith("bottom-")) {
    y = "h-text_h-80";
  }

  // Horizontal position mapping
  if (style.position?.endsWith("-left")) {
    x = "40";
  } else if (style.position?.endsWith("-right")) {
    x = "w-text_w-40";
  } else if (style.position?.endsWith("-center") || style.position === "center") {
    x = "(w-text_w)/2";
  }

  const nextVideoOut = `[textv_${idx}]`;
  filterComplex += `${currentVideoOut}drawtext=${fontfileArg}text='${content}':x=${x}:y=${y}:fontsize=${fontSizeNum}:fontcolor=${color}:enable='between(t,${start},${end})'${nextVideoOut};`;
  currentVideoOut = nextVideoOut;
});

imageElements.forEach((imgItem: any, idx: number) => {
  const start = imgItem.start ?? 0;
  const end = imgItem.end ?? 5;
  const style = imgItem.style || {};
  const mappedInputIdx = imageInputMappings[idx];
  if (mappedInputIdx === undefined) return;

  let x = "w-overlay_w-20";
  let y = "20";
  if (style.position === "top-left") {
    x = "20";
    y = "20";
  } else if (style.position === "bottom-left") {
    x = "20";
    y = "h-overlay_h-20";
  } else if (style.position === "bottom-right") {
    x = "w-overlay_w-20";
    y = "h-overlay_h-20";
  }

  const nextVideoOut = `[imgv_${idx}]`;
  filterComplex += `${currentVideoOut}[${mappedInputIdx}:v]overlay=x=${x}:y=${y}:enable='between(t,${start},${end})'${nextVideoOut};`;
  currentVideoOut = nextVideoOut;
});

// Final video stream is ready. Check if we need to mix background audio
filterComplex = filterComplex.replace(/;$/, "");

let currentAudioOut = "[concata]";
const activeAudioOverlays = audioElements.filter((_, idx) => audioInputMappings[idx] !== undefined);
if (activeAudioOverlays.length > 0) {
  let mixInputs = "[concata]";
  let audioMixFilter = "";
  audioElements.forEach((aud: any, idx: number) => {
    const mappedInputIdx = audioInputMappings[idx];
    if (mappedInputIdx === undefined) return;
    const start = aud.start ?? 0;
    const volume = aud.volume ?? 1;

    audioMixFilter += `[${mappedInputIdx}:a]adelay=${Math.round(start * 1000)}|${Math.round(start * 1000)},volume=${volume}[aud_delay_${idx}];`;
    mixInputs += `[aud_delay_${idx}]`;
  });
  audioMixFilter += `${mixInputs}amix=inputs=${activeAudioOverlays.length + 1}:duration=first[outa]`;
  filterComplex += `;${audioMixFilter}`;
  currentAudioOut = "[outa]";
}

const videoInputsStr = videoTempPaths.map(p => `-i "${p}"`).join(" ");
const inputsStr = `${videoInputsStr} ` + inputArgs.join(" ");
const tempOutput = path.join(os.tmpdir(), `output_${recordId}.mp4`);
const ffmpegCmd = `ffmpeg -y ${inputsStr} -filter_complex "${filterComplex}" -map "${currentVideoOut}" -map "${currentAudioOut}" -c:v libx264 -c:a aac -pix_fmt yuv420p -r 30 -vsync cfr "${tempOutput}"`;

await updateLogs(70, "[Render Engine Fallback] Đang thực thi lệnh FFMPEG chi tiết...");

await new Promise<void>((resolve, reject) => {
  exec(ffmpegCmd, (error, stdout, stderr) => {
    if (error) {
      console.error("FFMPEG execution failed detail:", stderr || stdout || error.message);
      reject(new Error(`FFMPEG render failed: ${error.message}`));
    } else {
      resolve();
    }
  });
});

await updateLogs(85, "[Render Engine Fallback] Đang tải video thành phẩm lên Cloudinary...");
const outputBuffer = fs.readFileSync(tempOutput);
finalVideoUrl = await cloudinaryService.uploadMediaBuffer(outputBuffer, "igen_erp/marketing/video");

// Save output to local cache folder
try {
  const cacheDir = path.join(process.cwd(), "server/cache/videos");
  const outUrlParts = finalVideoUrl.split("/");
  const outFilename = outUrlParts[outUrlParts.length - 1];
  if (outFilename && outFilename.match(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/)) {
    const outCachePath = path.join(cacheDir, outFilename);
    fs.copyFileSync(tempOutput, outCachePath);
    console.log(`[Render Engine Cache] Saved rendered video to local cache: ${outCachePath}`);
  }
} catch (cacheErr) {
  console.error("[Render Engine Cache Warning] Failed to save rendered video to cache:", cacheErr);
}

// Cleanup all temp files
try {
  videoTempPaths.forEach(p => { if (p) fs.unlinkSync(p); });
  fs.unlinkSync(tempOutput);
  imageTempPaths.forEach(p => { if (p) fs.unlinkSync(p); });
  audioTempPaths.forEach(p => { if (p) fs.unlinkSync(p); });
} catch (e) { }
        } else if (videoUrl.includes("res.cloudinary.com")) {
          await updateLogs(60, "[Render Engine Fallback] Không có FFMPEG. Sử dụng Cloud Render Engine...");

  const firstUrl = videoUrl.split(/,\s*(?=https?:\/\/)/)[0];
  const parts = firstUrl.split("/upload/");
  let transformString = "";

  const videoClips = timeline.filter((item: any) => item.type === "video");
  if (videoClips.length > 0) {
    const minStart = Math.min(...videoClips.map((item: any) => item.start ?? 0));
    const maxEnd = Math.max(...videoClips.map((item: any) => item.end ?? 5));
    transformString += `so_${minStart},eo_${maxEnd}/`;
  }

  const textElements = timeline.filter((item: any) => item.type === "text");
  for (const textItem of textElements) {
    const contentEscaped = encodeURIComponent(textItem.content).replace(/%/g, "%25");
    transformString += `l_text:Arial_36_bold:${contentEscaped},g_center,so_${textItem.start},eo_${textItem.end}/`;
  }

  finalVideoUrl = `${parts[0]}/upload/${transformString}${parts[1]}`;
  await updateLogs(80, `[Render Engine Fallback] Liên kết Cloud Render đã tạo: ${finalVideoUrl}`);
} else {
  await updateLogs(70, "[Render Engine Fallback] Không phát hiện FFMPEG. Chạy mô phỏng quá trình render...");
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await updateLogs(85, "[Render Engine Fallback] Mô phỏng render hoàn tất.");
}
      }

await updateLogs(95, "[Cloudinary] Đồng bộ hóa tài nguyên biên tập...");

await AIMediaModel.findByIdAndUpdate(recordId, {
  url: finalVideoUrl,
  "metadata.status": "completed",
  "metadata.progress": 100,
  "metadata.renderLogs": [...logs, "[Render Engine] Hoàn thành kết xuất video!"]
});

console.log(`[Remotion Queue Worker] Successfully completed. Final URL: ${finalVideoUrl}`);

    } catch (error: any) {
  console.error("[Remotion Queue Worker Error]", error);
  await AIMediaModel.findByIdAndUpdate(recordId, {
    "metadata.status": "failed",
    "metadata.error": error.message || String(error),
    "metadata.progress": 0,
    "metadata.renderLogs": [...logs, `[Render Engine Lỗi] ${error.message || String(error)}`]
  });
}
  },

  /**
   * Lấy lịch sử tạo đa phương tiện theo user và loại
   */
  async getMediaHistory(userId: string, mediaType: "image" | "video" | "voice") {
  try {
    const records = await AIMediaModel.find({ userId, mediaType })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (mediaType === "video") {
      await Promise.all(
        records.map(async (record: any) => {
          if (record.url && record.url.startsWith("pending://piapi/")) {
            const taskId = record.url.replace("pending://piapi/", "");
            try {
              const result = await piapiService.getTaskStatus(taskId);
              if (result.status === "completed" && result.url) {
                const cloudinaryUrl = await cloudinaryService.uploadMedia(result.url, "igen_erp/marketing/video");
                await AIMediaModel.updateOne(
                  { _id: record._id },
                  { url: cloudinaryUrl, "metadata.status": "completed", "metadata.progress": 100 }
                );
                record.url = cloudinaryUrl;
                record.metadata = { ...record.metadata, status: "completed", progress: 100 };

                const activeCardId = record.metadata?.activeCardId;
                if (activeCardId) {
                  const { MarketingContentModel } = require("../model/marketing-content.model");
                  await MarketingContentModel.findByIdAndUpdate(activeCardId, { videoUrl: cloudinaryUrl });
                }
              } else if (result.status === "failed") {
                await AIMediaModel.updateOne(
                  { _id: record._id },
                  { "metadata.status": "failed", "metadata.error": result.error || "Failed", "metadata.progress": 0 }
                );
                record.metadata = { ...record.metadata, status: "failed", error: result.error, progress: 0 };
              } else {
                const currentProgress = result.progress !== undefined ? result.progress : 0;
                await AIMediaModel.updateOne(
                  { _id: record._id },
                  { "metadata.progress": currentProgress }
                );
                record.metadata = { ...record.metadata, progress: currentProgress };
              }
            } catch (err) {
              console.error(`[getMediaHistory] Error refreshing pending task ${taskId}:`, err);
            }
          }
        })
      );
    }
    return records;
  } catch (error: any) {
    console.error("[geminiService.getMediaHistory] Error:", error);
    throw error;
  }
},

  /**
   * Xóa một bản ghi lịch sử
   */
  async deleteMediaHistory(userId: string, id: string) {
  try {
    const result = await AIMediaModel.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      throw new Error("Không tìm thấy bản ghi hoặc không có quyền xóa");
    }
    return { status: "success" };
  } catch (error: any) {
    console.error("[geminiService.deleteMediaHistory] Error:", error);
    throw error;
  }
},

  /**
   * Polling trạng thái video từ PiAPI chạy ngầm không chặn luồng HTTP
   */
  async pollPiAPIVideoStatusBackground(recordId: string, taskId: string, userId: string) {
  console.log(`[PiAPI Background Poll] Started polling for record ${recordId}, taskId ${taskId}`);

  let attempts = 0;
  const maxAttempts = 60; // 10 minutes (60 * 10 seconds)

  const runPoll = async () => {
    try {
      const result = await piapiService.getTaskStatus(taskId);
      console.log(`[PiAPI Background Poll] Record ${recordId} status: ${result.status}`);

      if (result.status === "completed" && result.url) {
        console.log(`[PiAPI Background Poll] Completed! Uploading to Cloudinary...`);
        const cloudinaryUrl = await cloudinaryService.uploadMedia(result.url, "igen_erp/marketing/video");

        const record = await AIMediaModel.findByIdAndUpdate(
          recordId,
          { url: cloudinaryUrl, "metadata.status": "completed", "metadata.progress": 100 },
          { new: true }
        );

        const activeCardId = record?.metadata?.activeCardId;
        if (activeCardId) {
          const { MarketingContentModel } = require("../model/marketing-content.model");
          await MarketingContentModel.findByIdAndUpdate(activeCardId, { videoUrl: cloudinaryUrl });
          console.log(`[PiAPI Background Poll] Updated target card ${activeCardId} with videoUrl: ${cloudinaryUrl}`);
        }
        return;
      } else if (result.status === "failed") {
        console.error(`[PiAPI Background Poll] Failed for task ${taskId}: ${result.error}`);
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.status": "failed",
          "metadata.error": result.error || "Lỗi tạo video từ PiAPI",
          "metadata.progress": 0,
        });
        return;
      } else {
        let currentProgress = typeof result.progress === "number" && result.progress > 0 ? result.progress : 0;
        if (currentProgress === 0) {
          currentProgress = Math.min(5 + attempts * 7, 95);
        }
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.progress": currentProgress
        });
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(runPoll, 10000);
      } else {
        console.error(`[PiAPI Background Poll] Timeout for task ${taskId}`);
        await AIMediaModel.findByIdAndUpdate(recordId, {
          "metadata.status": "timeout",
          "metadata.error": "Quá thời gian chờ tạo video từ PiAPI (10 phút)",
        });
      }
    } catch (error: any) {
      console.error(`[PiAPI Background Poll] Error polling task ${taskId}:`, error);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(runPoll, 10000);
      }
    }
  };

  setTimeout(runPoll, 10000);
},

  /**
   * Đồng bộ lưu trữ nâng cao của Image/Video sau khi sinh thành công
   */
  async saveGeneratedMediaRecord(userId: string, mediaType: "image" | "video", base64OrUrl: string, prompt: string, metadata ?: any) {
  try {
    let finalUrl = base64OrUrl;
    if (base64OrUrl.startsWith("data:")) {
      finalUrl = await cloudinaryService.uploadMedia(base64OrUrl, `igen_erp/marketing/${mediaType}`);
    }

    const record = await AIMediaModel.create({
      userId,
      mediaType,
      url: finalUrl,
      prompt,
      metadata,
    });
    return record;
  } catch (error: any) {
    console.error("[geminiService.saveGeneratedMediaRecord] Error:", error);
    throw error;
  }
},

  /**
   * Lấy danh sách giọng nói ElevenLabs
   */
  async getElevenLabsVoices() {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
    console.log("[geminiService.getElevenLabsVoices] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
    return {
      status: "success",
      voices: [
        {
          voice_id: "Sadaltager",
          name: "Roger (Mock)",
          category: "cloned",
          description: "Laid-Back, Casual, Resonant",
          labels: { gender: "male", age: "adult", accent: "american" }
        }
      ]
    };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": elevenLabsApiKey.trim()
      }
    });
    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.status}`);
    }
    const data = await response.json();
    // Filter generated or cloned voices
    const filtered = (data.voices || []).filter((v: any) => v.category === "cloned" || v.category === "generated" || v.category === "custom");
    return { status: "success", voices: filtered };
  } catch (error: any) {
    console.error("[geminiService.getElevenLabsVoices] Error:", error);
    throw error;
  }
},

  /**
   * Thiết kế & phát nghe thử giọng nói ElevenLabs
   */
  async generateCustomVoicePreview(input: { gender: string; accent: string; age: string; accentStrength: number; text: string }) {
  const { gender, accent, age, accentStrength, text } = input;
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
    console.log("[geminiService.generateCustomVoicePreview] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
    return {
      generatedVoiceId: "mock-voice-id-" + Date.now(),
      url: "data:audio/wav;base64,UklGRigAAABXQVZFlm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAG"
    };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voice-generation/generate-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey.trim()
      },
      body: JSON.stringify({
        gender,
        accent,
        age,
        accent_strength: accentStrength,
        text
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs preview error: ${response.status} - ${errText}`);
    }

    const generatedVoiceId = response.headers.get("generated_voice_id");
    if (!generatedVoiceId) {
      throw new Error("No generated_voice_id found in headers");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

    const mediaUrl = await cloudinaryService.uploadMedia(audioDataUri, "igen_erp/marketing/voice_previews");

    return {
      generatedVoiceId,
      url: mediaUrl
    };
  } catch (error: any) {
    console.error("[geminiService.generateCustomVoicePreview] Error:", error);
    throw error;
  }
},

  /**
   * Lưu giọng thiết kế thành giọng chính thức
   */
  async createCustomVoice(input: { voiceName: string; voiceDescription: string; generatedVoiceId: string }) {
  const { voiceName, voiceDescription, generatedVoiceId } = input;
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
    console.log("[geminiService.createCustomVoice] ELEVENLABS_API_KEY is not configured. Running in MOCK mode.");
    return {
      voice_id: "mock-saved-voice-id-" + Date.now()
    };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voice-generation/create-voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenLabsApiKey.trim()
      },
      body: JSON.stringify({
        voice_name: voiceName,
        voice_description: voiceDescription,
        generated_voice_id: generatedVoiceId
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs create-voice error: ${response.status} - ${errText}`);
    }

    const result = await response.json();
    return { voice_id: result.voice_id };
  } catch (error: any) {
    console.error("[geminiService.createCustomVoice] Error:", error);
    throw error;
  }
},

  async addElevenLabsVoice(name: string, description: string, files: string[], userId: string) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
    return { voice_id: "mock-saved-voice-id-" + Date.now() };
  }

  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    if (userId) {
      formData.append('labels', JSON.stringify({ userId }));
    }

    for (let i = 0; i < files.length; i++) {
      const dataUri = files[i];
      const matches = dataUri.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!matches) {
        throw new Error("Invalid file format");
      }
      const type = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const blob = new Blob([buffer], { type });
      formData.append('files', blob, `file-${i}.${type.split('/')[1]}`);
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenLabsApiKey.trim(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("[geminiService.addElevenLabsVoice] Error:", error);
    throw error;
  }
},

  async deleteElevenLabsVoice(voiceId: string) {
  const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenLabsApiKey || elevenLabsApiKey.trim() === "") {
    return { success: true };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': elevenLabsApiKey.trim(),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorBody}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[geminiService.deleteElevenLabsVoice] Error:", error);
    throw error;
  }
}
};

/**
 * Chuyển đổi PCM sang WAV 16-bit Mono (Pure JS/Node)
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitDepth: number = 16): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = numChannels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function estimateAudioDuration(text: string): number {
  return Math.max(1, Math.ceil(text.length / 13));
}

