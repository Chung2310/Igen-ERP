import { randomUUID } from "node:crypto";
import { CRMTicketModel } from "../model/crm-ticket.model";
import type { ILeadIntakeFieldSnapshot } from "../interface/crm-ticket.interface";
import type { LeadIntakeField, LeadNeed } from "../../../../../shared/marketing-suite/lead-intake";
import { parseIntakeNumber } from "./intake-number";
import { broadcastEvent } from "../../shared/socket";
import { getIntakeStandardField, normalizeIntakeText } from "./normalize-intake-fields";
import { isTelecomStaffField } from "./telecom-invoice-profile";
import { LeadContractModel } from "../model/lead-contract.model";
import { contractDocumentKey, type ContractLeadIdentity } from "./telecom-document-identity";

type IntakePlatform = "facebook" | "zalo" | "tiktok";

function initials(value: string) {
  return value.trim().split(/\s+/).slice(-2).map(part => part[0]?.toUpperCase()).join("") || "KH";
}

export function parseLeadIntakeAmount(value: string) {
  return parseIntakeNumber(value, true);
}

export function mapIntakeStandardFields(
  fields: Array<{ key: string; label: string; type?: string }>,
  answers: Record<string, string>,
) {
  const standard: Record<string, string> = {};
  for (const field of fields) {
    const answer = answers[field.key]?.trim();
    const target = getIntakeStandardField(field);
    if (answer && target) standard[target] = answer;
  }
  return standard;
}

type LeadIntakeIdentity = {
  companyCode: string;
  platform: IntakePlatform;
  accountId: string;
  conversationId: string;
  subscriberIdentity?: { fieldKey: string; code: string };
  contractIdentity?: ContractLeadIdentity;
};

function intakeIdentity(input: LeadIntakeIdentity) {
  if (input.contractIdentity) return {
    companyCode: input.companyCode.trim().toUpperCase(),
    telecomDocumentKey: contractDocumentKey(input.contractIdentity.provider, input.contractIdentity.code),
  };
  if (input.subscriberIdentity) return {
    companyCode: input.companyCode.trim().toUpperCase(),
    telecomSubscriberCode: input.subscriberIdentity.code,
  };
  return {
    companyCode: input.companyCode.trim().toUpperCase(),
    sourcePlatform: input.platform,
    sourceAccountId: input.accountId.trim(),
    sourceConversationId: input.conversationId.trim(),
  };
}

