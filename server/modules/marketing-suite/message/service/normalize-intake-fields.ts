import type { LeadIntakeField } from "../../../../../shared/marketing-suite/lead-intake";

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
