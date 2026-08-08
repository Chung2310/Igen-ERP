import assert from "node:assert/strict";
import test from "node:test";
import { CustomFieldService, type CustomFieldServiceDependencies } from "./custom-field.service";

type Field = Record<string, any>;

function matches(value: unknown, condition: unknown): boolean {
  if (condition && typeof condition === "object") {
    const operators = condition as { $in?: unknown[]; $nin?: unknown[]; $exists?: boolean };
    if (operators.$exists !== undefined && (value !== undefined) !== operators.$exists) return false;
    if (operators.$in && !operators.$in.includes(value)) return false;
    if (operators.$nin && operators.$nin.some(disallowed => JSON.stringify(disallowed) === JSON.stringify(value))) return false;
    if (operators.$in || operators.$nin || operators.$exists !== undefined) return true;
  }
  return value === condition;
}

function createDependencies(fields: Field[] = [], storedValues: Field[] = []): {
  dependencies: CustomFieldServiceDependencies;
  fields: Field[];
  calls: { users: Field[]; entities: Field[] };
} {
  const calls = { users: [] as Field[], entities: [] as Field[] };
  const definitionModel = {
    find(filter: Field) {
      return {
        sort: async (sort: Field) => fields
          .filter(field => Object.entries(filter).every(([key, value]) => matches(field[key], value)))
          .sort((a, b) => sort.order ? (sort.order as number) * (a.order - b.order) : 0),
      };
    },
    findOne(filter: Field) {
      const result = fields.find(field => Object.entries(filter).every(([key, value]) => matches(field[key], value))) ?? null;
      return { sort: async () => result, then: (resolve: (value: Field | null) => unknown) => Promise.resolve(result).then(resolve) };
    },
    async create(input: Field) {
      const duplicate = fields.some(field => field.tenantId === input.tenantId && field.moduleKey === input.moduleKey && field.key === input.key);
      if (duplicate) throw Object.assign(new Error("duplicate"), { code: 11000 });
      const created = { _id: String(fields.length + 1), ...input };
      fields.push(created);
      return created;
    },
    async findOneAndUpdate(filter: Field, update: Field) {
      const field = fields.find(candidate => Object.entries(filter).every(([key, value]) => matches(candidate[key], value))) ?? null;
      if (!field) return null;
      Object.assign(field, update.$set);
      return field;
    },
  };
  const userModel = {
    find(filter: Field) {
      calls.users.push(filter);
      return { select: async () => [{ _id: "owner-a" }, { _id: "owner-b" }] };
    },
  };
  const entityModel = {
    async exists(filter: Field) {
      calls.entities.push(filter);
      return storedValues.some(row => Object.entries(filter).every(([key, value]) => {
        if (key === "ownerId") return matches(row.ownerId, value);
        if (key.startsWith("customFields.")) return matches(row.customFields?.[key.slice("customFields.".length)], value);
        return matches(row[key], value);
      })) ? { _id: "entity" } : null;
    },
  };

  return {
    dependencies: {
      fieldDefinitions: definitionModel as any,
      users: userModel as any,
      entityModels: {
        students: entityModel as any, courses: entityModel as any, batches: entityModel as any,
        exams: entityModel as any, resources: entityModel as any, partners: entityModel as any,
      },
    },
    fields,
    calls,
  };
}

const context = { tenantId: "tenant-a", actorId: "actor-a" };
const selectOptions = [{ label: "Mới", value: "new" }, { label: "Cũ", value: "old" }];

test("creates a Vietnamese label with a stable camelCase ASCII key", async () => {
  const { dependencies } = createDependencies();
  const created = await new CustomFieldService(dependencies).create(context, { moduleKey: "students", label: "Địa chỉ liên hệ", type: "text" });
  assert.equal(created.key, "diaChiLienHe");
});

