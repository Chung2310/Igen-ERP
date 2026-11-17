import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { ConflictError } from "../../errors/app-error";
import { downloadCompanyFile, uploadCompanyFile } from "../quotation/cloudinary";
import { config } from "../quotation/config.js";
import type { ArchitectureRenderAsset } from "../../../src/shared/architecture-assistant";
import type { ArchitectureActor } from "./scope";

export type StoredArchitectureAsset = ArchitectureRenderAsset & { storageAssetId: string };

function decodeImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error("Ảnh tạo được không đúng định dạng.");
  return { mimeType: match[1].toLowerCase(), bytes: Buffer.from(match[2], "base64") };
}

async function readProviderImage(url: string) {
  if (url.startsWith("data:")) return decodeImageDataUrl(url);
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("Dịch vụ tạo ảnh trả về đường dẫn không hợp lệ."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hostname === "localhost" || isIP(parsed.hostname)) {
    throw new Error("Dịch vụ tạo ảnh trả về đường dẫn không an toàn.");
  }
  const response = await fetch(parsed, { signal: AbortSignal.timeout(45_000), redirect: "error" });
  if (!response.ok) throw new Error("Không tải được ảnh do dịch vụ AI tạo.");
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("Dịch vụ tạo ảnh trả về loại tệp không được hỗ trợ.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new Error("Ảnh tạo được rỗng hoặc vượt quá 12 MB.");
  return { mimeType, bytes };
}

export async function storeArchitectureImage(
  url: string,
  actor: ArchitectureActor,
  model: string,
  kind: NonNullable<ArchitectureRenderAsset["kind"]> = "render",
  prompt = "",
): Promise<StoredArchitectureAsset> {
  if (!config.cloudinaryConfigured) throw new ConflictError("CONFLICT", "ERP chưa cấu hình kho ảnh Cloudinary.");
  const { bytes, mimeType } = await readProviderImage(url);
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
  const uploaded = await uploadCompanyFile(
    bytes,
    `phoi-canh-${randomUUID()}.${extension}`,
    mimeType,
    actor.companyCode,
    config.cloudinary,
    `igen-erp/architect-assistant/${actor.companyCode}/${actor.branchId}`,
  );
  return {
    id: randomUUID(),
    storageAssetId: uploaded.assetId,
    filename: `Phối cảnh kiến trúc.${extension}`,
    mimeType: mimeType as ArchitectureRenderAsset["mimeType"],
    bytes: bytes.length,
    model,
    createdAt: new Date().toISOString(),
    kind,
    prompt: prompt.slice(0, 1200),
  };
}

export async function storeArchitectureVideo(bytes: Buffer, actor: ArchitectureActor, model: string, prompt: string): Promise<StoredArchitectureAsset> {
  if (!config.cloudinaryConfigured) throw new ConflictError("CONFLICT", "ERP chÆ°a cáº¥u hÃ¬nh kho áº£nh Cloudinary.");
  if (!bytes.length || bytes.length > 120 * 1024 * 1024) throw new Error("Video rá»—ng hoáº·c vÆ°á»£t quÃ¡ 120 MB.");
  const uploaded = await uploadCompanyFile(
    bytes,
    `video-kien-truc-${randomUUID()}.mp4`,
    "video/mp4",
    actor.companyCode,
    config.cloudinary,
    `igen-erp/architect-assistant/${actor.companyCode}/${actor.branchId}`,
  );
  return {
    id: randomUUID(),
    storageAssetId: uploaded.assetId,
    filename: "Video-kien-truc.mp4",
    mimeType: "video/mp4",
    bytes: bytes.length,
    model,
    createdAt: new Date().toISOString(),
    kind: "video",
    prompt: prompt.slice(0, 1200),
  };
}

export async function downloadArchitectureImage(asset: StoredArchitectureAsset) {
  return downloadCompanyFile(asset.storageAssetId, config.cloudinary);
}
