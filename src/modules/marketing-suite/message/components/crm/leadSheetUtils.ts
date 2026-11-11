import type { LeadCollectionStatus, LeadIntakeFieldType } from "../../../../../../shared/marketing-suite/lead-intake";
import type { ExtendedLeadCard } from "../../services/crmService";

export type LeadSocialPlatform = "facebook" | "zalo" | "tiktok";

export interface LeadAccountOption {
  id: string;
  platform: LeadSocialPlatform;
  accountId: string;
  displayName: string;
  isMock?: boolean;
}

export interface LeadSheetColumn {
  key: string;
  answerKey?: string;
  label: string;
  type: LeadIntakeFieldType;
  required?: boolean;
  question?: string;
  options?: string[];
  kind: "system" | "intake";
  platform?: LeadSocialPlatform;
  accountId?: string;
  profileId?: string;
  defaultWidth: number;
  editable: boolean;
  sortable?: boolean;
  sortKey?: string;
}

export const FIELD_TYPE_META: Record<LeadIntakeFieldType, { label: string; shortLabel: string }> = {
  text: { label: "Văn bản ngắn", shortLabel: "Văn bản" },
  long_text: { label: "Văn bản dài", shortLabel: "Đoạn văn" },
  number: { label: "Số", shortLabel: "Số" },
  currency: { label: "Tiền tệ", shortLabel: "Tiền tệ" },
  date: { label: "Ngày", shortLabel: "Ngày" },
  phone: { label: "Số điện thoại", shortLabel: "SĐT" },
  email: { label: "Email", shortLabel: "Email" },
  single_select: { label: "Chọn một", shortLabel: "Chọn 1" },
  multi_select: { label: "Chọn nhiều", shortLabel: "Chọn nhiều" },
  checkbox: { label: "Có / Không", shortLabel: "Có/Không" },
};

export const COLLECTION_STATUS_META: Record<LeadCollectionStatus, { label: string; badgeClass: string }> = {
  collecting: { label: "Đang thu thập", badgeClass: "bg-tertiary-container text-on-tertiary-container" },
  complete: { label: "Đủ thông tin", badgeClass: "bg-primary-container text-on-primary-container" },
  needs_human: { label: "Chờ nhân viên", badgeClass: "bg-error-container text-on-error-container" },
};

export const LEAD_STATUS_META: Record<ExtendedLeadCard["status"], { label: string; badgeClass: string }> = {
  cold: { label: "Mới", badgeClass: "bg-surface-container text-on-surface-variant" },
  warm: { label: "Quan tâm", badgeClass: "bg-tertiary-container text-on-tertiary-container" },
  hot: { label: "Tiềm năng cao", badgeClass: "bg-error-container text-on-error-container" },
  won: { label: "Đã chốt", badgeClass: "bg-primary-container text-on-primary-container" },
  upsell: { label: "Bán thêm", badgeClass: "bg-secondary-container text-on-secondary-container" },
};

export const PLATFORM_LABELS: Record<LeadSocialPlatform, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  tiktok: "TikTok",
};

export function toIntakeFieldKey(label: string, existingKeys?: ReadonlySet<string>): string {
  const ascii = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let base = /^[a-z]/.test(ascii) ? ascii : `truong_${ascii || "thong_tin"}`;
  base = base.slice(0, 36).replace(/_+$/g, "") || "truong_thong_tin";
  if (!existingKeys || !existingKeys.has(base)) return base;
  let index = 2;
  while (existingKeys.has(`${base.slice(0, 34)}_${index}`)) index += 1;
  return `${base.slice(0, 34)}_${index}`;
}

export function defaultBotQuestion(label: string, type: LeadIntakeFieldType = "text"): string {
  const clean = label.trim();
  if (!clean) return "Anh/chị cho em xin thêm thông tin để tiện tư vấn ạ?";
  if (type === "phone") return "Anh/chị cho em xin số điện thoại liên hệ ạ?";
  if (type === "email") return "Anh/chị cho em xin địa chỉ email để gửi thông tin ạ?";
  if (type === "date") return `Anh/chị dự kiến ${clean.toLowerCase()} vào ngày nào ạ?`;
  if (type === "single_select" || type === "multi_select") return `Anh/chị quan tâm mục ${clean.toLowerCase()} nào ạ?`;
  if (type === "checkbox") return `Anh/chị xác nhận ${clean.toLowerCase()} không ạ?`;
  return `Anh/chị cho em xin thông tin về ${clean.toLowerCase()} ạ?`;
}

