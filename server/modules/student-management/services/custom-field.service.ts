import type { DynamicFieldType, IFieldDefinition, ModuleKey } from "../interfaces/custom-field.interface";
import { CustomFieldDefinition } from "../models/custom-field-definition.model";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { Course } from "../models/course.model";
import { Batch } from "../models/batch.model";
import { Exam } from "../models/exam.model";
import { Resource } from "../models/resource.model";
import { Partner } from "../models/partner.model";
import { WorkerModel } from "../../worker-management/models/worker.model";
import { validateCustomFieldDefaultValue } from "./custom-field-value.service";

export type CustomFieldContext = { tenantId: string; actorId: string };
export type FieldOption = { label: string; value: string };
export type CreateFieldInput = {
  moduleKey: ModuleKey;
  label: string;
  type: DynamicFieldType;
  placeholder?: string;
  defaultValue?: IFieldDefinition["defaultValue"];
  options?: FieldOption[];
  validation?: Record<string, unknown>;
  isVisible?: boolean;
  isRequired?: boolean;
};
export type UpdateFieldInput = Omit<Partial<CreateFieldInput>, "moduleKey"> & { order?: number };

type QueryableModel = {
  find(filter: Record<string, unknown>): { sort(sort: Record<string, 1 | -1>): Promise<IFieldDefinition[]> };
  findOne(filter: Record<string, unknown>): PromiseLike<IFieldDefinition | null> & { sort(sort: Record<string, 1 | -1>): Promise<IFieldDefinition | null> };
  create(input: Record<string, unknown>): Promise<IFieldDefinition>;
  findOneAndUpdate(filter: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>): Promise<IFieldDefinition | null>;
  findOneAndDelete(filter: Record<string, unknown>): PromiseLike<IFieldDefinition | null>;
};
type UserModel = { find(filter: Record<string, unknown>): { select(fields: string): Promise<Array<{ _id: unknown }> > } };
type EntityModel = { exists(filter: Record<string, unknown>): Promise<unknown> };

export type CustomFieldServiceDependencies = {
  fieldDefinitions: QueryableModel;
  users: UserModel;
  entityModels: Record<ModuleKey, EntityModel>;
};

const SELECT_TYPES = new Set<string>(["singleSelect", "multiSelect"]);
const RESERVED_KEYS = new Set([
  "_id", "ownerId", "tenantId", "customFields", "createdAt", "updatedAt",
  "constructor", "prototype", "__proto__",
]);

const defaultDependencies: CustomFieldServiceDependencies = {
  fieldDefinitions: CustomFieldDefinition as unknown as QueryableModel,
  users: User as unknown as UserModel,
  entityModels: {
    students: Student as unknown as EntityModel,
    courses: Course as unknown as EntityModel,
    batches: Batch as unknown as EntityModel,
    exams: Exam as unknown as EntityModel,
    resources: Resource as unknown as EntityModel,
    partners: Partner as unknown as EntityModel,
    workers: WorkerModel as unknown as EntityModel,
  },
};

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

function domainDuplicateError(): Error {
  return new Error("Trường tùy chỉnh này đã bị trùng. Vui lòng thử lại.");
}

function makeKey(label: string): string {
  const words = label
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words.map((word, index) => index === 0 ? word : word[0].toUpperCase() + word.slice(1)).join("");
}

function validateKey(label: string): string {
  const key = makeKey(label);
  const raw = label.trim();
  if (!key) throw new Error("Tên trường không hợp lệ.");
  if (RESERVED_KEYS.has(key) || RESERVED_KEYS.has(raw)) throw new Error("Tên trường này dành riêng cho hệ thống.");
  return key;
}

function normalizeOptions(type: DynamicFieldType, options: FieldOption[] | undefined): FieldOption[] | undefined {
  if (!SELECT_TYPES.has(type)) return undefined;
  const normalized = (options ?? []).map(option => ({ label: option.label?.trim(), value: option.value?.trim() }));
  if (!normalized.length || normalized.some(option => !option.label || !option.value)) {
    throw new Error("Trường lựa chọn phải có ít nhất một lựa chọn hợp lệ.");
  }
  const values = new Set(normalized.map(option => option.value));
  const labels = new Set(normalized.map(option => option.label));
  if (values.size !== normalized.length || labels.size !== normalized.length) {
    throw new Error("Các lựa chọn không được trùng nhau.");
  }
  return normalized as FieldOption[];
}

