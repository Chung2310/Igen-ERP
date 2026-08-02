import type {
  CustomFieldValues,
  ModuleKey,
} from "../interfaces/custom-field.interface";
import {
  validateCustomFieldValues,
  type ValidateCustomFieldValuesInput,
} from "./custom-field-value.service";

export type CustomFieldWriteContext = {
  tenantId: string;
  moduleKey: ModuleKey;
  actorRole?: string;
};

export type EntityWriteData = Record<string, unknown>;

export type CustomFieldValueValidator = (
  input: ValidateCustomFieldValuesInput,
) => Promise<CustomFieldValues>;

export class CustomFieldWriteConflictError extends Error {
  readonly status = 409;
  readonly code = "CUSTOM_FIELD_WRITE_CONFLICT";

  constructor() {
    super("Dữ liệu vừa được thay đổi. Vui lòng tải lại và thử lại.");
    this.name = "CustomFieldWriteConflictError";
  }
}

const PROTECTED_ENTITY_KEYS = new Set([
  "companyCode",
  "centerId",
  "tenantId",
  "moduleKey",
  "ownerId",
  "expectedVersion",
]);
const PROTOTYPE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function sanitizeEntityWriteData(data: EntityWriteData): EntityWriteData {
  const sanitized: EntityWriteData = {};
  for (const key of Object.keys(data)) {
    if (PROTOTYPE_KEYS.has(key) || key.startsWith("$") || key.includes(".")) {
      throw new Error(`Khóa cập nhật "${key}" không an toàn.`);
    }
    if (!PROTECTED_ENTITY_KEYS.has(key) && key !== "customFields") {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

function customFieldsOf(entity: unknown): unknown {
  if (typeof entity !== "object" || entity === null) return {};
  return (entity as { customFields?: unknown }).customFields ?? {};
}

export class CustomFieldWriteService {
  constructor(
    private readonly validator: CustomFieldValueValidator = validateCustomFieldValues,
  ) {}

  async prepareCreate(
    context: CustomFieldWriteContext,
    data: EntityWriteData,
  ): Promise<EntityWriteData> {
    const sanitized = sanitizeEntityWriteData(data);
    const customFields = await this.validator({
      tenantId: context.tenantId,
      moduleKey: context.moduleKey,
      values: data.customFields ?? {},
      mode: "create",
    });
    return { ...sanitized, customFields };
  }

  async prepareUpdate(
    context: CustomFieldWriteContext,
    existing: unknown,
    data: EntityWriteData,
  ): Promise<EntityWriteData> {
    const sanitized = sanitizeEntityWriteData(data);
    const merged = {
      ...(customFieldsOf(existing) as Record<string, unknown>),
      ...((data.customFields ?? {}) as Record<string, unknown>),
    };
    const customFields = await this.validator({
      tenantId: context.tenantId,
      moduleKey: context.moduleKey,
      values: merged,
      existingValues: customFieldsOf(existing),
      mode: "update",
    });
    return { ...sanitized, customFields };
  }
}

export function expectedVersionOf(data: EntityWriteData): number | undefined {
  const value = data.expectedVersion;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("Phiên bản dữ liệu cập nhật không hợp lệ.");
  }
  return value;
}

export const customFieldWriteService = new CustomFieldWriteService();
