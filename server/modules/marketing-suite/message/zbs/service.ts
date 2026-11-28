import { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import type { ZbsBatch, ZbsDraftInput, ZbsTemplate } from "../../../../../shared/marketing-suite/zbs";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { withLeadZaloIdentities } from "../service/lead-zalo-identity.service";
import { ZbsBatchModel, ZbsOaLockModel, ZbsTemplateModel } from "./model";
import { assertZbsOa, fetchZbsTemplate, zbsProviderRequest } from "./provider";
import { buildZbsRows, templateHash, validateMapping, zbsError } from "./core";
import { resolveZaloAppConfig } from "../../shared/zalo-app-config";

export async function zbsAppId(companyCode: string, oaId: string) { return (await resolveZaloAppConfig(oaId, companyCode)).appId; }
export function publicBatch(value: any): ZbsBatch {
  return { id: String(value._id), name: value.name, oaId: value.oaId, templateId: value.templateId, templateName: value.templateName,
    method: value.method, status: value.status, test: value.test, development: value.development, rows: value.rows,
    createdAt: new Date(value.createdAt).toISOString(), expiresAt: new Date(value.expiresAt).toISOString(),
    estimatedCost: value.estimatedCost ?? null, ...(value.confirmedAt ? { confirmedAt: new Date(value.confirmedAt).toISOString() } : {}) };
}
export function publicTemplate(value: any): ZbsTemplate {
  return { templateId: value.templateId, name: value.name, status: value.status, params: value.params, buttons: value.buttons,
    previewUrl: value.previewUrl, uidSupported: value.uidSupported, phoneSupported: value.phoneSupported,
    priceUid: value.priceUid ?? null, pricePhone: value.pricePhone ?? null, mapping: value.mapping || {}, syncedAt: value.syncedAt?.toISOString() };
}
const TEMPLATE_SYNC_INTERVAL = 5 * 60_000;
function loadZbsTemplates(companyCode: string, oaId: string, appId: string) {
  return ZbsTemplateModel.find({ companyCode, oaId, appId }).sort({ name: 1 }).lean();
}
const templateSyncs = new Map<string, Promise<Awaited<ReturnType<typeof loadZbsTemplates>>>>();
export async function syncZbsTemplates(companyCode: string, oaId: string, force = true) {
  const appId = await zbsAppId(companyCode, oaId);
  await assertZbsOa(companyCode, oaId);
  const key = `templates:${companyCode}:${appId}:${oaId}`;
  const active = templateSyncs.get(key);
  if (active) return active;
  const task = refreshZbsTemplates(companyCode, oaId, appId, key, force);
  templateSyncs.set(key, task);
  try { return await task; } finally { if (templateSyncs.get(key) === task) templateSyncs.delete(key); }
}
async function refreshZbsTemplates(companyCode: string, oaId: string, appId: string, key: string, force: boolean) {
  try { await ZbsOaLockModel.updateOne({ _id: key }, { $setOnInsert: { until: new Date(0), nextAt: new Date(0) } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const state = await ZbsOaLockModel.findById(key).lean();
  if (!force && state?.nextAt && +state.nextAt > Date.now()) return loadZbsTemplates(companyCode, oaId, appId);
  const owner = randomUUID();
  const lease = await ZbsOaLockModel.findOneAndUpdate({ _id: key, until: { $lte: new Date() } }, { $set: { owner, until: new Date(Date.now() + 120_000) } }, { returnDocument: "after" }).lean();
  if (!lease) throw zbsError("Mẫu đang được đồng bộ. Hãy tải lại sau ít giây.", 409);
  async function renew() {
    const result = await ZbsOaLockModel.updateOne({ _id: key, owner, until: { $gt: new Date() } }, { $set: { until: new Date(Date.now() + 120_000) } });
    if (!result.matchedCount) throw zbsError("Phiên đồng bộ đã hết hạn. Hãy đồng bộ lại.", 409);
  }
  try {
  // A different API process may have refreshed between the cache read and lease acquisition.
  if (!force && lease.nextAt && +lease.nextAt > Date.now()) return loadZbsTemplates(companyCode, oaId, appId);
  const templates: ZbsTemplate[] = [];
  let complete = false;
  for (let offset = 0; offset < 5000; offset += 100) {
    await renew();
    const result = await zbsProviderRequest(companyCode, oaId, `/template/all?offset=${offset}&limit=100&filterPreset=1`, undefined, false, appId);
    if (!Array.isArray(result.data)) throw zbsError("Danh sách mẫu từ Zalo không hợp lệ.", 502);
    for (const summary of result.data) {
      await renew();
      const template = await fetchZbsTemplate(companyCode, oaId, String(summary.templateId), appId);
      templates.push(template);
    }
    if (result.data.length < 100 || offset + 100 >= Number(result.metadata?.total)) { complete = true; break; }
  }
  if (!complete) throw zbsError("OA có quá nhiều mẫu cho một lần đồng bộ. Chưa thay đổi danh sách mẫu hiện có.", 422);
  const syncedAt = new Date();
  for (const template of templates) {
    await renew();
    const { mapping: _mapping, ...details } = template;
    await ZbsTemplateModel.updateOne({ companyCode, oaId, appId, templateId: template.templateId }, {
      $set: { ...details, syncedAt }, $setOnInsert: { mapping: {} },
    }, { upsert: true });
  }
  await renew();
  await ZbsTemplateModel.updateMany({ companyCode, oaId, appId, templateId: { $nin: templates.map(t => t.templateId) } }, { $set: { status: "UNAVAILABLE", uidSupported: false, phoneSupported: false, syncedAt } });
  await ZbsOaLockModel.updateOne({ _id: key, owner }, { $set: { nextAt: new Date(Date.now() + TEMPLATE_SYNC_INTERVAL) } });
  return loadZbsTemplates(companyCode, oaId, appId);
  } finally { await ZbsOaLockModel.updateOne({ _id: key, owner }, { $set: { until: new Date(0) } }); }
}
export async function createZbsDraft(companyCode: string, userId: string, input: ZbsDraftInput) {
  if (!["uid", "phone"].includes(input.method) || typeof input.name !== "string" || !input.name.trim() || input.name.length > 120 ||
    typeof input.oaId !== "string" || typeof input.templateId !== "string" || input.templateId.length > 100 ||
    !Array.isArray(input.leadIds) || input.leadIds.length > 500 || input.leadIds.some(id => typeof id !== "string" || !Types.ObjectId.isValid(id))) throw zbsError("Chọn tối đa 500 Lead và điền đủ tên, OA, mẫu, phương thức.");
  if (input.manualRecipient && (input.test !== true || input.leadIds.length > 1 || typeof input.manualRecipient !== "string" || input.manualRecipient.length > 40)) throw zbsError("Chỉ nhập người nhận thủ công cho một tin thử.");
  if (input.test && input.leadIds.length > 1) throw zbsError("Gửi thử chỉ chọn một Lead.");
  if (!input.leadIds.length && !input.manualRecipient) throw zbsError("Chưa chọn người nhận.");
  if (input.development && (!input.test || input.method !== "phone")) throw zbsError("Development chỉ hỗ trợ gửi thử SĐT quản trị viên OA/App.");
  await assertZbsOa(companyCode, input.oaId);
  const appId = await zbsAppId(companyCode, input.oaId);
  const template = await fetchZbsTemplate(companyCode, input.oaId, input.templateId, appId);
  const mapping = validateMapping(input.mapping, template.params);
  const leadIds = [...new Set(input.leadIds)];
  const records = await CRMTicketModel.find({ companyCode, _id: { $in: leadIds } }).lean();
  if (records.length !== leadIds.length) throw zbsError("Một số Lead không tồn tại hoặc ngoài doanh nghiệp.", 403);
  const enriched = await withLeadZaloIdentities(companyCode, records);
  const byId = new Map(enriched.map(lead => [String(lead._id), lead]));
  const leads = leadIds.map(id => ({ ...byId.get(id)!, id }));
  const rows = buildZbsRows(template, input.method, mapping, leads.length ? leads : [{ id: "", customerName: "Gửi thử" }], input.oaId, input.manualRecipient);
  if (Buffer.byteLength(JSON.stringify(rows)) > 4_000_000) throw zbsError("Dữ liệu đợt gửi quá lớn. Hãy chia nhỏ danh sách.");
  const unitPrice = input.method === "uid" ? template.priceUid : template.pricePhone;
  const batch = await ZbsBatchModel.create({ companyCode, appId, createdBy: userId, name: input.name.trim(), oaId: input.oaId,
    templateId: input.templateId, templateName: template.name, method: input.method, test: input.test === true,
    development: input.development === true, rows, status: "draft", templateHash: templateHash(template),
    estimatedCost: unitPrice == null ? null : unitPrice * rows.filter(r => r.status === "pending").length,
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
  });
  return publicBatch(batch.toObject());
}
export async function getZbsBatch(companyCode: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw zbsError("Đợt gửi không hợp lệ.");
  const batch = await ZbsBatchModel.findOne({ _id: id, companyCode }).lean();
  if (!batch) throw zbsError("Không tìm thấy đợt gửi.", 404);
  return batch;
}
export async function confirmZbsBatch(companyCode: string, userId: string, id: string) {
  const batch = await getZbsBatch(companyCode, id);
  if (batch.status !== "draft") return publicBatch(batch);
  if (batch.expiresAt.getTime() < Date.now()) throw zbsError("Bản xem trước hết hạn. Hãy kiểm tra lại danh sách.", 409);
  if (!batch.rows.some(r => r.status === "pending")) throw zbsError("Không có người nhận đủ điều kiện.");
  const template = await fetchZbsTemplate(companyCode, batch.oaId, batch.templateId, batch.appId);
  if (template.status !== "ENABLE" || templateHash(template) !== batch.templateHash) throw zbsError("Mẫu hoặc đơn giá đã thay đổi. Hãy tạo bản xem trước mới.", 409);
  const updated = await ZbsBatchModel.findOneAndUpdate({ _id: id, companyCode, status: "draft" }, {
    $set: { status: "queued", confirmedAt: new Date(), confirmedBy: userId },
  }, { returnDocument: "after" }).lean();
  return publicBatch(updated || await getZbsBatch(companyCode, id));
}
