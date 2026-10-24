import { v2 as cloudinary } from "cloudinary";

const RULES = {
  video: { mimeTypes: ["video/mp4", "video/quicktime", "video/webm"], maxBytes: 200 * 1024 * 1024 },
  image: { mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"], maxBytes: 20 * 1024 * 1024 },
  audio: { mimeTypes: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/ogg"], maxBytes: 50 * 1024 * 1024 },
};

export class CampaignUploadError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}

export function getCampaignMediaUploadFolder(companyCode: string, userId: string) {
  if (!companyCode || !userId) throw new CampaignUploadError("Không xác định được doanh nghiệp hoặc người dùng.", 403);
  return `igen_erp/campaign-media/${Buffer.from(companyCode).toString("base64url")}/${encodeURIComponent(userId)}`;
}

/** Only sign server-owned upload parameters; never accept a client folder or transformation. */
export function signCampaignMediaUpload(input: Record<string, unknown>, companyCode: string, userId: string) {
  const mediaType = input.mediaType;
  if (mediaType !== "video" && mediaType !== "image" && mediaType !== "audio") {
    throw new CampaignUploadError("Loại media không hợp lệ.", 400);
  }
  const rule = RULES[mediaType];
  if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 255
    || typeof input.mimeType !== "string" || !rule.mimeTypes.includes(input.mimeType)
    || typeof input.fileSize !== "number" || !Number.isSafeInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > rule.maxBytes) {
    throw new CampaignUploadError("Định dạng hoặc kích thước media không hợp lệ.", 400);
  }
  const folder = getCampaignMediaUploadFolder(companyCode, userId);
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new CampaignUploadError("Chưa cấu hình dịch vụ upload media.", 503);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
  return { cloudName, apiKey, signature, timestamp, folder, resourceType: mediaType === "image" ? "image" : "video" };
}
