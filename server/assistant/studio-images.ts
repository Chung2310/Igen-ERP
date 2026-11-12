import { openrouterChat, openrouterGenerateImage } from "../service/openrouter.service";
import { AssistantError } from "./policy";
import { STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE, studioImageSystemError } from "./studio-image-errors";

const DEFAULT_STUDIO_IMAGE_PROVIDER_MODEL = "recraft/recraft-v4.1-flash";

export const studioImageRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;

export type StudioImageInput = {
  prompt: string;
  aspectRatio: (typeof studioImageRatios)[number];
  count: number;
  referenceImage?: string;
};

export async function enhanceStudioImagePrompt(prompt: string): Promise<{ prompt: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new AssistantError(STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE, 503);
  }
  try {
    const response = await openrouterChat({
      model: process.env.IGENAI_PROMPT_MODEL?.trim() || "google/gemma-4-31b-it:free",
      fallbackModel: process.env.IGENAI_PROMPT_FALLBACK_MODEL?.trim() || "qwen/qwen3.5-flash-02-23",
      temperature: 0.3,
      maxRetries: 1,
      messages: [
        { role: "system", content: "Bạn là biên tập viên prompt tạo ảnh. Viết lại yêu cầu thành một prompt ngắn, rõ và có thể dùng ngay: nêu chủ thể chính, hành động hoặc đặc điểm quan trọng, bối cảnh, bố cục và ánh sáng theo đúng những gì người dùng cung cấp. Sắp xếp chi tiết theo thứ tự dễ hình dung; diễn đạt trung tính khi cần nối ý. Giữ nguyên ngôn ngữ, chữ cần xuất hiện trong ảnh, tên riêng, màu sắc, số lượng, tỷ lệ và mọi điều cấm hoặc yêu cầu giữ nguyên. Không thêm người, vật, logo, thương hiệu, địa điểm, phong cách, góc máy hay chi tiết mới khi người dùng chưa nêu. Nếu yêu cầu đã rõ, chỉ sửa câu chữ. Chỉ trả một đoạn prompt hoàn chỉnh, không tiêu đề, giải thích hoặc Markdown." },
        { role: "user", content: prompt.trim() },
      ],
    });
    const enhanced = response.text.trim();
    if (!enhanced || enhanced.length > 2000) throw new Error("Invalid enhanced prompt");
    return { prompt: enhanced };
  } catch (error) {
    throw studioImageSystemError(error);
  }
}

export async function generateStudioImages(input: StudioImageInput) {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new AssistantError(STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE, 503);
  }
  if (input.referenceImage) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.referenceImage);
    if (!match || Buffer.byteLength(match[2], "base64") > 4 * 1024 * 1024) {
      throw new AssistantError("Ảnh tham chiếu phải là PNG, JPG hoặc WebP và không quá 4 MB.");
    }
  }

  const prompt = input.referenceImage && !/ảnh (gốc|đính kèm|tham chiếu)/i.test(input.prompt)
    ? `Dựa trên ảnh tham chiếu được đính kèm, giữ lại đặc điểm nhận diện của chủ thể/sản phẩm/khuôn mặt trong ảnh đó và tạo ảnh mới theo yêu cầu: ${input.prompt}`
    : input.prompt;

  const images: { url: string }[] = [];
  let warning: string | undefined;
  for (let index = 0; index < input.count; index += 1) {
    try {
      const result = await openrouterGenerateImage({
        prompt,
        model: input.referenceImage
          ? (process.env.IGENAI_IMAGE_EDIT_MODEL?.trim() || "google/gemini-3.1-flash-image")
          : (process.env.IGENAI_IMAGE_MODEL?.trim() || DEFAULT_STUDIO_IMAGE_PROVIDER_MODEL),
        aspectRatio: input.aspectRatio,
        referenceImages: input.referenceImage ? [input.referenceImage] : undefined,
        allowFallback: false,
      });
      if (!result.url.startsWith("data:image/") && !/^https:\/\//.test(result.url)) {
        throw new Error("OpenRouter trả về đường dẫn ảnh không hợp lệ.");
      }
      images.push({ url: result.url });
    } catch (error) {
      if (images.length === 0) throw studioImageSystemError(error);
      warning = `Đã tạo ${images.length}/${input.count} ảnh. ${STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE}`;
      break;
    }
  }
  return { images, model: "iGenAI", aspectRatio: input.aspectRatio, ...(warning ? { warning } : {}) };
}
