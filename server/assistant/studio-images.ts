import { openrouterChat, openrouterGenerateImage } from "../service/openrouter.service";
import { AssistantError } from "./policy";

const DEFAULT_STUDIO_IMAGE_PROVIDER_MODEL = "google/gemini-3.1-flash-image";

export const studioImageRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;

export type StudioImageInput = {
  prompt: string;
  aspectRatio: (typeof studioImageRatios)[number];
  count: number;
  referenceImage?: string;
};

export async function enhanceStudioImagePrompt(prompt: string): Promise<{ prompt: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  }
  try {
    const response = await openrouterChat({
      model: process.env.OPENROUTER_TEXT_MODEL?.trim() || "google/gemini-2.5-flash",
      temperature: 0.3,
      maxRetries: 1,
      messages: [
        { role: "system", content: "Bạn hỗ trợ viết mô tả cho công cụ tạo hình ảnh. Viết lại mô tả của người dùng rõ ràng và cụ thể hơn về chủ thể, bối cảnh, bố cục hoặc ánh sáng khi những chi tiết đó đã được nêu hoặc có thể diễn đạt trung tính. Giữ nguyên ngôn ngữ, ý định, các chi tiết và ràng buộc đã có. Không tự thêm nhân vật, đồ vật, chữ, logo, thương hiệu, địa điểm hay phong cách chưa được yêu cầu. Nếu mô tả đã đủ rõ, chỉ chỉnh câu chữ nhẹ. Chỉ trả về một đoạn prompt hoàn chỉnh, không tiêu đề, không giải thích, không Markdown." },
        { role: "user", content: prompt.trim() },
      ],
    });
    const enhanced = response.text.trim();
    if (!enhanced || enhanced.length > 2000) throw new Error("Invalid enhanced prompt");
    return { prompt: enhanced };
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = status === 401 ? "Khóa OpenRouter không hợp lệ."
      : status === 402 ? "Tài khoản OpenRouter không đủ số dư để chuẩn hóa mô tả."
      : status === 429 ? "OpenRouter đang giới hạn yêu cầu. Vui lòng thử lại sau."
      : "Không thể chuẩn hóa mô tả lúc này. Vui lòng thử lại.";
    throw new AssistantError(message, status === 429 ? 429 : 502);
  }
}

export async function generateStudioImages(input: StudioImageInput) {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  }
  if (input.referenceImage) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.referenceImage);
    if (!match || Buffer.byteLength(match[2], "base64") > 4 * 1024 * 1024) {
      throw new AssistantError("Ảnh tham chiếu phải là PNG, JPG hoặc WebP và không quá 4 MB.");
    }
  }

  const images: { url: string }[] = [];
  let warning: string | undefined;
  for (let index = 0; index < input.count; index += 1) {
    try {
      const result = await openrouterGenerateImage({
        prompt: input.prompt,
        model: process.env.IGENAI_IMAGE_MODEL?.trim() || DEFAULT_STUDIO_IMAGE_PROVIDER_MODEL,
        aspectRatio: input.aspectRatio,
        referenceImages: input.referenceImage ? [input.referenceImage] : undefined,
        allowFallback: false,
      });
      if (!result.url.startsWith("data:image/") && !/^https:\/\//.test(result.url)) {
        throw new Error("OpenRouter trả về đường dẫn ảnh không hợp lệ.");
      }
      images.push({ url: result.url });
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = status === 401 ? "Khóa OpenRouter không hợp lệ."
        : status === 402 ? "Tài khoản OpenRouter không đủ số dư để tạo ảnh."
        : status === 429 ? "OpenRouter đang giới hạn yêu cầu. Vui lòng thử lại sau."
        : "Không thể tạo ảnh lúc này. Vui lòng thử lại sau.";
      if (images.length === 0) throw new AssistantError(message, status === 429 ? 429 : 502);
      warning = `Đã tạo ${images.length}/${input.count} ảnh. ${message}`;
      break;
    }
  }
  return { images, model: "iGenAI", aspectRatio: input.aspectRatio, ...(warning ? { warning } : {}) };
}
