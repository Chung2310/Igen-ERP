import type { ClientSession, Types } from "mongoose";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { enabledTelecomInvoiceAccount, TelecomInvoiceModel, TelecomInvoiceSettingsModel, type TelecomInvoiceDraft } from "../model/telecom-invoice.model";
import { mapIntakeStandardFields } from "./lead-intake.service";
import { isInvoiceNumberField } from "./telecom-invoice-profile";
import { missingInvoiceFields } from "./telecom-invoice-values";
import { broadcastEvent } from "../../shared/socket";

type StoredInvoice = TelecomInvoiceDraft & { _id: Types.ObjectId };
type InvoiceSaveResult = "confirmed" | "duplicate" | "ambiguous" | "stale";
type InvoiceSaveTrigger = { mode: "automatic"; messageId: string } | { mode: "review"; messageId: string; messageAt: Date };
export const isDuplicateInvoiceKey = (error: unknown) => (error as { code?: number } | null)?.code === 11000;

async function findLead(draft: StoredInvoice, subscriberCode: string, session: ClientSession) {
  const scope = { companyCode: draft.companyCode, telecomSubscriberCode: subscriberCode };
  const current = await CRMTicketModel.findOne(scope).select("_id").session(session).lean();
  if (current) return current._id;

  // The known subscriber fields on existing Leads can claim this code on first use.
  const exactCode = new RegExp(`^\\s*${subscriberCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const mappedKey = draft.subscriberFieldKey;
  const legacy = await CRMTicketModel.find({ companyCode: draft.companyCode, telecomSubscriberCode: { $exists: false },
    $or: [{ "answers.telecom_subscriber_code": exactCode }, { "answers.ma_thue_bao": exactCode },
      ...((mappedKey && /^[a-z][a-z0-9_]{0,39}$/.test(mappedKey)) ? [{
        sourcePlatform: draft.platform ?? "facebook", sourceAccountId: draft.pageId, [`answers.${mappedKey}`]: exactCode,
      }] : []),
    ],
  }).select("_id").limit(2).session(session).lean();
  if (legacy.length > 1) return null;
  return legacy[0]?._id ?? undefined;
}

export function isInvoiceReadyForAutomaticSave(draft: Pick<TelecomInvoiceDraft, "values" | "fields" | "leadFields" | "subscriberFieldKey" | "imageIssue" | "unclearFields">) {
  return !!draft.values[draft.subscriberFieldKey ?? "subscriberCode"] && !draft.imageIssue && !draft.unclearFields?.length
    && missingInvoiceFields(draft).length === 0;
}

export async function saveTelecomInvoice(draft: StoredInvoice, trigger: InvoiceSaveTrigger): Promise<InvoiceSaveResult> {
  const subscriberCode = draft.values[draft.subscriberFieldKey ?? "subscriberCode"];
  if (!subscriberCode || missingInvoiceFields(draft).length) return "stale";
  if (trigger.mode === "automatic" && (!draft.autoEligible || draft.revision !== 1 || !isInvoiceReadyForAutomaticSave(draft))) return "stale";
  const invoiceNumberFields = draft.leadFields?.filter(isInvoiceNumberField);
  const invoiceKey = invoiceNumberFields?.length === 1 ? draft.values[invoiceNumberFields[0].key]
    : draft.leadFields ? undefined : draft.values.invoiceNumber;
  const customerName = draft.leadFields ? mapIntakeStandardFields(draft.leadFields, draft.values).name : draft.values.customerName;
  const platform = draft.platform ?? "facebook";

  // Concurrent confirmations across Pages can race when assigning the first Lead or invoice key.
  // Retry the transaction so the subsequent attempt can use the now-existing Lead/invoice.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await TelecomInvoiceModel.db.transaction<InvoiceSaveResult>(async session => {
        const pending = { _id: draft._id, companyCode: draft.companyCode, status: "pending" as const, revision: draft.revision,
          expiresAt: { $gt: new Date() }, ...(trigger.mode === "automatic" ? { autoEligible: true }
            : { presentedRevision: draft.revision, presentedAt: { $lte: trigger.messageAt } }),
        };
        if (!await TelecomInvoiceModel.exists(pending).session(session)) return "stale";
        if (!await TelecomInvoiceSettingsModel.exists(enabledTelecomInvoiceAccount({ ...draft, platform })).session(session)) return "stale";

        const duplicateKeys = [...(invoiceKey ? [{ subscriberCode, invoiceKey }] : []), ...(draft.imageHash ? [{ imageHash: draft.imageHash }] : [])];
        const duplicate = duplicateKeys.length ? await TelecomInvoiceModel.exists({ companyCode: draft.companyCode,
          status: "confirmed", $or: duplicateKeys }).session(session) : null;
        if (duplicate) {
          await TelecomInvoiceModel.updateOne(pending, { $set: { status: "duplicate", resolvedByMessageId: trigger.messageId } }, { session });
          return "duplicate";
        }
        const leadId = await findLead(draft, subscriberCode, session);
        if (leadId === null) return "ambiguous";
        const now = new Date();
        const leadUpdate = {
          $set: { telecomSubscriberCode: subscriberCode, telecomConversationId: draft.conversationId, telecomPageId: draft.pageId, telecomPlatform: platform },
          $max: { lastInteractionAt: now },
        };
        if (leadId) {
          await CRMTicketModel.updateOne({ _id: leadId, companyCode: draft.companyCode }, leadUpdate, { session });
        } else {
          await CRMTicketModel.updateOne({ companyCode: draft.companyCode, telecomSubscriberCode: subscriberCode }, {
            ...leadUpdate,
            $setOnInsert: {
              customerName: customerName || `Thuê bao ${subscriberCode}`,
              ...(draft.subscriberFieldKey ? { answers: { [draft.subscriberFieldKey]: subscriberCode } } : {}),
              productOfChoice: "Hóa đơn nhà mạng", sourcePlatform: platform, sourceAccountId: draft.pageId,
              lastInteraction: "Đã ghi nhận hóa đơn",
            },
          }, { upsert: true, setDefaultsOnInsert: true, session });
        }

        await TelecomInvoiceModel.updateOne(pending, {
          $set: { status: "confirmed", subscriberCode,
            ...(invoiceKey ? { invoiceKey } : {}), ...(draft.imageHash ? { recordedImageHash: draft.imageHash } : {}),
            confirmedAt: now, resolvedByMessageId: trigger.messageId },
          $unset: { expiresAt: 1 },
        }, { session });
        return "confirmed";
      });
      if (result === "confirmed") broadcastEvent("crm_leads_changed", { companyCode: draft.companyCode });
      return result;
    } catch (error) {
      if (!isDuplicateInvoiceKey(error) || attempt === 2) throw error;
    }
  }
  return "stale";
}
