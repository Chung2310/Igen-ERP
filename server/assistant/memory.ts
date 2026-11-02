import type { AuthenticatedRequest } from "../middleware/auth";
import { AssistantMemoryModel, ensureAssistantIndexes } from "./models";
import { actorScope } from "./workflows";
import { AssistantError } from "./policy";

export const MAX_ASSISTANT_MEMORIES = 50;
export const MAX_ASSISTANT_MEMORY_LENGTH = 300;
const MAX_PROMPT_MEMORY_ITEMS = 10;
const MAX_PROMPT_MEMORY_CHARS = 1_600;

export interface AssistantMemoryItem {
  id: string;
  content: string;
  source: "explicit" | "manual" | "automatic";
  createdAt: string;
  updatedAt: string;
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
}

function normalizedKey(value: string) {
  return normalizedText(value).replace(/[.!?;:,]+$/g, "").replace(/\s+/g, " ").trim();
}

const PRIVATE_OR_SENSITIVE_CONTENT = /\b(?:password|mat khau|otp|ma xac thuc|api key|access token|refresh token|secret|private key|cvv|cvc|so tai khoan|tai khoan ngan hang|cccd|can cuoc cong dan|cmnd|ho chieu|ngay sinh|muc luong|luong|so du)\b/i;

export function containsSensitiveMemoryContent(value: string) {
  return PRIVATE_OR_SENSITIVE_CONTENT.test(normalizedText(value));
}

export function validateMemoryContent(value: unknown): string {
  if (typeof value !== "string") throw new AssistantError("Nội dung ghi nhớ không hợp lệ.", 400);
  const content = value.replace(/\s+/g, " ").trim();
  if (!content) throw new AssistantError("Bạn nhập nội dung muốn ghi nhớ trước nhé.", 400);
  if (content.length > MAX_ASSISTANT_MEMORY_LENGTH) throw new AssistantError(`Mỗi ghi nhớ tối đa ${MAX_ASSISTANT_MEMORY_LENGTH} ký tự.`, 400);
  if (containsSensitiveMemoryContent(content)) {
    throw new AssistantError("Không thể lưu mật khẩu, thông tin xác thực hoặc dữ liệu cá nhân nhạy cảm vào ghi nhớ.", 400);
  }
  return content;
}

/** Only explicit memory phrases are intercepted; ordinary ERP requests continue through the assistant interpreter. */
export function parseExplicitMemoryCommand(value: string): string | null {
  const text = value.trim();
  const patterns = [
    /^(?:(?:từ nay|tu nay)\s+)?(?:(?:bạn|ban)\s+)?(?:hãy|hay)\s+(?:ghi nhớ|ghi nho)\s+(?:rằng|rang)\s+(.+)$/iu,
    /^(?:(?:từ nay|tu nay)\s+)?(?:(?:bạn|ban)\s+)?(?:hãy|hay)\s+(?:ghi nhớ|ghi nho)\s*:\s*(.+)$/iu,
    /^(?:(?:từ nay|tu nay)\s+)?(?:(?:bạn|ban)\s+)?(?:hãy|hay)\s+nhớ\s+(?:rằng|rang)\s+(.+)$/iu,
    /^(?:(?:từ nay|tu nay)\s+)?(?:(?:bạn|ban)\s+)?(?:hãy|hay)\s+nhớ\s*:\s*(.+)$/iu,
    /^(?:ghi nhớ|ghi nho)\s*:\s*(.+)$/iu,
    /^nhớ giúp tôi\s*:\s*(.+)$/iu,
    /^remember\s*:\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function toPublicItem(row: any): AssistantMemoryItem {
  return { id: String(row._id), content: row.content, source: row.source || "explicit", createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() };
}

export async function listAssistantMemories(req: AuthenticatedRequest): Promise<AssistantMemoryItem[]> {
  const scope = actorScope(req);
  await ensureAssistantIndexes();
  const rows = await AssistantMemoryModel.find(scope).sort({ updatedAt: -1, _id: -1 }).limit(MAX_ASSISTANT_MEMORIES).lean();
  return rows.map(toPublicItem);
}

export async function saveAssistantMemory(req: AuthenticatedRequest, rawContent: unknown, source: "explicit" | "manual" | "automatic" = "explicit"): Promise<{ item: AssistantMemoryItem; created: boolean }> {
  const scope = actorScope(req);
  const content = validateMemoryContent(rawContent);
  const key = normalizedKey(content);
  await ensureAssistantIndexes();
  const existing = await AssistantMemoryModel.findOne({ ...scope, normalizedContent: key }).select("_id").lean();
  if (!existing && await AssistantMemoryModel.countDocuments(scope) >= MAX_ASSISTANT_MEMORIES) {
    throw new AssistantError(`Bạn đã có tối đa ${MAX_ASSISTANT_MEMORIES} ghi nhớ. Hãy xóa một mục trước khi thêm mục mới.`, 409);
  }
  try {
    const row = await AssistantMemoryModel.findOneAndUpdate(
      { ...scope, normalizedContent: key },
      { $set: { content, source }, $setOnInsert: { ...scope, normalizedContent: key } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).lean();
    return { item: toPublicItem(row), created: !existing };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const row = await AssistantMemoryModel.findOneAndUpdate(
      { ...scope, normalizedContent: key }, { $set: { content, source } }, { returnDocument: "after" },
    ).lean();
    if (!row) throw error;
    return { item: toPublicItem(row), created: false };
  }
}

export async function updateAssistantMemory(req: AuthenticatedRequest, id: string, rawContent: unknown): Promise<AssistantMemoryItem> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AssistantError("Ghi nhớ không tồn tại.", 404);
  const scope = actorScope(req);
  const content = validateMemoryContent(rawContent);
  await ensureAssistantIndexes();
  try {
    const row = await AssistantMemoryModel.findOneAndUpdate(
      { ...scope, _id: id },
      { $set: { content, normalizedContent: normalizedKey(content), source: "manual" } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw new AssistantError("Ghi nhớ không tồn tại.", 404);
    return toPublicItem(row);
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    if ((error as { code?: number }).code === 11000) throw new AssistantError("Một ghi nhớ có nội dung này đã tồn tại.", 409);
    throw error;
  }
}

export async function deleteAssistantMemory(req: AuthenticatedRequest, id: string): Promise<{ deleted: boolean }> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AssistantError("Ghi nhớ không tồn tại.", 404);
  const result = await AssistantMemoryModel.deleteOne({ ...actorScope(req), _id: id });
  return { deleted: result.deletedCount === 1 };
}

export async function assistantMemoryContext(req: AuthenticatedRequest): Promise<string[]> {
  const scope = actorScope(req);
  await ensureAssistantIndexes();
  const rows = await AssistantMemoryModel.find(scope).sort({ updatedAt: -1, _id: -1 }).limit(MAX_PROMPT_MEMORY_ITEMS).select("content").lean();
  let remaining = MAX_PROMPT_MEMORY_CHARS;
  const items: string[] = [];
  for (const row of rows) {
    if (row.content.length > remaining) continue;
    items.push(row.content);
    remaining -= row.content.length;
    if (remaining <= 0) break;
  }
  return items;
}