test("suffixes a colliding key and sets the next order across archived fields", async () => {
  const { dependencies } = createDependencies([
    { _id: "1", tenantId: "tenant-a", moduleKey: "students", key: "diaChi", order: 2, isArchived: false },
    { _id: "2", tenantId: "tenant-a", moduleKey: "students", key: "other", order: 7, isArchived: true },
  ]);
  const created = await new CustomFieldService(dependencies).create(context, { moduleKey: "students", label: "Địa chỉ", type: "text" });
  assert.equal(created.key, "diaChi2");
  assert.equal(created.order, 8);
});

test("lists active fields by default and includes archived fields on request", async () => {
  const { dependencies } = createDependencies([
    { tenantId: "tenant-a", moduleKey: "courses", key: "active", order: 2, isArchived: false },
    { tenantId: "tenant-a", moduleKey: "courses", key: "archived", order: 1, isArchived: true },
  ]);
  const service = new CustomFieldService(dependencies);
  assert.deepEqual((await service.list("tenant-a", "courses")).map(field => field.key), ["active"]);
  assert.deepEqual((await service.list("tenant-a", "courses", true)).map(field => field.key), ["archived", "active"]);
});

test("makes hidden fields optional and archives/restores without hard deletion", async () => {
  const { dependencies, fields } = createDependencies([{ _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "note", type: "text", isVisible: true, isRequired: true, isArchived: false }]);
  const service = new CustomFieldService(dependencies);
  const hidden = await service.update(context, "students", "field-1", { isVisible: false, isRequired: true });
  assert.equal(hidden.isRequired, false);
  const archived = await service.archive(context, "students", "field-1");
  assert.equal(archived.isArchived, true);
  assert.equal(archived.isVisible, false);
  assert.equal(archived.isRequired, false);
  const restored = await service.restore(context, "students", "field-1");
  assert.equal(restored.isArchived, false);
  assert.equal(restored.isVisible, true);
  assert.equal(restored.isRequired, false);
  assert.equal(fields.length, 1);
});

test("blocks a type change only when the field has stored values", async () => {
  const withValues = createDependencies([{ _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "score", type: "number" }], [{ ownerId: "owner-a", customFields: { score: 0 } }]);
  await assert.rejects(() => new CustomFieldService(withValues.dependencies).update(context, "students", "field-1", { type: "text" }), /không thể thay đổi loại/i);
  const withoutValues = createDependencies([{ _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "score", type: "number" }]);
  const updated = await new CustomFieldService(withoutValues.dependencies).update(context, "students", "field-1", { type: "text" });
  assert.equal(updated.type, "text");
});

test("uses only the fixed selected module registry and scopes values to tenant owners", async () => {
  const { dependencies, calls } = createDependencies([], [{ ownerId: "owner-b", customFields: { level: false } }]);
  const hasValues = await new CustomFieldService(dependencies).hasStoredValues("tenant-a", "partners", "level");
  assert.equal(hasValues, true);
  assert.deepEqual(calls.users[0], { companyCode: "tenant-a" });
  assert.deepEqual(calls.entities[0], { ownerId: { $in: ["owner-a", "owner-b"] }, "customFields.level": { $exists: true, $nin: [null, "", []] } });
});

test("treats false and zero as stored values, while null, empty strings, and empty arrays are absent", async () => {
  for (const [value, expected] of [[false, true], [0, true], [null, false], ["", false], [[], false]] as const) {
    const { dependencies } = createDependencies([], [{ ownerId: "owner-a", customFields: { value } }]);
    assert.equal(await new CustomFieldService(dependencies).hasStoredValues("tenant-a", "students", "value"), expected);
  }
});

test("requires unique non-empty select options and removes options from non-select fields", async () => {
  const { dependencies } = createDependencies();
  const service = new CustomFieldService(dependencies);
  await assert.rejects(() => service.create(context, { moduleKey: "students", label: "Trạng thái", type: "multiSelect" as any, options: [{ label: "", value: "new" }] }), /lựa chọn/i);
  await assert.rejects(() => service.create(context, { moduleKey: "students", label: "Trạng thái", type: "multiSelect" as any, options: [{ label: "Mới", value: "new" }, { label: "Trùng", value: "new" }] }), /trùng/i);
  const created = await service.create(context, { moduleKey: "students", label: "Ghi chú", type: "text", options: selectOptions });
  assert.equal(created.options, undefined);
});

