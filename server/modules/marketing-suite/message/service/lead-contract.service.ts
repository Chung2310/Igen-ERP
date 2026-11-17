import type { ClientSession, Types } from "mongoose";
import { normalizeLeadContractCode } from "../../../../../shared/marketing-suite/telecom-invoice";
import type { ILeadIntakeFieldSnapshot } from "../interface/crm-ticket.interface";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadContractModel, LeadContractPhotoModel, type ContractPhotoRecord } from "../model/lead-contract.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";
import { parseLeadIntakeAmount, mapIntakeStandardFields } from "./lead-intake.service";
import { isDuplicateInvoiceKey } from "./telecom-invoice-lead";
import { broadcastEvent } from "../../shared/socket";

export type StoredContractPhoto = ContractPhotoRecord & { _id: Types.ObjectId };
type ContractWriteResult = { leadId: string; issue?: undefined } | { leadId?: undefined; issue: string };
const fieldKeyPattern = /^[a-z][a-z0-9_]{0,39}$/;

export async function findContractAccountFields(companyCode: string, provider: string, session?: ClientSession) {
  const query = TelecomInvoiceSettingsModel.find({ companyCode, $or: [
    { mode: "contract", contractProvider: provider },
    { "zalo.mode": "contract", "zalo.contractProvider": provider },
  ] }).select("pageId mode contractProvider contractFieldKey zalo");
  if (session) query.session(session);
  const settings = await query.lean();
  return settings.flatMap(setting => {
    const candidates = [
      { platform: "facebook" as const, config: setting },
      { platform: "zalo" as const, config: setting.zalo },
    ];
    return candidates.flatMap(({ platform, config }) => config?.mode === "contract" && config.contractProvider === provider
      && config.contractFieldKey && fieldKeyPattern.test(config.contractFieldKey)
      ? [{ sourcePlatform: platform, sourceAccountId: setting.pageId, key: config.contractFieldKey }] : []);
  });
}

function applyConfirmedValues(photo: StoredContractPhoto, values: Record<string, string>, lead?: {
  customerName?: string;
  phone?: string;
  email?: string;
  company?: string;
  value?: number;
  productOfChoice?: string;
  answers?: Record<string, string>;
  intakeFields?: ILeadIntakeFieldSnapshot[];
}) {
  const answers = { ...lead?.answers };
  const intakeFields = new Map((lead?.intakeFields ?? []).map(field => [field.key, field]));
  for (const field of photo.fields) {
    if (!answers[field.key] && values[field.key]) answers[field.key] = values[field.key];
    if (!intakeFields.has(field.key)) intakeFields.set(field.key, {
      ...field, type: field.type ?? "text", options: field.options ?? [], required: field.required !== false,
    });
  }
  const standard = mapIntakeStandardFields(photo.fields, answers);
  const value = standard.value ? parseLeadIntakeAmount(standard.value) : undefined;
  return {
    answers,
    hasContractPhotos: true,
    intakeFields: [...intakeFields.values()],
    intakeSearchText: Object.values(answers).join("\n").slice(0, 100_000),
    ...(!lead?.customerName && standard.name ? { customerName: standard.name } : {}),
    ...(!lead?.phone && standard.phone ? { phone: standard.phone } : {}),
    ...(!lead?.email && standard.email ? { email: standard.email } : {}),
    ...(!lead?.company && standard.company ? { company: standard.company } : {}),
    ...(!lead?.productOfChoice && standard.productOfChoice ? { productOfChoice: standard.productOfChoice } : {}),
    ...(!lead?.value && value !== undefined ? { value } : {}),
  };
}

export async function recordLeadContractPhoto(photo: StoredContractPhoto, values: Record<string, string>, staff = false): Promise<ContractWriteResult> {
  const code = normalizeLeadContractCode(values[photo.contractFieldKey]);
  if (!code) return { issue: "Cần bổ sung mã hợp đồng rõ ràng." };
  const companyCode = photo.companyCode;
  const contractScope = { companyCode, provider: photo.provider, code };

  for (let attempt = 0; ; attempt++) {
    try {
      const result = await LeadContractModel.db.transaction<ContractWriteResult>(async session => {
        if (!await LeadContractPhotoModel.exists({ _id: photo._id, companyCode, status: "review" }).session(session)) {
          return { issue: "Ảnh này đã được xử lý." };
        }
        if (!staff) {
          const prefix = photo.platform === "zalo" ? "zalo." : "";
          const config = await TelecomInvoiceSettingsModel.exists({ companyCode, pageId: photo.pageId,
            [prefix + "enabled"]: true, [prefix + "mode"]: "contract",
            [prefix + "contractProvider"]: photo.provider, [prefix + "contractFieldKey"]: photo.contractFieldKey }).session(session);
          if (!config) return { issue: "Cấu hình OCR của kênh đã thay đổi." };
        }

        const contract = await LeadContractModel.findOne(contractScope).session(session).lean();
        let lead = contract ? await CRMTicketModel.findOne({ companyCode, _id: contract.leadId }).session(session).lean() : null;
        if (!lead) {
          const accounts = await findContractAccountFields(companyCode, photo.provider, session);
          const exactCode = new RegExp("^\\s*" + code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i");
          const candidates = accounts.length ? await CRMTicketModel.find({ companyCode, $or: accounts.map(({ key, ...account }) => ({
            ...account, [`answers.${key}`]: exactCode,
          })) }).limit(2).session(session).lean() : [];
          if (candidates.length > 1) return { issue: "Mã hợp đồng có trên nhiều Lead. Cần sửa mã trùng trước khi ghi." };
          lead = candidates[0] ?? null;
        }

        const filled = applyConfirmedValues(photo, { ...values, [photo.contractFieldKey]: code }, lead ?? undefined);
        const missing = photo.fields.filter(field => field.required !== false && !filled.answers[field.key]);
        if (missing.length) return { issue: `Cần bổ sung ${missing.map(field => field.label).join(", ")}.` };
        if (!lead && !filled.customerName && !filled.phone && !filled.email) {
          return { issue: "Cần tên, số điện thoại hoặc email của khách để tạo Lead." };
        }

        let leadId = lead?._id;
        if (leadId) {
          await CRMTicketModel.updateOne({ companyCode, _id: leadId }, {
            $set: filled, $max: { lastInteractionAt: photo.receivedAt },
          }, { session });
        } else {
          const [created] = await CRMTicketModel.create([{
            ...filled, companyCode, customerName: filled.customerName || `Hợp đồng ${code}`,
            sourcePlatform: photo.platform, sourceAccountId: photo.pageId,
            lastInteractionAt: photo.receivedAt, lastInteraction: "Đã ghi nhận ảnh hợp đồng",
          }], { session });
          leadId = created._id;
        }
        await LeadContractModel.updateOne(contractScope, {
          $set: { leadId }, $min: { firstSeenAt: photo.receivedAt },
        }, { upsert: true, session });
        await LeadContractPhotoModel.updateOne({ _id: photo._id }, {
          $set: { leadId, status: "recorded", contractCode: code, values: { ...values, [photo.contractFieldKey]: code } },
          $unset: { issue: 1 },
        }, { session });
        return { leadId: String(leadId) };
      });
      if (result.leadId) broadcastEvent("crm_leads_changed", { companyCode });
      return result;
    } catch (error) {
      if (!isDuplicateInvoiceKey(error) || attempt >= 2) throw error;
    }
  }
}
