import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";
import { parseIntakeNumber } from "./intake-number";

const fieldTypes = new Set(["text", "long_text", "number", "currency", "date", "phone", "email", "single_select", "multi_select", "checkbox"]);

function generatedKey(label: string, index: number, used: Set<string>) {
  const base = label.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || `field_${index + 1}`;
  let key = base;
  let suffix = 2;
  while (used.has(key)) {
    const ending = `_${suffix++}`;
    key = `${base.slice(0, 40 - ending.length)}${ending}`;
  }
  return key;
}

export function normalizeIntakeFields(fields: unknown): LeadIntakeField[] | undefined {
  if (!Array.isArray(fields) || fields.length === 0 || fields.length > 30) return undefined;
  const usedKeys = new Set<string>();
  const normalized = fields.map((rawField: unknown, index) => {
    const field = rawField && typeof rawField === "object" ? rawField as Record<string, unknown> : null;
    const label = typeof field?.label === "string" ? field.label.trim() : "";
    const suppliedKey = typeof field?.key === "string" ? field.key.trim() : "";
    const key = suppliedKey || generatedKey(label, index, usedKeys);
    usedKeys.add(key);
    return {
      key,
      label,
      question: typeof field?.question === "string" ? field.question.trim() : "",
      type: typeof field?.type === "string" ? field.type : "text",
      required: field?.required !== false,
      options: Array.isArray(field?.options)
        ? field.options.map((option: unknown) => typeof option === "string" ? option.trim() : "")
        : [],
    };
  });
  const valid = normalized.every(field => /^[a-z][a-z0-9_]{0,39}$/.test(field.key)
    && field.label.length > 0 && field.label.length <= 100
    && field.question.length > 0 && field.question.length <= 300
    && fieldTypes.has(field.type)
    && field.options.length <= 30 && field.options.every(option => option.length > 0 && option.length <= 100)
    && (field.type !== "single_select" && field.type !== "multi_select" || field.options.length >= 2)
    && new Set(field.options.map(option => option.toLocaleLowerCase())).size === field.options.length);
  return valid && new Set(normalized.map(field => field.key)).size === normalized.length
    ? normalized as LeadIntakeField[]
    : undefined;
}

function matchOption(value: string, options: string[]) {
  const normalizedValue = value.trim().toLocaleLowerCase();
  return options.find(option => option.trim().toLocaleLowerCase() === normalizedValue);
}

export function normalizeIntakeValue(field: LeadIntakeField, value: unknown): string | undefined {
  const type = field.type || "text";
  if (type === "checkbox") {
    if (value === true) return "Có";
    if (value === false) return "Không";
    if (typeof value !== "string") return undefined;
    const normalizedValue = value.trim().toLocaleLowerCase();
    if (["true", "yes", "có", "co", "1"].includes(normalizedValue)) return "Có";
    if (["false", "no", "không", "khong", "0"].includes(normalizedValue)) return "Không";
    return undefined;
  }
  if (type === "multi_select") {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;\n]/) : [];
    if (!raw.length || raw.some(item => typeof item !== "string")) return undefined;
    const selected = [...new Set(raw.map(item => matchOption(item, field.options || [])).filter((item): item is string => Boolean(item)))];
    return selected.length === raw.length ? selected.join(", ") : undefined;
  }
  const rawValue = typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  if (!rawValue || rawValue.length > (type === "long_text" ? 3000 : 300)) return undefined;
  if (type === "single_select") return matchOption(rawValue, field.options || []);
  if (type === "number" || type === "currency") {
    const parsed = parseIntakeNumber(typeof value === "number" ? value : rawValue, type === "currency");
    return parsed === undefined ? undefined : String(parsed);
  }
  if (type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawValue) ? rawValue : undefined;
  if (type === "phone") {
    const digits = rawValue.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && /^[+\d\s().-]+$/.test(rawValue) ? rawValue : undefined;
  }
  if (type === "date") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);
    if (!match) return undefined;
    const date = new Date(`${rawValue}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === rawValue ? rawValue : undefined;
  }
  return rawValue;
}
