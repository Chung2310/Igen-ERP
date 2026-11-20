import { blogVisibilityFilter } from "./blog-blocks.service";
import { Types } from "mongoose";
import { BlogFileModel } from "../model/blog-file.model";
import { BlogPostModel } from "../model/blog-post.model";
import { cloudinaryService } from "./cloudinary.service";
const prefix = "/api/v1/blogs/files/";
const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });
export function blogFileId(url: string): string | null {
  const match = /^\/api\/v1\/blogs\/files\/([a-f0-9]{24})$/.exec(url);
  return match?.[1] || null;
}
export function serializeBlogAttachments(post: any) {
  const isPublic = post.attachmentsPublic === undefined || post.attachmentsPublic === true;
  return (post.attachments || []).map((attachment: any) => {
    const item = typeof attachment.toObject === "function" ? attachment.toObject() : attachment;
    const id = blogFileId(item.url);
    return { ...item, url: id ? prefix + id + "/preview" : item.url,
      shareUrl: isPublic ? item.url : undefined };
  });
}
export async function validateBlogFiles(user: any, attachments: { url: string }[]) {
  const ownerId = String(user?.id || user?._id || user?.uid || "");
  for (const item of attachments) {
    const id = blogFileId(item.url);
    if (!id) {
      // Existing clients can still attach their public HTTP files.
      if (!/^https?:\/\//i.test(item.url)) throw bad("Đường dẫn tệp không hợp lệ");
      continue;
    }
    if (!await BlogFileModel.exists({ _id: id, ownerId })) throw bad("Bạn không có quyền sử dụng tệp này", 403);
  }
}
export async function uploadBlogFile(user: any, input: any) {
  const ownerId = String(user?.id || user?._id || user?.uid || "");
  if (!ownerId) throw bad("Vui lòng đăng nhập", 401);
  const match = typeof input.file === "string" && /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(input.file);
  if (!match || match[2].length > 28 * 1024 * 1024) throw bad("Tệp không hợp lệ hoặc vượt quá 20 MB");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw bad("Tệp không hợp lệ hoặc vượt quá 20 MB");
  const name = String(input.fileName || "file").replace(/[\r\n\/\\]/g, "_").slice(0, 255);
  const id = new Types.ObjectId();
  const asset = await cloudinaryService.uploadPrivateRaw(buffer, "igen_erp/blog", String(id));
  try {
    await BlogFileModel.create({ _id: id, ownerId, publicId: asset.publicId, name, mimeType: match[1], size: buffer.length });
  } catch (error) { await cloudinaryService.deleteRawAsset(asset.publicId).catch(() => {}); throw error; }
  return { url: prefix + id, size: buffer.length };
}
export async function openBlogFile(id: string, preview: boolean, userId?: string) {
  if (!Types.ObjectId.isValid(id)) throw bad("Không tìm thấy tệp", 404);
  const post = await BlogPostModel.findOne({ isDeleted: false, "attachments.url": prefix + id,
    ...(preview ? await blogVisibilityFilter(userId) : { $or: [{ attachmentsPublic: true }, { attachmentsPublic: { $exists: false } }] }),
  }).lean();
  if (!post) throw bad("Tệp không công khai hoặc không còn tồn tại", 403);
  const file = await BlogFileModel.findById(id).lean();
  if (!file) throw bad("Không tìm thấy tệp", 404);
  // Signed origin URL stays on the server; clients receive only the proxy response.
  const url = cloudinaryService.createSignedRawUrl(file.publicId, new Date(Date.now() + 60000));
  const upstream = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!upstream.ok) throw bad("Không thể đọc tệp từ kho lưu trữ", 502);
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024) throw bad("Tệp vượt quá dung lượng cho phép", 413);
  return { file, bytes };
}
