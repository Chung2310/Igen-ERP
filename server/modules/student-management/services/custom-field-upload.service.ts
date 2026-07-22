import type { IFieldDefinition, ModuleKey } from "../interfaces/custom-field.interface";
import { cloudinary } from "../config/cloudinary";
import { CustomFieldDefinition } from "../models/custom-field-definition.model";

type UploadDefinitionRepository = {
  findOne(filter: Record<string, unknown>): PromiseLike<IFieldDefinition | null>;
};

type UploadedAsset = { secure_url: string; public_id: string };
type UploadAsset = (buffer: Buffer, folder: string) => Promise<UploadedAsset>;

export type CustomFieldUploadMetadata = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  reference: string;
};

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

export function detectUploadedMime(buffer: Buffer): string {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/x-ole-storage";
  if (!buffer.includes(0) && !buffer.toString("utf8").includes("\ufffd")) return "text/plain";
  return "application/octet-stream";
}

function mimeMatches(allowed: string, actual: string): boolean {
  if (allowed === actual) return true;
  if (allowed.endsWith("/*") && actual.startsWith(allowed.slice(0, -1))) return true;
  if (allowed === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && actual === "application/zip") return true;
  if (allowed === "application/msword" && actual === "application/x-ole-storage") return true;
  return false;
}

const defaultUploadAsset: UploadAsset = (buffer, folder) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({ folder, resource_type: "auto" }, (error, result) => {
    if (error || !result) reject(error ?? new Error("Không nhận được kết quả tải tệp."));
    else resolve({ secure_url: result.secure_url, public_id: result.public_id });
  });
  stream.end(buffer);
});

export class CustomFieldUploadService {
  constructor(
    private readonly definitions: UploadDefinitionRepository = CustomFieldDefinition as unknown as UploadDefinitionRepository,
    private readonly uploadAsset: UploadAsset = defaultUploadAsset,
  ) {}

  async upload(tenantId: string, moduleKey: ModuleKey, fieldId: string, file: Express.Multer.File): Promise<CustomFieldUploadMetadata> {
    const field = await this.definitions.findOne({
      _id: fieldId, tenantId, moduleKey, isArchived: false, isVisible: true,
      type: { $in: ["file", "image", "multiImage"] as string[] },
    });
    if (!field) throw Object.assign(new Error("Không tìm thấy trường tải tệp hợp lệ."), { status: 404 });
    if (!file?.buffer?.length) throw Object.assign(new Error("Tệp tải lên không hợp lệ."), { status: 400 });

    const size = file.buffer.length;
    const actualMime = detectUploadedMime(file.buffer);
    if (actualMime === "application/octet-stream") throw Object.assign(new Error("Không thể xác định định dạng thật của tệp."), { status: 400 });
    if (file.mimetype && file.mimetype !== "application/octet-stream" && !mimeMatches(file.mimetype, actualMime)) {
      throw Object.assign(new Error("Định dạng khai báo không khớp nội dung thật của tệp."), { status: 400 });
    }
    if (((field.type as string) === "image" || (field.type as string) === "multiImage") && !actualMime.startsWith("image/")) {
      throw Object.assign(new Error("Trường này chỉ chấp nhận tệp ảnh."), { status: 400 });
    }
    const validation = field.validation ?? {};
    const maxSizeMb = typeof validation.maxSizeMb === "number" ? validation.maxSizeMb : 100;
    if (size > maxSizeMb * 1024 * 1024) throw Object.assign(new Error(`Dung lượng tệp không được vượt quá ${maxSizeMb} MB.`), { status: 400 });
    const allowed = Array.isArray(validation.allowedMimeTypes) ? validation.allowedMimeTypes.filter((item): item is string => typeof item === "string") : [];
    if (allowed.length && !allowed.some(mime => mimeMatches(mime, actualMime))) {
      throw Object.assign(new Error("Định dạng thật của tệp không được phép."), { status: 400 });
    }

    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const asset = await this.uploadAsset(file.buffer, `student_management/custom-fields/${safeTenant}/${moduleKey}/${field.key}`);
    return {
      url: asset.secure_url,
      fileName: Buffer.from(file.originalname, "latin1").toString("utf8"),
      mimeType: actualMime,
      size,
      reference: asset.public_id,
    };
  }
}