test("rejects labels that become empty or reserved keys", async () => {
  const { dependencies } = createDependencies();
  const service = new CustomFieldService(dependencies);
  await assert.rejects(() => service.create(context, { moduleKey: "students", label: "!!!", type: "text" }), /không hợp lệ/i);
  await assert.rejects(() => service.create(context, { moduleKey: "students", label: "tenant id", type: "text" }), /dành riêng/i);
});

test("rejects prototype-related field labels as reserved keys", async () => {
  const { dependencies } = createDependencies();
  const service = new CustomFieldService(dependencies);
  for (const label of ["constructor", "prototype", "__proto__"]) {
    await assert.rejects(
      () => service.create(context, { moduleKey: "students", label, type: "text" }),
      /dành riêng/i,
      label,
    );
  }
});

test("does not cross tenant boundaries when updating and maps duplicate keys to a Vietnamese domain error", async () => {
  const foreign = createDependencies([{ _id: "field-1", tenantId: "tenant-b", moduleKey: "students", key: "name", type: "text" }]);
  await assert.rejects(() => new CustomFieldService(foreign.dependencies).update(context, "students", "field-1", { label: "Khác" }), /không tìm thấy/i);
  const duplicate = createDependencies([{ tenantId: "tenant-a", moduleKey: "students", key: "ten", order: 1 }]);
  duplicate.dependencies.fieldDefinitions = {
    ...duplicate.dependencies.fieldDefinitions,
    find: () => ({ sort: async () => [] }),
  } as any;
  await assert.rejects(() => new CustomFieldService(duplicate.dependencies).create(context, { moduleKey: "students", label: "Tên", type: "text" }), /trùng/i);
});

test("definition mutations cannot cross module boundaries", async () => {
  const scoped = createDependencies([{ _id: "field-1", tenantId: "tenant-a", moduleKey: "courses", key: "note", label: "Note", type: "text", isVisible: true, isRequired: false, isArchived: false }]);
  const service = new CustomFieldService(scoped.dependencies);
  await assert.rejects(() => service.update(context, "students", "field-1", { label: "Wrong" }), /không tìm thấy/i);
  await assert.rejects(() => service.archive(context, "students", "field-1"), /không tìm thấy/i);
  await assert.rejects(() => service.restore(context, "students", "field-1"), /không tìm thấy/i);
  assert.equal(scoped.fields[0].label, "Note");
});

test("PATCH validates merged type, options, validation, and default value", async () => {
  const scoped = createDependencies([{
    _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "score", label: "Score", type: "percent",
    validation: { min: 0, max: 10 }, defaultValue: 5, isVisible: true, isRequired: false, isArchived: false,
  }]);
  const service = new CustomFieldService(scoped.dependencies);
  await assert.rejects(() => service.update(context, "students", "field-1", { defaultValue: "five" }), /số/i);
  await assert.rejects(() => service.update(context, "students", "field-1", { validation: { min: 8, max: 2 } }), /lớn hơn/i);
});

test("DELETE deletes field from database", async () => {
  let deletedId = "";
  const scoped = createDependencies([{
    _id: "field-1", tenantId: "tenant-a", moduleKey: "students", key: "score", label: "Score", type: "percent",
    validation: { min: 0, max: 10 }, defaultValue: 5, isVisible: true, isRequired: false, isArchived: false,
  }]);
  (scoped.dependencies.fieldDefinitions as any).findOneAndDelete = async (filter: any) => {
    deletedId = filter._id;
    return scoped.fields[0];
  };
  const service = new CustomFieldService(scoped.dependencies);
  await service.delete(context, "students", "field-1");
  assert.equal(deletedId, "field-1");
});
