import { ObjectId } from "mongodb";
import sharp from "sharp";
import AdmZip from "adm-zip";
import sanitizeHtml from "sanitize-html";
import { cloudinary } from "../../config/cloudinary";
import { withAiUsage } from "../../service/ai-usage.service";
import { geminiImageService } from "../marketing-suite/shared/service/gemini/image.service";
import { ValidationError } from "../../errors/app-error";
import { assertGymAdmin, tenantFilter, type GymActor } from "./access";
import { getRecord, publicRecord, records, saveRecord } from "./store";
import { publishKnowledge } from "./operations";

export async function uploadTrainerAvatar(actor: GymActor, file?: Express.Multer.File) {
  assertGymAdmin(actor);
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) || file.size > 5 * 1024 * 1024)
    throw new ValidationError("VALIDATION_FAILED", "Chỉ nhận ảnh JPG, PNG hoặc WebP tối đa 5 MB.");
  const buffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 }).rotate().resize(600, 600, { fit: "cover" }).webp().toBuffer();
  const avatarUrl = await new Promise<string>((resolve, reject) =>
    cloudinary.uploader.upload_stream(
      { folder: `erp/gym/${actor.companyCode}/${actor.branchId}/trainers`, resource_type: "image" },
      (error, result) => error || !result ? reject(error || new Error("Không tải được ảnh đại diện.")) : resolve(result.secure_url),
    ).end(buffer),
  );
  return { avatarUrl };
}

export async function uploadSessionPhoto(actor: GymActor, customerId: string, file?: Express.Multer.File) {
  await getRecord(actor, "customers", customerId);
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) || file.size > 5 * 1024 * 1024)
    throw new ValidationError("VALIDATION_FAILED", "Chỉ nhận ảnh JPG, PNG hoặc WebP tối đa 5 MB.");
  const buffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp()
    .toBuffer();
  const photoUrl = await new Promise<string>((resolve, reject) =>
    cloudinary.uploader.upload_stream(
      { folder: `erp/gym/${actor.companyCode}/${actor.branchId}/progress`, resource_type: "image" },
      (error, result) => error || !result ? reject(error || new Error("Không tải được ảnh.")) : resolve(result.secure_url),
    ).end(buffer),
  );
  return { photoUrl };
}
import { validateInput } from "./validation";

export async function saveImage(
  actor: GymActor,
  input: unknown,
  file?: Express.Multer.File,
  generate = false,
) {
  const value = validateInput("food-images", input);
  let url: string;
  if (generate) {
    const result = await withAiUsage(
      { companyCode: actor.companyCode, userId: actor.userId },
      () =>
        geminiImageService.generateImage(
          `Ảnh món ăn Việt Nam chân thực: ${value.name}. Chụp ảnh thực phẩm, ánh sáng tự nhiên, không chữ, không logo.`,
          { aspectRatio: "1:1" },
        ),
    );
    if (result.isMock) throw new Error("Không tạo được ảnh món ăn.");
    url = result.url;
  } else {
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
    )
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Vui lòng chọn ảnh JPG, PNG hoặc WebP.",
      );
    const buffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();
    url = await new Promise<string>((resolve, reject) =>
      cloudinary.uploader
        .upload_stream(
          {
            folder: `erp/gym/${actor.companyCode}/${actor.branchId}`,
            resource_type: "image",
          },
          (error, result) =>
            error || !result
              ? reject(error || new Error("Không tải được ảnh."))
              : resolve(result.secure_url),
        )
        .end(buffer),
    );
  }
  const now = new Date().toISOString();
  const item = {
    ...value,
    _id: new ObjectId().toHexString(),
    ...tenantFilter(actor),
    imageUrl: url,
    source: generate ? "AI" : "UPLOAD",
    revision: 1,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
  };
  await records("food-images").insertOne(item);
  return publicRecord(item);
}

