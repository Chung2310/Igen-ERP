import type {
  CustomFieldValue,
  CustomFieldValues,
  DynamicFieldType,
  ModuleKey,
} from "../interfaces/custom-field.interface";
import { CustomFieldDefinition } from "../models/custom-field-definition.model";
import {
  isSafeCustomFieldPattern,
  MAX_CUSTOM_FIELD_PATTERN_INPUT_LENGTH,
} from "../utils/custom-field-pattern.util";

export type CustomFieldValueDefinition = {
  key: string;
  label: string;
  type: DynamicFieldType;
  defaultValue?: CustomFieldValue;
  options?: Array<{ label: string; value: string }>;
  validation?: Record<string, unknown>;
  isVisible: boolean;
  isRequired: boolean;
  isArchived: boolean;
};

export type CustomFieldValueRepository = {
  find(filter: { tenantId: string; moduleKey: ModuleKey }):
    | CustomFieldValueDefinition[]
    | PromiseLike<CustomFieldValueDefinition[]>;
};

export type ValidateCustomFieldValuesInput = {
  tenantId: string;
  moduleKey: ModuleKey;
  values: unknown;
  existingValues?: unknown;
  mode: "create" | "update";
};

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const FILE_KEYS = new Set(["url", "fileName", "mimeType", "size", "reference", "uploadToken"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isMissing(value: unknown): boolean {
  return value === null
    || value === undefined
    || (typeof value === "string" && value.trim() === "")
    || (Array.isArray(value) && value.length === 0);
}

function fail(label: string, message: string): never {
  throw new Error(`${label}: ${message}`);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") fail(label, "giá trị phải là chuỗi.");
  return value.trim();
}

function enforceTextConstraints(value: string, definition: CustomFieldValueDefinition): void {
  const validation = definition.validation ?? {};
  const minLength = validation.minLength;
  const maxLength = validation.maxLength;
  if (typeof minLength === "number" && value.length < minLength) {
    fail(definition.label, `giá trị phải có ít nhất ${minLength} ký tự.`);
  }
  if (typeof maxLength === "number" && value.length > maxLength) {
    fail(definition.label, `giá trị chỉ được có tối đa ${maxLength} ký tự.`);
  }
  if (typeof validation.pattern === "string") {
    if (!isSafeCustomFieldPattern(validation.pattern)) {
      fail(definition.label, "cấu hình biểu thức kiểm tra không an toàn.");
    }
    if (value.length > MAX_CUSTOM_FIELD_PATTERN_INPUT_LENGTH) {
      fail(definition.label, "giá trị quá dài để kiểm tra bằng biểu thức.");
    }
    let pattern: RegExp;
    try {
      pattern = new RegExp(validation.pattern);
    } catch {
      fail(definition.label, "cấu hình biểu thức kiểm tra không hợp lệ.");
    }
    if (!pattern.test(value)) fail(definition.label, "giá trị không đúng định dạng yêu cầu.");
  }
}

function decimalPlaces(value: number): number {
  const match = value.toString().match(/\.(\d+)(?:e([+-]?\d+))?$/i);
  if (match) return Math.max(0, match[1].length - Number(match[2] ?? 0));
  const exponent = value.toString().match(/e-(\d+)$/i);
  return exponent ? Number(exponent[1]) : 0;
}

function numericValue(value: unknown, definition: CustomFieldValueDefinition): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(definition.label, "giá trị phải là số hữu hạn.");
  }
  if (definition.type === "percent" && (value < 0 || value > 100)) {
    fail(definition.label, "phần trăm phải nằm trong khoảng 0 đến 100.");
  }
  const validation = definition.validation ?? {};
  if (typeof validation.min === "number" && value < validation.min) {
    fail(definition.label, `giá trị không được nhỏ hơn ${validation.min}.`);
  }
  if (typeof validation.max === "number" && value > validation.max) {
    fail(definition.label, `giá trị không được lớn hơn ${validation.max}.`);
  }
  if (typeof validation.decimals === "number" && decimalPlaces(value) > validation.decimals) {
    fail(definition.label, `giá trị chỉ được có tối đa ${validation.decimals} chữ số thập phân.`);
  }
  return value;
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3]);
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/.test(value);
}

function isValidDateTime(value: string): boolean {
  const datePart = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}T/.test(value)
    && isValidDate(datePart)
    && Number.isFinite(Date.parse(value));
}

