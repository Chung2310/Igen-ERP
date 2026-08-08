export const MODULE_KEYS = ["students", "courses", "batches", "exams", "resources", "partners"] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const DYNAMIC_FIELD_TYPES = [
  "text", "email", "phone", "url", "percent",
  "currency", "dateTime",
  "checkbox", "file", "image",
] as const;
export type DynamicFieldType = typeof DYNAMIC_FIELD_TYPES[number];

export type FieldOption = { label: string; value: string };
export type FileMetadata = { url: string; fileName: string; mimeType?: string; size?: number; reference?: string };
export type CustomFieldValue = string | number | boolean | string[] | FileMetadata | FileMetadata[] | null;
export type CustomFieldValues = Record<string, CustomFieldValue>;

declare const maxSizeMbBrand: unique symbol;
export type MaxSizeMb = number & { readonly [maxSizeMbBrand]: "MaxSizeMb" };

export function createMaxSizeMb(value: number): MaxSizeMb {
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    throw new RangeError("maxSizeMb must be between 1 and 100.");
  }
  return value as MaxSizeMb;
}

export type TextValidation = { minLength?: number; maxLength?: number; pattern?: string };
export type NumericValidation = { min?: number; max?: number; decimals?: number };
export type DateValidation = {
  minDate?: string;
  maxDate?: string;
  minTime?: string;
  maxTime?: string;
  minDateTime?: string;
  maxDateTime?: string;
};
export type FileValidation = { maxSizeMb?: MaxSizeMb; maxFiles?: number; allowedMimeTypes?: string[] };
export type FieldValidation = TextValidation | NumericValidation | DateValidation | FileValidation | Record<string, never>;

export interface FieldDefinition {
  id: string;
  tenantId: string;
  moduleKey: ModuleKey;
  key: string;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  defaultValue?: CustomFieldValue;
  options?: FieldOption[];
  validation?: FieldValidation;
  isVisible: boolean;
  isRequired: boolean;
  isArchived: boolean;
  order: number;
  createdBy: string;
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateFieldInput = {
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  defaultValue?: CustomFieldValue;
  options?: FieldOption[];
  validation?: FieldValidation;
  isVisible?: boolean;
  isRequired?: boolean;
};

export type UpdateFieldInput = Partial<CreateFieldInput> & { order?: number };
