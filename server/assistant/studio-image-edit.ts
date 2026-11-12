import sharp from "sharp";
import { openrouterGenerateImage } from "../service/openrouter.service";
import { AssistantError } from "./policy";

export const studioEditModes = ["custom", "erase", "remove-background", "change-background", "enhance"] as const;
export type StudioEditMode = (typeof studioEditModes)[number];
export type StudioEditRegion = { x: number; y: number; width: number; height: number };
export type StudioEditInput = {
  sourceImage: string;
  prompt: string;
  mode: StudioEditMode;
  region?: StudioEditRegion;
};

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function decodeImage(value: string, maxBytes: number): Buffer {
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) throw new AssistantError("Chọn ảnh PNG, JPG hoặc WebP hợp lệ.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new AssistantError("Ảnh tải lên không được vượt quá 15 MB.");
  return bytes;
}

export function buildStudioEditPrompt(mode: StudioEditMode, request: string, isLocalEdit: boolean): string {
  const actions: Record<StudioEditMode, string> = {
    custom: "Thực hiện đúng thay đổi được yêu cầu.",
    erase: "Xóa đúng đối tượng hoặc chi tiết được nêu, rồi lấp vùng trống tự nhiên theo các chi tiết kề bên.",
    "remove-background": "Tách chủ thể khỏi nền; tạo nền trong suốt nếu model hỗ trợ. Giữ nguyên chủ thể và các cạnh tự nhiên.",
    "change-background": "Chỉ thay đổi nền theo yêu cầu. Giữ nguyên chủ thể, khuôn mặt, tóc, quần áo và tư thế.",
    enhance: "Cải thiện độ rõ và chất lượng theo yêu cầu mà không thay đổi nội dung ảnh.",
  };
  const action = actions[mode];
  const boundary = isLocalEdit
    ? "Ảnh đầu vào là vùng người dùng đã chọn. Chỉ thay đổi chi tiết được mô tả bên trong vùng này; giữ nguyên mọi khuôn mặt, nét nhận dạng, người, đồ vật, ánh sáng và bối cảnh còn lại ngay cả khi chúng xuất hiện trong vùng chọn. Không thêm viền, chú thích hoặc bố cục mới."
    : "Chỉ thay đổi phần được người dùng mô tả. Giữ nguyên mọi phần khác của ảnh gốc: khuôn mặt, nét nhận dạng, tư thế, bối cảnh, bố cục, ánh sáng, màu sắc và chữ/logo không được yêu cầu sửa. Không vẽ lại toàn cảnh.";
  return `Chỉnh sửa ẢNH GỐC được đính kèm, không tạo một cảnh mới. ${action}\nYêu cầu của người dùng: ${request.trim()}\n${boundary}\nTrả về duy nhất ảnh đã chỉnh sửa.`;
}

function pixelRegion(region: StudioEditRegion, imageWidth: number, imageHeight: number) {
  const left = Math.max(0, Math.min(imageWidth - 1, Math.floor(region.x * imageWidth)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.floor(region.y * imageHeight)));
  const width = Math.min(imageWidth - left, Math.max(1, Math.ceil(region.width * imageWidth)));
  const height = Math.min(imageHeight - top, Math.max(1, Math.ceil(region.height * imageHeight)));
  if (width < 16 || height < 16) throw new AssistantError("Vùng chỉnh sửa cần rộng và cao ít nhất 16 pixel.");
  return { left, top, width, height };
}

export async function editStudioImage(input: StudioEditInput): Promise<{ image: { url: string }; model: "iGenAI"; regionApplied: boolean }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new AssistantError("Chưa cấu hình OPENROUTER_API_KEY trên máy chủ.", 503);
  const sourceBytes = decodeImage(input.sourceImage, MAX_SOURCE_BYTES);
  let source: Buffer | undefined;
  let imageWidth = 0;
  let imageHeight = 0;
  try {
    const decoder = sharp(sourceBytes, { limitInputPixels: MAX_PIXELS });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height) throw new Error("Missing dimensions");
    if (input.region) {
      source = await decoder.rotate().png().toBuffer();
      const oriented = await sharp(source).metadata();
      imageWidth = oriented.width || 0;
      imageHeight = oriented.height || 0;
    }
  } catch {
    throw new AssistantError("Không thể đọc ảnh. Hãy chọn ảnh PNG, JPG hoặc WebP tối đa 40 megapixel.");
  }

  let reference = input.sourceImage;
  let target: ReturnType<typeof pixelRegion> | undefined;
  if (input.region && source) {
    target = pixelRegion(input.region, imageWidth, imageHeight);
    const cropped = await sharp(source).extract(target).resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    reference = `data:image/png;base64,${cropped.toString("base64")}`;
  }

  try {
    const result = await openrouterGenerateImage({
      model: process.env.IGENAI_IMAGE_EDIT_MODEL?.trim() || "google/gemini-3.1-flash-lite-image",
      prompt: buildStudioEditPrompt(input.mode, input.prompt, Boolean(target)),
      referenceImages: [reference],
      preserveInputAspectRatio: true,
      allowFallback: false,
    });
    if (!target) {
      if (!IMAGE_DATA_URL.test(result.url)) throw new Error("Invalid image response");
      return { image: { url: result.url }, model: "iGenAI", regionApplied: false };
    }
    // Ghép lại trên máy chủ để mọi pixel ngoài vùng chọn không bị model thay đổi.
    if (!source) throw new Error("Missing source image for local edit");
    const editedBytes = decodeImage(result.url, 30 * 1024 * 1024);
    const patch = await sharp(editedBytes, { limitInputPixels: MAX_PIXELS }).resize(target.width, target.height, { fit: "fill" }).png().toBuffer();
    const combined = await sharp(source).composite([{ input: patch, left: target.left, top: target.top }]).png().toBuffer();
    return { image: { url: `data:image/png;base64,${combined.toString("base64")}` }, model: "iGenAI", regionApplied: true };
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    const status = (error as { status?: number }).status;
    const message = status === 401 ? "Khóa OpenRouter không hợp lệ."
      : status === 402 ? "Tài khoản OpenRouter không đủ số dư để sửa ảnh."
      : status === 429 ? "OpenRouter đang giới hạn yêu cầu. Vui lòng thử lại sau."
      : "Không thể chỉnh sửa ảnh lúc này. Vui lòng thử lại.";
    throw new AssistantError(message, status === 429 ? 429 : 502);
  }
}