function dateValue(value: unknown, definition: CustomFieldValueDefinition): string {
  const normalized = stringValue(value, definition.label);
  const validation = definition.validation ?? {};
  if ((definition.type as string) === "date") {
    if (!isValidDate(normalized)) fail(definition.label, "giá trị ngày không hợp lệ.");
    if (typeof validation.minDate === "string" && normalized < validation.minDate) {
      fail(definition.label, `ngày không được trước ${validation.minDate}.`);
    }
    if (typeof validation.maxDate === "string" && normalized > validation.maxDate) {
      fail(definition.label, `ngày không được sau ${validation.maxDate}.`);
    }
  } else if ((definition.type as string) === "time") {
    if (!isValidTime(normalized)) fail(definition.label, "giá trị giờ không hợp lệ.");
    const comparable = normalized.slice(0, 5);
    if (typeof validation.minTime === "string" && comparable < validation.minTime) {
      fail(definition.label, `giờ không được trước ${validation.minTime}.`);
    }
    if (typeof validation.maxTime === "string" && comparable > validation.maxTime) {
      fail(definition.label, `giờ không được sau ${validation.maxTime}.`);
    }
  } else {
    if (!isValidDateTime(normalized)) fail(definition.label, "giá trị ngày giờ không hợp lệ.");
    const timestamp = Date.parse(normalized);
    if (typeof validation.minDateTime === "string" && timestamp < Date.parse(validation.minDateTime)) {
      fail(definition.label, `ngày giờ không được trước ${validation.minDateTime}.`);
    }
    if (typeof validation.maxDateTime === "string" && timestamp > Date.parse(validation.maxDateTime)) {
      fail(definition.label, `ngày giờ không được sau ${validation.maxDateTime}.`);
    }
  }
  return normalized;
}

function optionValues(definition: CustomFieldValueDefinition): Set<string> {
  return new Set((definition.options ?? []).map(option => option.value));
}

function singleSelectValue(value: unknown, definition: CustomFieldValueDefinition): string {
  const normalized = stringValue(value, definition.label);
  if (!optionValues(definition).has(normalized)) {
    fail(definition.label, "giá trị không thuộc các lựa chọn được phép.");
  }
  return normalized;
}

function multiSelectValue(value: unknown, definition: CustomFieldValueDefinition): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    fail(definition.label, "giá trị phải là danh sách lựa chọn.");
  }
  const normalized = value.map(item => item.trim());
  if (normalized.some(item => !item || !optionValues(definition).has(item))) {
    fail(definition.label, "danh sách chứa lựa chọn không được phép.");
  }
  if (new Set(normalized).size !== normalized.length) {
    fail(definition.label, "các lựa chọn không được trùng nhau.");
  }
  return normalized;
}

type FileValue = { url: string; fileName: string; mimeType?: string; size?: number; reference?: string; uploadToken?: string };

function mimeMatches(allowed: string, actual: string): boolean {
  if (allowed === actual) return true;
  if (allowed.endsWith("/*") && actual.startsWith(allowed.slice(0, -1))) return true;
  if (allowed === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && actual === "application/zip") return true;
  if (allowed === "application/msword" && actual === "application/x-ole-storage") return true;
  return false;
}

function fileValue(value: unknown, definition: CustomFieldValueDefinition): FileValue {
  if (!isPlainObject(value)
    || Object.keys(value).some(key => UNSAFE_KEYS.has(key) || !FILE_KEYS.has(key))
    || typeof value.url !== "string"
    || typeof value.fileName !== "string"
    || !value.url.trim()
    || !value.fileName.trim()) {
    fail(definition.label, "metadata tệp không hợp lệ.");
  }
  if (value.mimeType !== undefined && (typeof value.mimeType !== "string" || !value.mimeType.trim())) {
    fail(definition.label, "định dạng tệp không hợp lệ.");
  }
  if (value.size !== undefined && (typeof value.size !== "number" || !Number.isFinite(value.size) || value.size < 0)) {
    fail(definition.label, "dung lượng tệp không hợp lệ.");
  }
  if (value.reference !== undefined && (typeof value.reference !== "string" || !value.reference.trim())) {
    fail(definition.label, "tham chiếu tệp không hợp lệ.");
  }
  if (value.uploadToken !== undefined && (typeof value.uploadToken !== "string" || !value.uploadToken.trim())) {
    fail(definition.label, "mã upload không hợp lệ.");
  }
  const normalized: FileValue = { url: value.url.trim(), fileName: value.fileName.trim() };
  if (typeof value.mimeType === "string") normalized.mimeType = value.mimeType.trim();
  if (typeof value.size === "number") normalized.size = value.size;
  if (typeof value.reference === "string") normalized.reference = value.reference.trim();
  if (typeof value.uploadToken === "string") normalized.uploadToken = value.uploadToken.trim();

  const validation = definition.validation ?? {};
  const allowedMimeTypes = validation.allowedMimeTypes;
  if (Array.isArray(allowedMimeTypes)
    && allowedMimeTypes.every(item => typeof item === "string")
    && (!normalized.mimeType || !allowedMimeTypes.some(mime => mimeMatches(mime, normalized.mimeType!)))) {
    fail(definition.label, "định dạng tệp không được phép.");
  }
  if (typeof validation.maxSizeMb === "number"
    && normalized.size !== undefined
    && normalized.size > validation.maxSizeMb * 1024 * 1024) {
    fail(definition.label, `dung lượng tệp không được vượt quá ${validation.maxSizeMb} MB.`);
  }
  return normalized;
}