export function formatCurrencyVnd(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").replace(/[\s,]/g, ""));
  if (!Number.isFinite(numeric)) return String(value ?? "");
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(numeric)} đ`;
}

export function formatLeadCellDisplay(value: string, type?: LeadIntakeFieldType): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (type === "currency") return formatCurrencyVnd(trimmed);
  if (type === "number") {
    const numeric = Number(trimmed.replace(/[\s,]/g, ""));
    return Number.isFinite(numeric) ? new Intl.NumberFormat("vi-VN").format(numeric) : trimmed;
  }
  if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-");
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}

export function parseMultiSelectValue(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function leadHasIntakeField(lead: ExtendedLeadCard, field: Pick<LeadSheetColumn, "key" | "answerKey" | "platform" | "accountId">) {
  if (field.accountId && (field.accountId !== lead.sourceAccountId || field.platform !== lead.sourcePlatform)) {
    return false;
  }
  const targetKey = field.answerKey || field.key;
  return Boolean(
    lead.intakeFields?.some(snapshot => snapshot.key === targetKey)
    || (lead.answers && Object.prototype.hasOwnProperty.call(lead.answers, targetKey) && Boolean(lead.answers[targetKey]?.trim()))
  );
}

export function leadIntakeSummaryText(lead: ExtendedLeadCard): string {
  const fields = lead.intakeFields || [];
  const entries = fields
    .map(field => {
      const value = lead.answers?.[field.key]?.trim();
      return value ? `${field.label}: ${formatLeadCellDisplay(value, field.type)}` : "";
    })
    .filter(Boolean);
  if (entries.length > 0) return entries.join(" · ");
  const rawEntries = Object.entries(lead.answers || {})
    .filter(([key, value]) => !key.startsWith("__") && value.trim())
    .map(([key, value]) => `${key}: ${value}`);
  return rawEntries.join(" · ");
}

function safeExcelCell(value: unknown) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ");
  return /^[=+@\-]/.test(text) ? `'${text}` : text;
}

export async function downloadLeadsExcel(leads: ExtendedLeadCard[], fields: LeadSheetColumn[]) {
  const XLSX = await import("xlsx");
  const intakeColumns = fields.filter(col => col.kind === "intake");
  const headers = [
    "Họ tên",
    "Số điện thoại",
    "Email",
    "Doanh nghiệp",
    "Kênh",
    "Tài khoản nguồn",
    "Trạng thái xử lý",
    "Giá trị dự kiến",
    "Tình trạng thu thập",
    "Module đã đồng bộ",
    ...intakeColumns.map(field => field.label),
  ];
  const rows = leads.map(lead => [
    lead.customerName,
    lead.phone,
    lead.email,
    lead.company,
    lead.sourcePlatform || "Thủ công",
    lead.sourceAccountId || "",
    LEAD_STATUS_META[lead.status]?.label || lead.status,
    Number(lead.value) || 0,
    lead.collectionStatus ? COLLECTION_STATUS_META[lead.collectionStatus].label : "Chưa cấu hình",
    lead.moduleSync?.targetModule || "",
    ...intakeColumns.map(field => leadHasIntakeField(lead, field) ? lead.answers?.[field.answerKey || field.key] || "" : ""),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows].map(row => row.map(safeExcelCell)));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Leads");
  XLSX.writeFile(book, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export const DEFAULT_HIDDEN_SYSTEM_COLUMNS = [
  "phone",
  "sourceChannel",
  "collectionStatus",
  "status",
  "value",
  "email",
  "company",
  "updatedAt",
];

const NAME_FIELD_ALIASES = new Set([
  "name",
  "full name",
  "customer name",
  "ho ten",
  "ho va ten",
  "ten khach hang",
  "ten lien he",
  "khach hang",
  "ten",
]);

function normalizeFieldToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isNameField(field: { key: string; label?: string }): boolean {
  return NAME_FIELD_ALIASES.has(normalizeFieldToken(field.key))
    || Boolean(field.label && NAME_FIELD_ALIASES.has(normalizeFieldToken(field.label)));
}

export interface SheetLayoutPrefs {
  widths: Record<string, number>;
  hiddenKeys: string[];
}

export function loadSheetLayout(scopeKey: string): SheetLayoutPrefs {
  try {
    const raw = localStorage.getItem(`crm_lead_sheet_v2_layout_${scopeKey}`);
    if (!raw) return { widths: {}, hiddenKeys: [...DEFAULT_HIDDEN_SYSTEM_COLUMNS] };
    const parsed = JSON.parse(raw) as Partial<SheetLayoutPrefs>;
    return {
      widths: parsed.widths && typeof parsed.widths === "object" ? parsed.widths : {},
      hiddenKeys: Array.isArray(parsed.hiddenKeys)
        ? parsed.hiddenKeys.filter((k): k is string => typeof k === "string")
        : [...DEFAULT_HIDDEN_SYSTEM_COLUMNS],
    };
  } catch {
    return { widths: {}, hiddenKeys: [...DEFAULT_HIDDEN_SYSTEM_COLUMNS] };
  }
}

export function saveSheetLayout(scopeKey: string, layout: SheetLayoutPrefs) {
  try {
    localStorage.setItem(`crm_lead_sheet_v2_layout_${scopeKey}`, JSON.stringify(layout));
  } catch {
    // Ignore storage quota errors in restricted browsers.
  }
}
