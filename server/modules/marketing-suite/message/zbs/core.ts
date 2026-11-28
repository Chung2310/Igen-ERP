import { createHash, randomUUID } from "node:crypto";
import type { ZbsMapping, ZbsMethod, ZbsParam, ZbsRow, ZbsTemplate } from "../../../../../shared/marketing-suite/zbs";

export function zbsError(message: string, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
export function normalizeZbsPhone(value: string) {
  const phone = value.replace(/[\s().-]/g, "").replace(/^\+/, "").replace(/^0/, "84");
  return /^84[35789]\d{8}$/.test(phone) ? phone : "";
}
export const templateHash = (template: ZbsTemplate) =>
  createHash("sha256").update(JSON.stringify([template.templateId, template.name, template.params, template.buttons, template.previewUrl, template.status, template.uidSupported, template.phoneSupported, template.priceUid, template.pricePhone])).digest("hex");
export function validateMapping(value: unknown, params: ZbsParam[]): ZbsMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw zbsError("Cấu hình dữ liệu mẫu không hợp lệ.");
  const result: ZbsMapping = {};
  const publicFields = new Set(["customerName", "company", "phone", "email", "productOfChoice", "value", "status", "telecomSubscriberCode"]);
  for (const param of params) {
    const field = (value as ZbsMapping)[param.name];
    if (!field) continue;
    if (!["lead", "answer", "constant"].includes(field.source) || typeof field.key !== "string" || field.key.length > 2000 ||
      (field.source === "lead" && !publicFields.has(field.key)) ||
      (field.source === "answer" && !/^[\p{L}\p{N}_-]{1,100}$/u.test(field.key))) throw zbsError(`Nguồn dữ liệu của ${param.name} không hợp lệ.`);
    result[param.name] = { source: field.source, key: field.key };
  }
  return result;
}
export function buildZbsRows(template: ZbsTemplate, method: ZbsMethod, mapping: ZbsMapping,
  leads: Array<Record<string, unknown> & { id: string; zaloIdentity?: { oaId: string; uid: string } }>, oaId: string,
  manualRecipient?: string): ZbsRow[] {
  const seen = new Set<string>();
  return leads.map(lead => {
    const uid = lead.zaloIdentity?.oaId === oaId ? lead.zaloIdentity.uid : "";
    const recipient = method === "uid" ? (manualRecipient || uid) : normalizeZbsPhone(manualRecipient || String(lead.phone || ""));
    const reasons: string[] = [];
    if (!recipient || (method === "uid" && !/^\d{1,30}$/.test(recipient))) reasons.push(method === "uid" ? "Chưa có UID hợp lệ thuộc OA đã chọn" : "SĐT Việt Nam không hợp lệ");
    if (template.status !== "ENABLE") reasons.push("Mẫu chưa được kích hoạt");
    if (!(method === "uid" ? template.uidSupported : template.phoneSupported)) reasons.push("Mẫu chưa xác nhận hỗ trợ phương thức gửi này");
    const data: Record<string, string> = {};
    for (const param of template.params) {
      const field = mapping[param.name];
      const value = field?.source === "constant" ? field.key : field?.source === "lead" ? lead[field.key]
        : field?.source === "answer" ? (lead.answers as Record<string, unknown> | undefined)?.[field.key] : "";
      const text = value == null ? "" : (typeof value === "string" || typeof value === "number" ? String(value) : "");
      if ((!text && param.required && !param.acceptNull) || (text && (text.length < param.minLength || text.length > param.maxLength))) reasons.push(`Thiếu hoặc sai độ dài biến ${param.name}`);
      if (text && param.type === "NUMBER" && !/^-?\d+(\.\d+)?$/.test(text)) reasons.push(`Biến ${param.name} phải là số`);
      if (text || param.required) data[param.name] = text;
    }
    if (recipient && seen.has(recipient)) reasons.push("Trùng người nhận trong đợt gửi");
    // Only a valid row consumes the recipient, so an incomplete duplicate cannot suppress a valid row.
    if (!reasons.length) seen.add(recipient);
    return { id: randomUUID(), leadId: lead.id || undefined, name: String(lead.customerName || "Gửi thử"), recipient, method,
      ...(!manualRecipient && method === "uid" && !uid && normalizeZbsPhone(String(lead.phone || "")) ? { suggestedMethod: "phone" as const } : {}),
      data, status: reasons.length ? "blocked" : "pending", reason: reasons.join("; "), trackingId: randomUUID().replaceAll("-", "") };
  });
}
