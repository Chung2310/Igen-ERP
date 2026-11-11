export const LEAD_INTAKE_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "date",
  "phone",
  "email",
  "single_select",
  "multi_select",
  "checkbox",
] as const;

export type LeadIntakeFieldType = typeof LEAD_INTAKE_FIELD_TYPES[number];

export interface LeadIntakeField {
  key: string;
  label: string;
  question: string;
  type?: LeadIntakeFieldType;
  required?: boolean;
  options?: string[];
}

export type LeadCollectionStatus = "collecting" | "complete" | "needs_human";
export type LeadTargetModule = "students" | "healthcare" | "workers";
