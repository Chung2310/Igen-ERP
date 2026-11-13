import Joi from "joi";
import sharp from "sharp";
import type { AssistantIllustration } from "../../src/shared/assistant-document";
import { openrouterChat } from "../service/openrouter.service";
import { generateStudioImages, studioImageRatios } from "./studio-images";

export interface AssistantVisualRecommendation {
  shouldGenerate: boolean;
  prompt: string;
  alt: string;
  aspectRatio: (typeof studioImageRatios)[number];
}

const recommendationValidation = Joi.object({
  shouldGenerate: Joi.boolean().required(),
  prompt: Joi.string().trim().max(2000).allow("").required(),
  alt: Joi.string().trim().max(240).allow("").required(),
  aspectRatio: Joi.string().valid(...studioImageRatios).required(),
}).required();

const recommendationResponseSchema = {
  type: "object",
  required: ["shouldGenerate", "prompt", "alt", "aspectRatio"],
  properties: {
    shouldGenerate: { type: "boolean" },
    prompt: { type: "string", maxLength: 2000 },
    alt: { type: "string", maxLength: 240 },
    aspectRatio: { type: "string", enum: [...studioImageRatios] },
  },
  additionalProperties: false,
};

const recommendationSystemPrompt = `Bạn là AI phụ trách biên tập hình minh họa cho câu trả lời của trợ lý iGen ERP. Đọc câu hỏi và câu trả lời hoàn chỉnh rồi quyết định hình ảnh có giúp người dùng hiểu hoặc xem được kết quả họ yêu cầu hay không.

Chỉ tạo ảnh khi người dùng yêu cầu một sản phẩm thị giác hoặc khi hình minh họa sẽ làm rõ đáng kể các ý, mối quan hệ hay bước trong câu trả lời. Không tạo ảnh cho câu chào, câu trả lời ngắn, nội dung đã rõ bằng chữ, bảng số liệu, giá/tỷ giá, mã nguồn, thao tác ERP, hay tệp tài liệu. Nếu câu trả lời đã có ảnh phù hợp thì không tạo ảnh trùng lặp. Tôn trọng yêu cầu không dùng ảnh.

Nếu cần tạo, viết prompt hình ảnh cụ thể và trung thành với câu trả lời. Không thêm dữ kiện, con số, nhãn, tên riêng hoặc kết luận không có trong nội dung. Ưu tiên không có chữ trong ảnh, trừ khi người dùng yêu cầu chữ. Chọn tỷ lệ khung hình phù hợp với cách trình bày. alt phải ngắn gọn bằng tiếng Việt.

Trả về đúng JSON theo schema. Khi không tạo, đặt shouldGenerate=false và prompt, alt là chuỗi rỗng.`;

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return null;
  }
}

export async function recommendAssistantVisualCreation(input: {
  question: string;
  answer: string;
  illustrations?: AssistantIllustration[];
}): Promise<AssistantVisualRecommendation | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      openrouterChat({
        model: process.env.IGENAI_PROMPT_MODEL?.trim() || "google/gemma-4-31b-it:free",
        fallbackModel: process.env.IGENAI_PROMPT_FALLBACK_MODEL?.trim() || "qwen/qwen3.5-flash-02-23",
        temperature: 0,
        maxRetries: 1,
        jsonMode: true,
        responseSchema: recommendationResponseSchema,
        messages: [
          { role: "system", content: recommendationSystemPrompt },
          { role: "user", content: JSON.stringify({
            question: input.question.slice(0, 6000),
            answer: input.answer.slice(0, 8000),
            existingIllustrations: (input.illustrations || []).slice(0, 4).map(image => ({ alt: image.alt, sourceTitle: image.sourceTitle || "" })),
          }) },
        ],
      }),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Illustration recommendation timed out")), 8_000); }),
    ]);
    const { value, error } = recommendationValidation.validate(parseJsonObject(result.text), { abortEarly: false, convert: true, stripUnknown: true });
    if (error) return null;
    const recommendation = value as AssistantVisualRecommendation;
    if (recommendation.shouldGenerate && (!recommendation.prompt || !recommendation.alt)) return null;
    return recommendation;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function compactGeneratedImage(url: string) {
  const match = /^data:image\/([a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i.exec(url);
  if (!match) return url;
  const bytes = Buffer.from(match[2], "base64");
  const optimized = await sharp(bytes, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  if (!optimized.length || optimized.length > 1_050_000) {
    throw new Error("The generated illustration exceeded the conversation image limit.");
  }
  return `data:image/webp;base64,${optimized.toString("base64")}`;
}

export async function createAssistantVisualIllustration(recommendation: AssistantVisualRecommendation, referenceImage?: string): Promise<AssistantIllustration> {
  const generated = await generateStudioImages({
    prompt: recommendation.prompt,
    aspectRatio: recommendation.aspectRatio,
    count: 1,
    ...(referenceImage ? { referenceImage } : {}),
  });
  const firstImage = generated.images[0];
  if (!firstImage?.url || (!firstImage.url.startsWith("data:image/") && !/^https:\/\//i.test(firstImage.url))) {
    throw new Error("The image provider did not return a usable illustration.");
  }
  return {
    alt: recommendation.alt,
    url: await compactGeneratedImage(firstImage.url),
    generatedByAi: true,
  };
}
