import { Types } from "mongoose";
import { MarketingContentModel } from "../model/marketing-content.model.ts";

type TextRule = { max: number; trim?: boolean; allowEmpty?: boolean; options?: string[] };

const createRules: Record<string, TextRule> = {
  title: { max: 500, trim: true },
  channel: { max: 20, trim: true, options: ["Facebook", "TikTok", "LinkedIn", "Instagram", "Zalo"] },
  contentType: { max: 120, trim: true },
  bodyText: { max: 10000 },
  outline: { max: 5000, allowEmpty: true },
  mediaPrompt: { max: 5000, allowEmpty: true },
};
const updateRules: Record<string, TextRule> = {
  title: createRules.title,
  contentType: createRules.contentType,
  bodyText: createRules.bodyText,
  outline: createRules.outline,
  mediaPrompt: createRules.mediaPrompt,
};
const conflict = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });

function validateTextFields(value: unknown, rules: Record<string, TextRule>, required: string[] = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw conflict("Dữ liệu nội dung không hợp lệ.", 400);
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !Object.hasOwn(rules, key))) throw conflict("Chỉ được sửa các trường nội dung đã hỗ trợ.", 400);
  const result: Record<string, string> = {};
  for (const key of required) if (typeof source[key] !== "string") throw conflict(`Thiếu trường ${key}.`, 400);
  for (const [key, raw] of Object.entries(source)) {
    const rule = rules[key];
    if (typeof raw !== "string") throw conflict(`Trường ${key} phải là văn bản.`, 400);
    const text = rule.trim ? raw.trim() : raw;
    if (!rule.allowEmpty && !text.trim()) throw conflict(`Trường ${key} không được để trống.`, 400);
    if (text.length > rule.max) throw conflict(`Trường ${key} vượt quá ${rule.max} ký tự.`, 400);
    if (rule.options && !rule.options.includes(text)) throw conflict("Kênh nội dung không được hỗ trợ.", 400);
    result[key] = text;
  }
  return result;
}

function assertChannelTextLength(channel: string, bodyText?: string) {
  if (channel === "TikTok" && bodyText !== undefined && bodyText.length > 2200) {
    throw conflict("Caption TikTok không được vượt quá 2.200 ký tự.", 400);
  }
}

function assertId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw conflict("Mã nội dung không hợp lệ.", 400);
}

const standaloneDraftFilter = (id: string, companyCode: string) => ({
  _id: new Types.ObjectId(id),
  companyCode,
  status: "draft" as const,
  campaignId: { $in: [null, ""] },
  campaignSlotId: null,
  scheduledDate: { $in: [null, ""] },
  scheduledTime: { $in: [null, ""] },
  publishedAt: null,
  facebookPostId: { $in: [null, ""] },
  tiktokPostId: { $in: [null, ""] },
  tiktokPublishId: { $in: [null, ""] },
  tiktokLastWebhookEvent: { $in: [null, ""] },
  tiktokWebhookUpdatedAt: null,
  postUrl: { $in: [null, ""] },
  tiktokShareUrl: { $in: [null, ""] },
});

function publicDraft(value: unknown) {
  const record = value as Record<string, unknown>;
  return {
    title: record.title,
    channel: record.channel,
    contentType: record.contentType,
    status: record.status,
    bodyText: record.bodyText,
    outline: record.outline,
    mediaPrompt: record.mediaPrompt,
    generatedAt: record.generatedAt,
  };
}

export async function createMarketingContentDraft(companyCode: string, userId: string, value: unknown) {
  const data = validateTextFields(value, createRules, ["title", "channel", "contentType", "bodyText"]);
  assertChannelTextLength(data.channel, data.bodyText);
  const item = await MarketingContentModel.create({
    ...data,
    status: "draft",
    companyCode,
    authorUid: userId,
  });
  return publicDraft(item.toObject());
}

export async function updateMarketingContentDraft(companyCode: string, id: string, value: unknown) {
  assertId(id);
  const data = validateTextFields(value, updateRules);
  if (!Object.keys(data).length) throw conflict("Nêu ít nhất một trường nội dung cần cập nhật.", 400);
  const current = await MarketingContentModel.findOne({ _id: id, companyCode })
    .select("title status channel campaignId campaignSlotId scheduledDate scheduledTime publishedAt facebookPostId tiktokPostId tiktokPublishId tiktokLastWebhookEvent tiktokWebhookUpdatedAt postUrl tiktokShareUrl")
    .lean();
  if (!current) throw conflict("Không tìm thấy nội dung trong doanh nghiệp hiện tại.", 404);
  if (current.status !== "draft" || current.campaignId || current.campaignSlotId || current.scheduledDate || current.scheduledTime
    || current.publishedAt || current.facebookPostId || current.tiktokPostId || current.tiktokPublishId || current.tiktokLastWebhookEvent
    || current.tiktokWebhookUpdatedAt || current.postUrl || current.tiktokShareUrl) {
    throw conflict("Chỉ có thể cập nhật bản nháp độc lập, chưa lên lịch và chưa gắn Campaign.");
  }
  assertChannelTextLength(String(current.channel || ""), data.bodyText);
  const updated = await MarketingContentModel.findOneAndUpdate(
    standaloneDraftFilter(id, companyCode),
    { $set: data },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw conflict("Bản nháp đã thay đổi hoặc được gắn lịch/Campaign. Hãy tra cứu lại trước khi sửa.");
  return publicDraft(updated);
}

export async function deleteMarketingContentDraft(companyCode: string, id: string) {
  assertId(id);
  const current = await MarketingContentModel.findOne({ _id: id, companyCode })
    .select("title status campaignId campaignSlotId scheduledDate scheduledTime publishedAt facebookPostId tiktokPostId tiktokPublishId tiktokLastWebhookEvent tiktokWebhookUpdatedAt postUrl tiktokShareUrl")
    .lean();
  if (!current) throw conflict("Không tìm thấy nội dung trong doanh nghiệp hiện tại.", 404);
  if (current.status !== "draft" || current.campaignId || current.campaignSlotId || current.scheduledDate || current.scheduledTime
    || current.publishedAt || current.facebookPostId || current.tiktokPostId || current.tiktokPublishId || current.tiktokLastWebhookEvent
    || current.tiktokWebhookUpdatedAt || current.postUrl || current.tiktokShareUrl) {
    throw conflict("Chỉ có thể xóa bản nháp độc lập chưa lên lịch hoặc đăng bài.");
  }
  const deleted = await MarketingContentModel.findOneAndDelete(standaloneDraftFilter(id, companyCode)).lean();
  if (!deleted) throw conflict("Bản nháp đã thay đổi. Hãy tra cứu lại trước khi xóa.");
  return { deleted: true, title: typeof deleted.title === "string" ? deleted.title : "" };
}
