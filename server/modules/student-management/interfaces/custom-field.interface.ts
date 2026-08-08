import { Document } from "mongoose";

export const MODULE_KEYS = ["students", "courses", "batches", "exams", "resources", "partners", "workers"] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const DYNAMIC_FIELD_TYPES = [
  "text", "email", "phone", "url", "percent",
  "currency", "dateTime",
  "checkbox", "file", "image",
] as const;
export type DynamicFieldType = typeof DYNAMIC_FIELD_TYPES[number];

export type CustomFieldValue = string | number | boolean | string[] |
  { url: string; fileName: string; mimeType?: string; size?: number; reference?: string } |
  Array<{ url: string; fileName: string; mimeType?: string; size?: number; reference?: string }> | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

export interface IFieldDefinition extends Document {
  tenantId: string;
  moduleKey: ModuleKey;
  key: string;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  defaultValue?: CustomFieldValue;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
  isVisible: boolean;
  isRequired: boolean;
  isArchived: boolean;
  order: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}