function mutableValues(input: UpdateFieldInput): Record<string, unknown> {
  const allowed = ["label", "type", "placeholder", "defaultValue", "validation", "isVisible", "isRequired", "order"] as const;
  return Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(input, key)).map(key => [key, input[key]]));
}

const VALIDATION_KEYS: Record<DynamicFieldType, Set<string>> & Record<string, Set<string>> = {
  text: new Set(["minLength", "maxLength", "pattern"]),
  shortText: new Set(["minLength", "maxLength", "pattern"]),
  longText: new Set(["minLength", "maxLength", "pattern"]),
  email: new Set(["minLength", "maxLength", "pattern"]), phone: new Set(["minLength", "maxLength", "pattern"]), url: new Set(["minLength", "maxLength", "pattern"]),
  number: new Set(["min", "max", "decimals"]), percent: new Set(["min", "max", "decimals"]), currency: new Set(["min", "max", "decimals"]),
  date: new Set(["minDate", "maxDate"]), time: new Set(["minTime", "maxTime"]), dateTime: new Set(["minDateTime", "maxDateTime"]),
  singleSelect: new Set(), multiSelect: new Set(), checkbox: new Set(), switch: new Set(),
  file: new Set(["maxSizeMb", "allowedMimeTypes"]), image: new Set(["maxSizeMb", "allowedMimeTypes"]), multiImage: new Set(["maxSizeMb", "maxFiles", "allowedMimeTypes"]),
};

function validateMergedConfiguration(field: IFieldDefinition, input: UpdateFieldInput, targetType: DynamicFieldType, options?: FieldOption[]): void {
  const validation = (input.validation ?? (input.type && input.type !== field.type ? {} : field.validation) ?? {}) as Record<string, unknown>;
  const invalidKey = Object.keys(validation).find(key => !VALIDATION_KEYS[targetType].has(key));
  if (invalidKey) throw new Error(`Cấu hình kiểm tra "${invalidKey}" không hợp lệ cho loại trường ${targetType}.`);

  for (const [minKey, maxKey] of [["minLength", "maxLength"], ["min", "max"], ["minDate", "maxDate"], ["minTime", "maxTime"], ["minDateTime", "maxDateTime"]] as const) {
    const min = validation[minKey];
    const max = validation[maxKey];
    if (min !== undefined && max !== undefined && min > max) {
      throw new Error(`Giới hạn ${minKey} không được lớn hơn ${maxKey}.`);
    }
  }

  const defaultValue = Object.prototype.hasOwnProperty.call(input, "defaultValue") ? input.defaultValue : field.defaultValue;
  validateCustomFieldDefaultValue(defaultValue, {
    key: field.key,
    label: input.label ?? field.label,
    type: targetType,
    options,
    validation,
    isVisible: input.isVisible ?? field.isVisible,
    isRequired: input.isRequired ?? field.isRequired,
    isArchived: field.isArchived,
  });
}

export class CustomFieldService {
  constructor(private readonly dependencies: CustomFieldServiceDependencies = defaultDependencies) {}

  async list(tenantId: string, moduleKey: ModuleKey, includeArchived = false): Promise<IFieldDefinition[]> {
    const filter: Record<string, unknown> = { tenantId, moduleKey };
    if (!includeArchived) filter.isArchived = false;
    return this.dependencies.fieldDefinitions.find(filter).sort({ order: 1 });
  }

