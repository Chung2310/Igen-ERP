import { CRMTicketModel } from "../model/crm-ticket.model";
import type { ILeadIntakeFieldSnapshot } from "../interface/crm-ticket.interface";
import type { LeadCollectionStatus, LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";

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
  const parsed = Number(value.trim().replace(/[\s,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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

export async function upsertLeadFromIntake(input: {
  companyCode: string;
  platform: IntakePlatform;
  accountId: string;
  conversationId: string;
  profileId: string;
  profileVersion: number;
  fields: LeadIntakeField[];
  values: Record<string, string>;
  collectionStatus: LeadCollectionStatus;
}) {
  const companyCode = input.companyCode.trim().toUpperCase();
  const sourceAccountId = input.accountId.trim();
  const sourceConversationId = input.conversationId.trim();
  const identity = { companyCode, sourcePlatform: input.platform, sourceAccountId, sourceConversationId };
  const current = await CRMTicketModel.findOne(identity).select("customerName phone email company productOfChoice value").lean();
  const answers = Object.fromEntries(input.fields
    .map(field => [field.key, String(input.values[field.key] || "").trim()])
    .filter(([, value]) => value));
  const fieldSnapshot: ILeadIntakeFieldSnapshot[] = input.fields.map(field => ({
    key: field.key,
    label: field.label,
    question: field.question,
    type: field.type || "text",
    required: field.required !== false,
    options: field.options || [],
  }));

  const standard = mapIntakeStandardFields(input.fields, answers);
  const customerName = standard.name || current?.customerName || `Khách ${sourceConversationId.slice(-6) || "mới"}`;
  const update: Record<string, unknown> = {
    customerName: customerName.slice(0, 200),
    avatar: initials(customerName),
    answers,
    intakeSearchText: Object.values(answers).join(" ").slice(0, 100000),
    intakeFields: fieldSnapshot,
    sourcePlatform: input.platform,
    sourceAccountId,
    sourceConversationId,
    intakeProfileId: input.profileId,
    intakeProfileVersion: input.profileVersion,
    collectionStatus: input.collectionStatus,
    lastInteraction: input.collectionStatus === "complete" ? "Đã thu thập đủ thông tin" : "Đang thu thập thông tin",
    lastInteractionAt: new Date(),
  };
  if (standard.phone) update.phone = standard.phone.slice(0, 40);
  if (standard.email) update.email = standard.email.slice(0, 254);
  if (standard.company) update.company = standard.company.slice(0, 200);
  if (standard.productOfChoice) update.productOfChoice = standard.productOfChoice.slice(0, 200);
  if (standard.value) {
    const amount = parseLeadIntakeAmount(standard.value);
    if (amount !== undefined) update.value = amount;
  }

  const createDefaults = {
    status: "cold" as const,
    companyCode,
    selectedProducts: [],
  };
  let lead: { _id?: unknown } | null;
  try {
    lead = await CRMTicketModel.findOneAndUpdate(identity, {
      $set: update,
      $setOnInsert: createDefaults,
    }, { upsert: true, new: true, runValidators: true }).select("_id").lean();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    lead = await CRMTicketModel.findOneAndUpdate(identity, { $set: update }, { new: true, runValidators: true }).select("_id").lean();
  }
  return lead;
}
