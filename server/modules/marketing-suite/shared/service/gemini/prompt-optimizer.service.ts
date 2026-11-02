/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  GEMINI_TEXT_MODEL,
  generateText,
  safeParseJson,
} from "./core";

export class GeminiPromptOptimizerService {
  /**
   * Tối ưu kịch bản giọng nói
   */
  async optimizeScript(text: string, readingStyle: string, model?: string) {
    if (!process.env.OPENROUTER_API_KEY) {
      return { optimizedText: `[Tối ưu hóa Giả lập] ${text}` };
    }
    try {
      const systemInstruction = `Bạn là một chuyên gia biên soạn kịch bản và phát thanh viên chuyên nghiệp của Đài Tiếng Nói Việt Nam (VOV).
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
  }

  /**
   * Tối ưu prompt hình ảnh (cấu trúc JSON)
   */
  async optimizeImagePrompt(description: string, imageUris?: string[], modelName?: string) {
    const normalizedDescription = String(description || "").trim();

    const getMockImagePrompt = () => {
      const wantsGraphicLayout = /\b(banner|poster|advertisement|ad creative|cover|thumbnail|flyer|social post)\b/i.test(normalizedDescription)
        || /(banner|áp phích|poster|quảng cáo|giới thiệu|mặt hàng|bìa|thumbnail|tờ rơi|bài đăng)/i.test(normalizedDescription);
      const optimizedPrompt = wantsGraphicLayout
        ? `A professional commercial banner design that faithfully represents this exact brief: ${normalizedDescription || "the provided concept"}. Use a clear hero product or subject, designed background, headline area, subheadline area, CTA button area, brand/logo placeholder, clean typography, safe margins, and negative space for readable Vietnamese text. Do not make it a plain product photo.`
        : `A precise visual that faithfully represents this exact marketing or business concept: ${normalizedDescription || "the provided concept"}`;

      return {
        subject: normalizedDescription || "image concept",
        clothing_material: "",
        action_pose: "",
        setting_lighting: "",
        camera_parameters: "",
        optimized_english_prompt: optimizedPrompt,
        negative_prompt: "ugly, blurry, low quality",
        isLocalFallback: true,
      };
    };

    if (!normalizedDescription) {
      return getMockImagePrompt();
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return getMockImagePrompt();
    }

    try {
      const optimizeMessages: any[] = [
        {
          role: "system",
          content: `You are an expert prompt engineer for image generators. Optimize the user's image description into a high-quality, descriptive English prompt.
Preserve the exact business topic, audience, use-case, and key message from the user's input.
Do not convert a concrete brief into a generic product shot, generic lifestyle image, abstract office scene, or unrelated beauty visual.
Respect the requested media format. If the user asks for a banner, poster, ad creative, cover, thumbnail, flyer, or social post, the optimized prompt MUST describe a designed commercial graphic layout, not just a realistic product/photo scene.
For banner/ad/poster/social creative requests, include a clear hero subject, intentional composition, designed background, headline area, subheadline area, CTA/button area, brand/logo placeholder if no brand is provided, clean typography, safe margins, and enough negative space for readable text.
For product or shop introduction banners, show the product assortment as the hero visual but frame it as a promotional banner design with text zones and CTA, not plain documentary product photography.
Only choose a pure photo/lifestyle scene when the user explicitly requests a photo, realistic scene, or workplace/lifestyle image.
If the prompt is about software, ecommerce, omnichannel, logistics, operations, training, consulting, customer growth, or workflow, explicitly visualize that real context.
Translate faithfully from Vietnamese to English when needed. Semantic fidelity is more important than creative embellishment.
Do not introduce new objects, characters, industries, locations, demographics, props, outfits, or claims unless they are explicitly grounded in the source input or attached references.
When source files or images are provided, use them as constraints and preserve the same meaning as closely as possible.
Treat a request to rotate, change the camera angle/view, reposition, retouch, remove, or replace an element as a constrained image edit only when the user explicitly selects WORKFLOW MODE: IMAGE EDIT, or when no workflow mode is supplied. In IMAGE EDIT mode, keep every unmentioned element unchanged. Do not add text, a banner layout, logos, CTA buttons, accessories, props, or extra subjects. For example, a request for a side view must explicitly require a true direct side-profile view, not a three-quarter view.
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
      const workflowMode = /WORKFLOW MODE:\s*IMAGE EDIT/i.test(normalizedDescription)
        ? "edit"
        : /WORKFLOW MODE:\s*IMAGE COMPOSITION/i.test(normalizedDescription)
          ? "compose"
          : /WORKFLOW MODE:\s*CREATE FROM PROMPT/i.test(normalizedDescription)
            ? "prompt"
            : null;
      const workflowInstruction = workflowMode === "edit"
        ? " The selected workflow is IMAGE EDIT. Reference image 1 is the source image to preserve. Any later references are supporting examples for the requested angle, style, composition, or detail; use only relevant traits, never replace the source subject, and do not make a collage. Describe only the requested change."
        : workflowMode === "compose"
          ? " The selected workflow is IMAGE COMPOSITION. Combine the references according to the user's explicit prompt. Use displayed order only as a positional cue and infer each image's role from the prompt and visual content; do not impose fixed background, subject, or logo roles."
          : workflowMode === "prompt"
            ? " The selected workflow is CREATE FROM PROMPT. Create from the text; references are visual inspiration only and must not be treated as source assets to preserve or combine unless the user explicitly says so."
            : "";
      const referenceRoleInstruction = (workflowMode === "compose" || (!workflowMode && (imageUris?.length || 0) >= 2))
        ? " Unless the user's brief explicitly assigns roles differently, reference images are ordered: image 1 is the background/template, image 2 is the hero product or subject to preserve, and image 3 (if present) is a logo or secondary asset. Write a composition prompt that keeps those roles distinct and makes the integration natural."
        : "";
      const userText = `Translate and optimize this media brief into English while preserving the exact topic, context, audience, business meaning, and factual constraints from the original input: ${normalizedDescription}.${workflowInstruction}${referenceRoleInstruction}`;
      const result = await generateText(modelName || GEMINI_TEXT_MODEL, userText, {
        systemInstruction: systemMessage,
        responseMimeType: "application/json",
        images: imageUris?.filter((u: string) => u && typeof u === "string"),
        maxTokens: 4_096,
        maxRetries: 1,
        fallbackMaxRetries: 1,
        fallbackModel:
          process.env.IMAGE_PROMPT_FALLBACK_MODEL ||
          "google/gemini-2.5-flash",
      });
      const parsed = safeParseJson(result.text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...parsed, isLocalFallback: false }
        : parsed;
    } catch (error: any) {
      console.error("[geminiService.optimizeImagePrompt] Gemini Error, fallback to local optimizer:", error);
      return getMockImagePrompt();
    }
  }

  /**
   * Tối ưu prompt video (cấu trúc JSON)
   */

  async extractTextFromPdf(base64Pdf: string): Promise<string> {
    try {
      const response = await generateText(GEMINI_TEXT_MODEL, [
        {
          role: "user",
          parts: [
            { text: "Extract and write down all readable text and data from this PDF file. Keep the formatting as clear and structured as possible." },
            { inlineData: { mimeType: "application/pdf", data: base64Pdf } }
          ]
        }
      ]);
      return response.text || "";
    } catch (error) {
      console.error("[geminiService.extractTextFromPdf] Error extracting PDF text:", error);
      throw error;
    }
  }
}

export const geminiPromptOptimizerService = new GeminiPromptOptimizerService();