export async function findLeadForIntake(input: LeadIntakeIdentity) {
  const selection = "customerName phone email company avatar productOfChoice value answers needs customerId intakeRevision intakeStaffFields lastIntakeMessageId lastIntakeMessageAt collectionStatus telecomSubscriberCode telecomDocumentKey telecomConversationId telecomPageId telecomPlatform";
  const current = await CRMTicketModel.findOne(intakeIdentity(input)).select(selection).lean();
  if (current) return current;
  if (input.contractIdentity) {
    const { fieldKey, code, provider, providerFieldKey = "nha_mang" } = input.contractIdentity;
    if (![fieldKey, providerFieldKey].every(key => /^[a-z][a-z0-9_]{0,39}$/.test(key))) throw new Error("Cột hợp đồng không hợp lệ.");
    const registered = await LeadContractModel.findOne({ companyCode: input.companyCode.trim().toUpperCase(), provider, code }).lean();
    if (registered) return CRMTicketModel.findOne({ companyCode: input.companyCode.trim().toUpperCase(), _id: registered.leadId }).select(selection).lean();
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const candidates = await CRMTicketModel.find({ companyCode: input.companyCode.trim().toUpperCase(),
      [`answers.${fieldKey}`]: new RegExp(`^\\s*${escape(code)}\\s*$`, "i"),
      [`answers.${providerFieldKey}`]: new RegExp(`^\\s*${escape(provider)}\\s*$`, "i"),
    }).select(selection).limit(2).lean();
    if (candidates.length > 1) throw new Error("Có nhiều Lead cùng số hợp đồng và nhà mạng. Cần kiểm tra trước khi ghi dữ liệu.");
    return candidates[0] || null;
  }
  if (!input.subscriberIdentity) return current;
  const { fieldKey, code } = input.subscriberIdentity;
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(fieldKey)) throw new Error("Cột thuê bao không hợp lệ.");
  const exactCode = new RegExp(`^\\s*${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const candidates = await CRMTicketModel.find({ companyCode: input.companyCode.trim().toUpperCase(),
    telecomSubscriberCode: { $exists: false }, [`answers.${fieldKey}`]: exactCode,
  }).select(selection).limit(2).lean();
  if (candidates.length > 1) throw new Error("Có nhiều Lead cùng mã thuê bao. Cần kiểm tra trước khi ghi dữ liệu.");
  return candidates[0] || null;
}

export async function upsertLeadFromIntake(input: LeadIntakeIdentity & {
  profileId: string;
  profileVersion: number;
  fields: LeadIntakeField[];
  values: Record<string, string>;
  previousValues: Record<string, string>;
  needs?: Array<Omit<LeadNeed, "id"> & { id?: string }>;
  allowCreate: boolean;
  messageId: string;
  messageAt?: Date;
  fillMissingOnly?: boolean;
  preserveNewerValues?: boolean;
}) {
  const identity = intakeIdentity(input);
  const documentIdentity = input.contractIdentity || input.subscriberIdentity;
  const fieldSnapshot: ILeadIntakeFieldSnapshot[] = input.fields.map(field => ({
    key: field.key,
    label: field.label,
    question: field.question,
    type: field.type || "text",
    required: field.required !== false,
    options: field.options || [],
  }));

  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await findLeadForIntake(input);
    if (!current && !input.allowCreate) return null;
    const hasNewerLead = Boolean(current?.lastIntakeMessageAt && input.messageAt &&
      (current.lastIntakeMessageAt > input.messageAt || (input.preserveNewerValues &&
        current.lastIntakeMessageAt.getTime() === input.messageAt.getTime() && current.lastIntakeMessageId !== input.messageId)));
    if (current?.lastIntakeMessageId === input.messageId || (hasNewerLead && !input.preserveNewerValues)) {
      return current;
    }
    const fillMissingOnly = Boolean(current && (input.fillMissingOnly || hasNewerLead));

    const protectedFields = new Set(current?.intakeStaffFields);
    const answers = { ...current?.answers };
    const changedAnswers: Record<string, string> = {};
    for (const field of input.fields) {
      const value = input.values[field.key]?.trim();
      if (!value || protectedFields.has(`answers.${field.key}`)) continue;
      if (fillMissingOnly && answers[field.key]?.trim()) continue;
      if (current && (value === answers[field.key] || (answers[field.key] && value === input.previousValues[field.key]))) continue;
      changedAnswers[field.key] = value;
      answers[field.key] = value;
    }
    const needs = [...(current?.needs || [])];
    let needsChanged = false;
    for (const entry of input.needs || []) {
      const index = entry.id ? needs.findIndex(need => need.id === entry.id) : -1;
      if (entry.id && index === -1) continue;
      const previous = needs[index];
      if (fillMissingOnly && !previous) continue;
      const previousAnswers = previous?.answers || {};
      const nextAnswers = fillMissingOnly ? { ...entry.answers, ...previousAnswers } : { ...previousAnswers, ...entry.answers };
      const next: LeadNeed = fillMissingOnly && previous
        ? { ...previous, answers: nextAnswers }
        : { id: previous?.id || randomUUID(), groupKey: entry.groupKey, groupLabel: entry.groupLabel, title: entry.title, answers: nextAnswers };
      if (previous && JSON.stringify(previous) === JSON.stringify(next)) continue;
      if (index >= 0) needs[index] = next;
      else if (needs.length < 50 && !needs.some(need => need.groupKey === next.groupKey
        && normalizeIntakeText(need.title) === normalizeIntakeText(next.title) && Object.keys(need.answers || {}).length === Object.keys(next.answers).length
        && Object.entries(next.answers).every(([key, answer]) => need.answers?.[key] === answer))) {
        needs.push(next);
      } else continue;
      needsChanged = true;
    }
    const subscriberChanged = (input.contractIdentity && (current?.telecomDocumentKey !== contractDocumentKey(input.contractIdentity.provider, input.contractIdentity.code)
      || current?.telecomConversationId !== input.conversationId || current?.telecomPageId !== input.accountId)) || input.subscriberIdentity && (current?.telecomSubscriberCode !== input.subscriberIdentity.code
      || current?.telecomConversationId !== input.conversationId || current?.telecomPageId !== input.accountId);
    if (!Object.keys(changedAnswers).length && !needsChanged && !subscriberChanged) return current;

    const customerFields = documentIdentity ? input.fields.filter(field => !isTelecomStaffField(field)) : input.fields;
    const standard = mapIntakeStandardFields(customerFields, changedAnswers);
    const complete = input.fields.every(field => field.required === false || Boolean(answers[field.key]?.trim()));
    const collectionStatus = current?.collectionStatus === "needs_human" ? "needs_human" : complete ? "complete" : "collecting";
    const changedAnswerPaths = Object.fromEntries(Object.entries(changedAnswers).map(([key, value]) => [`answers.${key}`, value]));
    const update: Record<string, unknown> = {
      ...(input.contractIdentity ? { telecomDocumentKey: contractDocumentKey(input.contractIdentity.provider, input.contractIdentity.code),
        telecomConversationId: input.conversationId, telecomPageId: input.accountId, telecomPlatform: input.platform } : {}),
      ...(input.subscriberIdentity ? { telecomSubscriberCode: input.subscriberIdentity.code,
        telecomConversationId: input.conversationId, telecomPageId: input.accountId, telecomPlatform: input.platform } : {}),
      ...(current ? changedAnswerPaths : { answers }),
      ...(needsChanged ? { needs } : {}),
      intakeSearchText: [...Object.values(answers), ...needs.flatMap(need => [need.title, need.groupLabel, ...Object.values(need.answers || {})])].join(" ").slice(0, 100000),
      intakeFields: fieldSnapshot,
      intakeProfileId: input.profileId,
      intakeProfileVersion: input.profileVersion,
      collectionStatus,
      lastInteraction: collectionStatus === "complete" ? "Đã thu thập đủ thông tin" : "Đã cập nhật thông tin Lead",
      lastInteractionAt: new Date(),
      ...(!fillMissingOnly ? { lastIntakeMessageId: input.messageId,
        ...(input.messageAt ? { lastIntakeMessageAt: input.messageAt } : {}) } : {}),
    };

    const fallbackName = input.contractIdentity ? `Hợp đồng ${input.contractIdentity.code}` : input.subscriberIdentity ? `Thuê bao ${input.subscriberIdentity.code}`
      : `Khách ${input.conversationId.slice(-6) || "mới"}`;
    const canUpdate = (field: "customerName" | "phone" | "email" | "company" | "productOfChoice" | "value") => {
      const currentValue = current?.[field];
      const missing = currentValue == null || currentValue === "" ||
        (field === "value" && currentValue === 0) || (field === "customerName" && currentValue === fallbackName);
      return !protectedFields.has(field) && (!fillMissingOnly || missing);
    };
    if (!current || (standard.name && canUpdate("customerName"))) {
      const name = (standard.name || fallbackName).slice(0, 200);
      update.customerName = name;
      update.avatar = initials(name);
    }
    if (standard.phone && canUpdate("phone")) update.phone = standard.phone.slice(0, 40);
    if (standard.email && canUpdate("email")) update.email = standard.email.slice(0, 254);
    if (standard.company && canUpdate("company")) update.company = standard.company.slice(0, 200);
    if (standard.productOfChoice && canUpdate("productOfChoice")) update.productOfChoice = standard.productOfChoice.slice(0, 200);
    const budgetField = [...input.fields].reverse().find(field => getIntakeStandardField(field) === "value" && changedAnswers[field.key]);
    const canonicalBudget = (budgetField?.type === "currency" || budgetField?.type === "number") && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(standard.value || "");
    // The typed extractor already stored a canonical decimal string.
    const amount = standard.value ? (canonicalBudget ? parseIntakeNumber(Number(standard.value))
      : parseLeadIntakeAmount(standard.value)) : undefined;
    if (amount !== undefined && canUpdate("value")) update.value = amount;

    try {
      // The answer changes and the message that produced them commit together.
      const result = await CRMTicketModel.findOneAndUpdate(
        current
          ? { ...(!documentIdentity ? identity : { companyCode: identity.companyCode }), _id: current._id, intakeRevision: current.intakeRevision ?? { $exists: false } }
          : { ...identity, intakeRevision: { $exists: false } },
        {
          $set: update,
          $inc: { intakeRevision: 1 },
          ...(!current ? { $setOnInsert: { ...(!documentIdentity ? identity : {
            companyCode: identity.companyCode, sourcePlatform: input.platform, sourceAccountId: input.accountId,
          }), status: "cold" as const, selectedProducts: [] } } : {}),
        },
        { upsert: !current, new: true, runValidators: true },
      ).lean();
      if (result) {
        broadcastEvent("crm_leads_changed", { companyCode: identity.companyCode });
        return result;
      }
    } catch (error) {
      // Another worker or a staff edit may have created or advanced this Lead.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  throw new Error("Lead vừa được cập nhật nhiều lần. Hãy thử lại.");
}