  async create(context: CustomFieldContext, input: CreateFieldInput): Promise<IFieldDefinition> {
    const key = validateKey(input.label);
    const options = normalizeOptions(input.type, input.options);
    const existing = await this.dependencies.fieldDefinitions.find({ tenantId: context.tenantId, moduleKey: input.moduleKey }).sort({ order: -1 });
    const usedKeys = new Set(existing.map(field => field.key));
    let candidate = key;
    let suffix = 2;
    while (usedKeys.has(candidate)) candidate = `${key}${suffix++}`;
    const order = existing.length ? Math.max(...existing.map(field => field.order ?? 0)) + 1 : 1;
    const document: Record<string, unknown> = {
      tenantId: context.tenantId, moduleKey: input.moduleKey, key: candidate, label: input.label.trim(), type: input.type,
      isVisible: input.isVisible ?? true, isRequired: input.isVisible === false ? false : (input.isRequired ?? false),
      isArchived: false, order, createdBy: context.actorId, updatedBy: context.actorId,
    };
    for (const key of ["placeholder", "defaultValue", "validation"] as const) if (input[key] !== undefined) document[key] = input[key];
    if (options) document.options = options;
    try {
      return await this.dependencies.fieldDefinitions.create(document);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw domainDuplicateError();
      throw error;
    }
  }

  async update(context: CustomFieldContext, moduleKey: ModuleKey, id: string, input: UpdateFieldInput): Promise<IFieldDefinition> {
    const field = await this.dependencies.fieldDefinitions.findOne({ _id: id, tenantId: context.tenantId, moduleKey });
    if (!field) throw new Error("Không tìm thấy trường tùy chỉnh.");
    const targetType = input.type ?? field.type;
    if (input.type && input.type !== field.type && await this.hasStoredValues(context.tenantId, field.moduleKey, field.key)) {
      throw new Error("Không thể thay đổi loại trường khi đã có dữ liệu lưu trữ.");
    }
    if (input.label !== undefined) validateKey(input.label);
    const update = mutableValues(input);
    if (input.type && input.type !== field.type && input.validation === undefined) update.validation = {};
    if (update.isVisible === false) update.isRequired = false;
    const options = normalizeOptions(targetType, input.options ?? field.options);
    validateMergedConfiguration(field, input, targetType, options);
    if (options) update.options = options;
    const operation: Record<string, unknown> = { $set: { ...update, updatedBy: context.actorId } };
    if (!options) operation.$unset = { options: 1 };
    try {
      const updated = await this.dependencies.fieldDefinitions.findOneAndUpdate({ _id: id, tenantId: context.tenantId, moduleKey }, operation, { new: true, runValidators: true });
      if (!updated) throw new Error("Không tìm thấy trường tùy chỉnh.");
      return updated;
    } catch (error) {
      if (isDuplicateKeyError(error)) throw domainDuplicateError();
      throw error;
    }
  }

  async archive(context: CustomFieldContext, moduleKey: ModuleKey, id: string): Promise<IFieldDefinition> {
    const updated = await this.dependencies.fieldDefinitions.findOneAndUpdate(
      { _id: id, tenantId: context.tenantId, moduleKey },
      { $set: { isArchived: true, isVisible: false, isRequired: false, updatedBy: context.actorId } },
      { new: true, runValidators: true },
    );
    if (!updated) throw new Error("Không tìm thấy trường tùy chỉnh.");
    return updated;
  }

  async restore(context: CustomFieldContext, moduleKey: ModuleKey, id: string): Promise<IFieldDefinition> {
    const updated = await this.dependencies.fieldDefinitions.findOneAndUpdate(
      { _id: id, tenantId: context.tenantId, moduleKey },
      { $set: { isArchived: false, isVisible: true, isRequired: false, updatedBy: context.actorId } },
      { new: true, runValidators: true },
    );
    if (!updated) throw new Error("Không tìm thấy trường tùy chỉnh.");
    return updated;
  }

  async delete(context: CustomFieldContext, moduleKey: ModuleKey, id: string): Promise<void> {
    const deleted = await this.dependencies.fieldDefinitions.findOneAndDelete({ _id: id, tenantId: context.tenantId, moduleKey });
    if (!deleted) throw new Error("Không tìm thấy trường tùy chỉnh.");
  }

  async hasStoredValues(tenantId: string, moduleKey: ModuleKey, key: string): Promise<boolean> {
    const users = await this.dependencies.users.find({ companyCode: tenantId }).select("_id");
    const ownerIds = users.map(user => String(user._id));
    if (!ownerIds.length) return false;
    const valuePath = `customFields.${key}`;
    const found = await this.dependencies.entityModels[moduleKey].exists({
      ownerId: { $in: ownerIds },
      [valuePath]: { $exists: true, $nin: [null, "", []] },
    });
    return Boolean(found);
  }
}