export async function updateFoodImageWithUpload(
  actor: GymActor,
  id: string,
  input: unknown,
  file?: Express.Multer.File,
) {
  const existing = await getRecord(actor, "food-images", id);
  const value = validateInput("food-images", {
    ...existing,
    ...(typeof input === "object" && input ? input : {}),
  });
  let url = existing.imageUrl || "";
  if (file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Vui lòng chọn ảnh JPG, PNG hoặc WebP.",
      );
    }
    const buffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toBuffer();
    url = await new Promise<string>((resolve, reject) =>
      cloudinary.uploader
        .upload_stream(
          {
            folder: `erp/gym/${actor.companyCode}/${actor.branchId}`,
            resource_type: "image",
          },
          (error, result) =>
            error || !result
              ? reject(error || new Error("Không tải được ảnh."))
              : resolve(result.secure_url),
        )
        .end(buffer),
    );
  }
  const now = new Date().toISOString();
  const updated = await records("food-images").findOneAndUpdate(
    { ...tenantFilter(actor), _id: existing._id },
    {
      $set: {
        ...value,
        imageUrl: url,
        source: file ? "UPLOAD" : value.source || existing.source || "UPLOAD",
        updatedAt: now,
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  return publicRecord(updated || existing);
}

export async function regenerateFoodImageAi(
  actor: GymActor,
  id: string,
  prompt?: string,
) {
  const existing = await getRecord(actor, "food-images", id);
  const customPrompt = String(prompt || existing.prompt || "").trim();
  const fullPrompt = customPrompt
    ? `${customPrompt}. Món ăn: ${existing.name}. Chụp ảnh thực phẩm chân thực, ánh sáng tự nhiên, không chữ, không logo.`
    : `Ảnh món ăn Việt Nam chân thực: ${existing.name}. Chụp ảnh thực phẩm, ánh sáng tự nhiên, không chữ, không logo.`;
  const result = await withAiUsage(
    { companyCode: actor.companyCode, userId: actor.userId },
    () => geminiImageService.generateImage(fullPrompt, { aspectRatio: "4:3" }),
  );
  if (result.isMock) throw new Error("Không tạo được ảnh món ăn.");
  const now = new Date().toISOString();
  const updated = await records("food-images").findOneAndUpdate(
    { ...tenantFilter(actor), _id: existing._id },
    {
      $set: {
        imageUrl: result.url,
        source: "AI",
        ...(customPrompt ? { prompt: customPrompt } : {}),
        updatedAt: now,
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  return publicRecord(updated || existing);
}
export async function uploadKnowledge(
  actor: GymActor,
  file: Express.Multer.File | undefined,
  topic: string,
) {
  assertGymAdmin(actor);
  if (!file)
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng chọn tài liệu để tải lên.",
    );
  let content: string;
  if (
    /\.pdf$/i.test(file.originalname) &&
    file.buffer.subarray(0, 5).toString() === "%PDF-"
  ) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: file.buffer });
    try {
      content = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else if (/\.docx$/i.test(file.originalname)) {
    const entry = new AdmZip(file.buffer).getEntry("word/document.xml");
    if (!entry || entry.header.size > 5 * 1024 * 1024)
      throw new ValidationError(
        "VALIDATION_FAILED",
        "Tài liệu Word không hợp lệ hoặc quá lớn.",
      );
    content = sanitizeHtml(
      entry
        .getData()
        .toString("utf8")
        .replace(/<\/w:p>/g, "\n"),
      { allowedTags: [], allowedAttributes: {} },
    );
  } else if (/\.(txt|md|markdown)$/i.test(file.originalname))
    content = file.buffer.toString("utf8");
  else
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Vui lòng chọn tài liệu PDF, DOCX, TXT hoặc Markdown.",
    );
  if (!content.trim())
    throw new ValidationError(
      "VALIDATION_FAILED",
      "Tài liệu không có nội dung văn bản. Vui lòng nhập nội dung thủ công.",
    );
  const draft = await saveRecord(actor, "knowledge", {
    title: file.originalname.replace(/\.[^.]+$/, ""),
    topic: topic || "Chung",
    content,
  });
  return publishKnowledge(actor, draft._id, draft.revision, true);
}