function normalizeValue(value: unknown, definition: CustomFieldValueDefinition): CustomFieldValue {
  switch (definition.type as string) {
    case "text":
    case "shortText":
    case "longText": {
      const normalized = stringValue(value, definition.label);
      enforceTextConstraints(normalized, definition);
      return normalized;
    }
    case "email": {
      const normalized = stringValue(value, definition.label).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail(definition.label, "địa chỉ email không hợp lệ.");
      enforceTextConstraints(normalized, definition);
      return normalized;
    }
    case "phone": {
      const normalized = stringValue(value, definition.label);
      if (!/^\+?[0-9][0-9 ()-]*$/.test(normalized)) fail(definition.label, "số điện thoại không hợp lệ.");
      enforceTextConstraints(normalized, definition);
      return normalized;
    }
    case "url": {
      const normalized = stringValue(value, definition.label);
      try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("unsupported protocol");
      } catch {
        fail(definition.label, "URL không hợp lệ.");
      }
      enforceTextConstraints(normalized, definition);
      return normalized;
    }
    case "number":
    case "percent":
    case "currency":
      return numericValue(value, definition);
    case "date":
    case "time":
    case "dateTime":
      return dateValue(value, definition);
    case "singleSelect":
      return singleSelectValue(value, definition);
    case "multiSelect":
      return multiSelectValue(value, definition);
    case "checkbox":
    case "switch":
      if (typeof value !== "boolean") fail(definition.label, "giá trị phải là boolean.");
      return value;
    case "file":
    case "image":
      return fileValue(value, definition);
    case "multiImage": {
      if (!Array.isArray(value)) fail(definition.label, "giá trị phải là danh sách ảnh.");
      const maxFiles = definition.validation?.maxFiles;
      if (typeof maxFiles === "number" && value.length > maxFiles) {
        fail(definition.label, `chỉ được tải tối đa ${maxFiles} tệp.`);
      }
      return value.map(item => fileValue(item, definition));
    }
  }
}

export function createCustomFieldValueValidator(repository: CustomFieldValueRepository) {
  return async function validateCustomFieldValues(
    input: ValidateCustomFieldValuesInput,
  ): Promise<CustomFieldValues> {
    if (!isPlainObject(input.values)) {
      throw new Error("Giá trị trường tùy chỉnh phải là một đối tượng thuần.");
    }
    if (input.existingValues !== undefined && !isPlainObject(input.existingValues)) {
      throw new Error("Giá trị trường tùy chỉnh hiện có phải là một đối tượng thuần.");
    }
    const keys = Object.keys(input.values);
    if (keys.some(key => UNSAFE_KEYS.has(key))) {
      throw new Error("Giá trị trường tùy chỉnh chứa khóa không an toàn.");
    }

    const definitions = await repository.find({ tenantId: input.tenantId, moduleKey: input.moduleKey });
    if (definitions.some(definition => UNSAFE_KEYS.has(definition.key))) {
      throw new Error("Định nghĩa trường tùy chỉnh chứa khóa không an toàn.");
    }
    const definitionsByKey = new Map(definitions.map(definition => [definition.key, definition]));
    for (const key of keys) {
      if (!definitionsByKey.has(key)) {
        throw new Error(`Trường tùy chỉnh "${key}" không được định nghĩa.`);
      }
    }

    const result = Object.create(null) as CustomFieldValues;
    for (const definition of definitions) {
      if (definition.isArchived || !definition.isVisible) {
        if (input.mode === "update"
          && input.existingValues
          && Object.prototype.hasOwnProperty.call(input.existingValues, definition.key)) {
          result[definition.key] = input.existingValues[definition.key] as CustomFieldValue;
        }
        continue;
      }
      const supplied = Object.prototype.hasOwnProperty.call(input.values, definition.key);
      let value = supplied ? input.values[definition.key] : undefined;
      if (!supplied && input.mode === "create" && !isMissing(definition.defaultValue)) {
        value = definition.defaultValue;
      }
      if (isMissing(value)) {
        if (definition.isRequired) fail(definition.label, "trường này là bắt buộc.");
        continue;
      }
      result[definition.key] = normalizeValue(value, definition);
    }
    return result;
  };
}

export function validateCustomFieldDefaultValue(
  value: CustomFieldValue | undefined,
  definition: CustomFieldValueDefinition,
): CustomFieldValue | undefined {
  if (isMissing(value)) return undefined;
  return normalizeValue(value, definition);
}

const defaultRepository = CustomFieldDefinition as unknown as CustomFieldValueRepository;

export const validateCustomFieldValues = createCustomFieldValueValidator(defaultRepository);
