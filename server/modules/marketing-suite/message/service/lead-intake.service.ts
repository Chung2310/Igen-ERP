import { CRMTicketModel } from "../model/crm-ticket.model";
import type { ILeadIntakeFieldSnapshot } from "../interface/crm-ticket.interface";
import type { LeadCollectionStatus, LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { parseIntakeNumber } from "./intake-number";

type IntakePlatform = "facebook" | "zalo" | "tiktok";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const fieldAliases = new Map<string, string>([
  ["name", "name"], ["full name", "name"], ["customer name", "name"], ["ho ten", "name"], ["ho va ten", "name"], ["ten khach hang", "name"], ["ten lien he", "name"], ["khach hang", "name"], ["ten", "name"],
  ["phone", "phone"], ["phone number", "phone"], ["mobile", "phone"], ["so dien thoai", "phone"], ["dien thoai", "phone"], ["sdt", "phone"],
  ["email", "email"], ["customer email", "email"], ["thu dien tu", "email"],
  ["company", "company"], ["company name", "company"], ["business", "company"], ["ten cong ty", "company"], ["cong ty", "company"],
  ["product", "productOfChoice"], ["product of choice", "productOfChoice"], ["san pham", "productOfChoice"], ["dich vu", "productOfChoice"], ["nhu cau", "productOfChoice"],
  ["budget", "value"], ["estimated budget", "value"], ["ngan sach", "value"], ["gia tri du kien", "value"],
]);

function initials(value: string) {
  return value.trim().split(/\s+/).slice(-2).map(part => part[0]?.toUpperCase()).join("") || "KH";
}

function standardField(field: { key: string; label: string; type?: string }) {
  return fieldAliases.get(normalized(field.key))
    || fieldAliases.get(normalized(field.label))
    || (field.type === "phone" ? "phone" : field.type === "email" ? "email" : undefined);
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
    const target = standardField(field);
    if (answer && target) standard[target] = answer;
  }
  return standard;
}

type LeadIntakeIdentity = {
  companyCode: string;
  platform: IntakePlatform;
  accountId: string;
  conversationId: string;
};

function intakeIdentity(input: LeadIntakeIdentity) {
  return {
    companyCode: input.companyCode.trim().toUpperCase(),
    sourcePlatform: input.platform,
    sourceAccountId: input.accountId.trim(),
    sourceConversationId: input.conversationId.trim(),
  };
}

export function findLeadForIntake(input: LeadIntakeIdentity) {
  return CRMTicketModel.findOne(intakeIdentity(input))
    .select("customerName phone email company avatar productOfChoice value answers intakeRevision intakeStaffFields lastIntakeMessageId lastIntakeMessageAt collectionStatus")
    .lean();
}

export async function upsertLeadFromIntake(input: LeadIntakeIdentity & {
  profileId: string;
  profileVersion: number;
  fields: LeadIntakeField[];
  values: Record<string, string>;
  previousValues: Record<string, string>;
  allowCreate: boolean;
  messageId: string;
  messageAt?: Date;
  fillMissingOnly?: boolean;
  preserveNewerValues?: boolean;
}) {
  const identity = intakeIdentity(input);
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
    if (!Object.keys(changedAnswers).length) return current;

    const standard = mapIntakeStandardFields(input.fields, changedAnswers);
    const complete = input.fields.every(field => field.required === false || Boolean(answers[field.key]?.trim()));
    const collectionStatus = current?.collectionStatus === "needs_human" ? "needs_human" : complete ? "complete" : "collecting";
    const changedAnswerPaths = Object.fromEntries(Object.entries(changedAnswers).map(([key, value]) => [`answers.${key}`, value]));
    const update: Record<string, unknown> = {
      ...(current ? changedAnswerPaths : { answers }),
      intakeSearchText: Object.values(answers).join(" ").slice(0, 100000),
      intakeFields: fieldSnapshot,
      intakeProfileId: input.profileId,
      intakeProfileVersion: input.profileVersion,
      collectionStatus,
      lastInteraction: collectionStatus === "complete" ? "Đã thu thập đủ thông tin" : "Đã cập nhật thông tin Lead",
      lastInteractionAt: new Date(),
      ...(!fillMissingOnly ? { lastIntakeMessageId: input.messageId,
        ...(input.messageAt ? { lastIntakeMessageAt: input.messageAt } : {}) } : {}),
    };

    const fallbackName = `Khách ${identity.sourceConversationId.slice(-6) || "mới"}`;
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
    const budgetField = [...input.fields].reverse().find(field => standardField(field) === "value" && changedAnswers[field.key]);
    const canonicalBudget = (budgetField?.type === "currency" || budgetField?.type === "number") && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/.test(standard.value || "");
    // The typed extractor already stored a canonical decimal string.
    const amount = standard.value ? (canonicalBudget ? parseIntakeNumber(Number(standard.value))
      : parseLeadIntakeAmount(standard.value)) : undefined;
    if (amount !== undefined && canUpdate("value")) update.value = amount;

    try {
      // The answer changes and the message that produced them commit together.
      const result = await CRMTicketModel.findOneAndUpdate(
        current
          ? { ...identity, _id: current._id, intakeRevision: current.intakeRevision ?? { $exists: false } }
          : { ...identity, intakeRevision: { $exists: false } },
        {
          $set: update,
          $inc: { intakeRevision: 1 },
          ...(!current ? { $setOnInsert: { ...identity, status: "cold" as const, selectedProducts: [] } } : {}),
        },
        { upsert: !current, new: true, runValidators: true },
      ).lean();
      if (result) return result;
    } catch (error) {
      // Another worker or a staff edit may have created or advanced this Lead.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  throw new Error("Lead vừa được cập nhật nhiều lần. Hãy thử lại.");
}
