import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "mongoose";
import type { DynamicFieldType } from "../interfaces/custom-field.interface";
import { Batch } from "../models/batch.model";
import { Course } from "../models/course.model";
import { Exam } from "../models/exam.model";
import { Partner } from "../models/partner.model";
import { Resource } from "../models/resource.model";
import { Student } from "../models/student.model";
import { createBatchSchema, updateBatchSchema } from "../validations/batch.validation";
import { createCourseSchema, updateCourseSchema } from "../validations/course.validation";
import { createExamSchema, updateExamSchema } from "../validations/exam.validation";
import { createPartnerSchema, updatePartnerSchema } from "../validations/partner.validation";
import { createResourceSchema, updateResourceSchema } from "../validations/resource.validation";
import { createStudentSchema, updateStudentSchema } from "../validations/student.validation";
import {
  createCustomFieldValueValidator,
  type CustomFieldValueDefinition,
  type CustomFieldValueRepository,
} from "./custom-field-value.service";

function field(
  key: string,
  label: string,
  type: string,
  overrides: Partial<CustomFieldValueDefinition> = {},
): CustomFieldValueDefinition {
  return {
    key,
    label,
    type: type as any,
    isVisible: true,
    isRequired: false,
    isArchived: false,
    ...overrides,
  };
}

function validatorFor(definitions: CustomFieldValueDefinition[]) {
  const queries: Array<Record<string, unknown>> = [];
  const repository: CustomFieldValueRepository = {
    async find(filter) {
      queries.push(filter);
      return definitions;
    },
  };
  return { validate: createCustomFieldValueValidator(repository), queries };
}

const baseInput = { tenantId: "IGEN", moduleKey: "students" as const, mode: "create" as const };

test("queries definitions by trusted tenant and module", async () => {
  const { validate, queries } = validatorFor([]);
  await validate({ ...baseInput, values: {} });
  assert.deepEqual(queries, [{ tenantId: "IGEN", moduleKey: "students" }]);
});

test("accepts and normalizes all 18 field types", async () => {
  const definitions = [
    field("short", "Tên ngắn", "text"),
    field("long", "Mô tả", "text"),
    field("email", "Email", "email"),
    field("phone", "Điện thoại", "phone"),
    field("url", "Website", "url"),
    field("number", "Số lượng", "number"),
    field("percent", "Phần trăm", "percent"),
    field("currency", "Học phí", "currency"),
    field("date", "Ngày", "date"),
    field("time", "Giờ", "time"),
    field("dateTime", "Ngày giờ", "dateTime"),
    field("single", "Một lựa chọn", "singleSelect", { options: [{ label: "A", value: "a" }] }),
    field("multi", "Nhiều lựa chọn", "multiSelect", { options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] }),
    field("checkbox", "Đồng ý", "checkbox"),
    field("switch", "Kích hoạt", "switch"),
    field("file", "Tệp", "file"),
    field("image", "Ảnh", "image"),
    field("multiImage", "Bộ ảnh", "multiImage"),
  ];
  const { validate } = validatorFor(definitions);
  const result = await validate({
    ...baseInput,
    values: {
      short: "  Nguyễn Văn A  ", long: "  Nội dung  ", email: "  USER@Example.COM ",
      phone: "  +84 912 345 678  ", url: "  https://example.com/path  ", number: 0,
      percent: 100, currency: 2500000, date: " 2026-07-18 ", time: " 08:30 ",
      dateTime: " 2026-07-18T08:30:00+07:00 ", single: " a ", multi: [" a ", "b"],
      checkbox: false, switch: true,
      file: { url: " https://example.com/a.pdf ", fileName: " a.pdf ", mimeType: " application/pdf ", size: 10 },
      image: { url: "https://example.com/a.png", fileName: "a.png" },
      multiImage: [{ url: "https://example.com/1.png", fileName: "1.png", mimeType: "image/png", size: 20 }],
    },
  });

  assert.equal(Object.getPrototypeOf(result), null);
  assert.deepEqual({ ...result }, {
    short: "Nguyễn Văn A", long: "Nội dung", email: "user@example.com", phone: "+84 912 345 678",
    url: "https://example.com/path", number: 0, percent: 100, currency: 2500000,
    date: "2026-07-18", time: "08:30", dateTime: "2026-07-18T08:30:00+07:00",
    single: "a", multi: ["a", "b"], checkbox: false, switch: true,
    file: { url: "https://example.com/a.pdf", fileName: "a.pdf", mimeType: "application/pdf", size: 10 },
    image: { url: "https://example.com/a.png", fileName: "a.png" },
    multiImage: [{ url: "https://example.com/1.png", fileName: "1.png", mimeType: "image/png", size: 20 }],
  });
});

test("requires visible required values on both create and update while treating zero and false as present", async () => {
  const { validate } = validatorFor([
    field("photo", "Ảnh học viên", "image", { isRequired: true }),
    field("score", "Điểm", "number", { isRequired: true }),
    field("confirmed", "Xác nhận", "checkbox", { isRequired: true }),
  ]);
  for (const mode of ["create", "update"] as const) {
    await assert.rejects(
      validate({ ...baseInput, mode, values: { score: 0, confirmed: false } }),
      /Ảnh học viên.*bắt buộc/i,
    );
  }
  const image = { url: "https://example.com/a.png", fileName: "a.png" };
  assert.deepEqual({ ...await validate({ ...baseInput, values: { photo: image, score: 0, confirmed: false } }) }, {
    photo: image, score: 0, confirmed: false,
  });
});

test("omits hidden and archived fields and never requires them", async () => {
  const { validate } = validatorFor([
    field("hiddenRequired", "Trường ẩn", "text", { isVisible: false, isRequired: true }),
    field("archivedRequired", "Trường lưu trữ", "text", { isArchived: true, isRequired: true }),
  ]);
  const result = await validate({
    ...baseInput,
    mode: "update",
    values: { hiddenRequired: "secret", archivedRequired: "legacy" },
  });
  assert.deepEqual({ ...result }, {});
});

test("rejects unknown and prototype-pollution keys", async () => {
  const { validate } = validatorFor([]);
  await assert.rejects(validate({ ...baseInput, values: { unknownKey: "x" } }), /unknownKey.*không được định nghĩa/i);
  for (const key of ["__proto__", "prototype", "constructor"]) {
    const values = Object.create(null) as Record<string, unknown>;
    values[key] = "x";
    await assert.rejects(validate({ ...baseInput, values }), /khóa.*không an toàn/i);
  }
});

test("rejects unsafe definition keys even when the client omits them", async () => {
  for (const key of ["__proto__", "prototype", "constructor"]) {
    const { validate } = validatorFor([field(key, "Unsafe definition", "text")]);
    await assert.rejects(validate({ ...baseInput, values: {} }), /định nghĩa.*khóa không an toàn/i);
  }
});

test("rejects values that are not plain objects", async () => {
  const { validate } = validatorFor([]);
  for (const values of [null, [], new Date(), "text", 1]) {
    await assert.rejects(validate({ ...baseInput, values }), /đối tượng/i);
  }
});

test("applies nonempty defaults only for absent create keys and validates the default", async () => {
  const definitions = [
    field("level", "Cấp độ", "singleSelect", { options: [{ label: "A", value: "a" }], defaultValue: "a" }),
    field("empty", "Giá trị trống", "text", { defaultValue: "   " }),
  ];
  const { validate } = validatorFor(definitions);
  assert.deepEqual({ ...await validate({ ...baseInput, values: {} }) }, { level: "a" });
  assert.deepEqual({ ...await validate({ ...baseInput, mode: "update", values: {} }) }, {});
  assert.deepEqual({ ...await validate({ ...baseInput, values: { level: null } }) }, {});

  const invalidDefault = validatorFor([
    field("level", "Cấp độ", "singleSelect", { options: [{ label: "A", value: "a" }], defaultValue: "b" }),
  ]).validate;
  await assert.rejects(invalidDefault({ ...baseInput, values: {} }), /Cấp độ.*lựa chọn/i);
});

test("does not mutate the input or reuse nested file objects", async () => {
  const { validate } = validatorFor([field("file", "Tệp", "file")]);
  const originalFile = { url: " https://example.com/a.pdf ", fileName: " a.pdf " };
  const values = { file: originalFile };
  const result = await validate({ ...baseInput, values });
  assert.deepEqual(values, { file: { url: " https://example.com/a.pdf ", fileName: " a.pdf " } });
  assert.notEqual(result, values);
  assert.notEqual(result.file, originalFile);
});

test("rejects invalid text, numeric, date, select, boolean and file values with the field label", async () => {
  const cases: Array<[CustomFieldValueDefinition, unknown, RegExp]> = [
    [field("email", "Email liên hệ", "email"), "not-an-email", /Email liên hệ.*email/i],
    [field("phone", "Điện thoại", "phone"), "abc", /Điện thoại.*điện thoại/i],
    [field("url", "Website", "url"), "not-a-url", /Website.*URL/i],
    [field("number", "Số lượng", "number"), Number.NaN, /Số lượng.*số hữu hạn/i],
    [field("percent", "Tỷ lệ", "percent"), 101, /Tỷ lệ.*0.*100/i],
    [field("date", "Ngày sinh", "date"), "2026-02-30", /Ngày sinh.*ngày/i],
    [field("time", "Giờ học", "time"), "25:00", /Giờ học.*giờ/i],
    [field("dateTime", "Lịch hẹn", "dateTime"), "2026-07-18", /Lịch hẹn.*ngày giờ/i],
    [field("select", "Hạng", "singleSelect", { options: [{ label: "A", value: "a" }] }), "b", /Hạng.*lựa chọn/i],
    [field("multi", "Kỹ năng", "multiSelect", { options: [{ label: "A", value: "a" }] }), ["a", "a"], /Kỹ năng.*trùng/i],
    [field("flag", "Xác nhận", "switch"), 1, /Xác nhận.*boolean/i],
    [field("file", "Hồ sơ", "file"), { url: "", fileName: "a.pdf" }, /Hồ sơ.*tệp/i],
    [field("images", "Ảnh", "multiImage"), { url: "x", fileName: "x" }, /Ảnh.*danh sách/i],
  ];
  for (const [definition, value, pattern] of cases) {
    const { validate } = validatorFor([definition]);
    await assert.rejects(validate({ ...baseInput, values: { [definition.key]: value } }), pattern);
  }
});

test("enforces text, number and date definition constraints", async () => {
  const definitions = [
    field("code", "Mã hồ sơ", "text", { validation: { minLength: 3, maxLength: 5, pattern: "^[A-Z]+$" } }),
    field("amount", "Số tiền", "currency", { validation: { min: 10, max: 20, decimals: 2 } }),
    field("date", "Ngày nhập học", "date", { validation: { minDate: "2026-01-01", maxDate: "2026-12-31" } }),
    field("time", "Giờ học", "time", { validation: { minTime: "08:00", maxTime: "17:00" } }),
    field("appointment", "Lịch hẹn", "dateTime", { validation: { minDateTime: "2026-07-18T00:00:00Z", maxDateTime: "2026-07-19T00:00:00Z" } }),
  ];
  const { validate } = validatorFor(definitions);
  await assert.rejects(validate({ ...baseInput, values: { code: "AB", amount: 15, date: "2026-06-01", time: "09:00", appointment: "2026-07-18T08:00:00Z" } }), /Mã hồ sơ.*ít nhất 3/i);
  await assert.rejects(validate({ ...baseInput, values: { code: "ABC", amount: 15.123, date: "2026-06-01", time: "09:00", appointment: "2026-07-18T08:00:00Z" } }), /Số tiền.*2.*thập phân/i);
  await assert.rejects(validate({ ...baseInput, values: { code: "ABC", amount: 15, date: "2027-01-01", time: "09:00", appointment: "2026-07-18T08:00:00Z" } }), /Ngày nhập học.*2026-12-31/i);
  await assert.rejects(validate({ ...baseInput, values: { code: "ABC", amount: 15, date: "2026-06-01", time: "07:00", appointment: "2026-07-18T08:00:00Z" } }), /Giờ học.*08:00/i);
  await assert.rejects(validate({ ...baseInput, values: { code: "ABC", amount: 15, date: "2026-06-01", time: "09:00", appointment: "2026-07-20T08:00:00Z" } }), /Lịch hẹn.*2026-07-19/i);
});

test("rejects nested unsafe pattern wrappers and oversized input before constructing native RegExp", async () => {
  const NativeRegExp = globalThis.RegExp;
  let constructed = false;
  globalThis.RegExp = function forbiddenRegExpConstruction() {
    constructed = true;
    throw new Error("native RegExp must not be constructed");
  } as unknown as RegExpConstructor;

  try {
    const oversized = validatorFor([
      field("code", "Mã hồ sơ", "text", { validation: { pattern: "^a+$" } }),
    ]).validate;

    const unsafeErrors: unknown[] = [];
    let oversizedError: unknown;
    for (let wrapperDepth = 1; wrapperDepth <= 4; wrapperDepth += 1) {
      const pattern = `^${"(".repeat(wrapperDepth)}(a+)${")".repeat(wrapperDepth)}+$`;
      const unsafe = validatorFor([
        field("code", "Mã hồ sơ", "text", { validation: { pattern } }),
      ]).validate;
      try {
        await unsafe({ ...baseInput, values: { code: `${"a".repeat(5_000)}!` } });
      } catch (error) {
        unsafeErrors.push(error);
      }
    }
    try {
      await oversized({ ...baseInput, values: { code: "a".repeat(4_097) } });
    } catch (error) {
      oversizedError = error;
    }

    assert.equal(unsafeErrors.length, 4);
    for (const error of unsafeErrors) {
      assert.match(String(error), /Mã hồ sơ.*biểu thức.*không an toàn/i);
    }
    assert.match(String(oversizedError), /Mã hồ sơ.*quá dài.*biểu thức/i);
    assert.equal(constructed, false);
  } finally {
    globalThis.RegExp = NativeRegExp;
  }
});

test("rejects multiple sibling quantifiers before constructing native RegExp", async () => {
  const NativeRegExp = globalThis.RegExp;
  let constructed = false;
  globalThis.RegExp = function forbiddenRegExpConstruction() {
    constructed = true;
    throw new Error("native RegExp must not be constructed");
  } as unknown as RegExpConstructor;

  try {
    const validate = validatorFor([
      field("code", "Mã hồ sơ", "text", { validation: { pattern: "^a*a*a*a*a*a*b$" } }),
    ]).validate;
    let unsafeError: unknown;
    try {
      await validate({ ...baseInput, values: { code: "aaaaab" } });
    } catch (error) {
      unsafeError = error;
    }
    assert.match(String(unsafeError), /Mã hồ sơ.*biểu thức.*không an toàn/i);
    assert.equal(constructed, false);
  } finally {
    globalThis.RegExp = NativeRegExp;
  }
});

test("accepts one quantifier and does not count noncapturing group syntax", async () => {
  const validate = validatorFor([
    field("code", "Mã hồ sơ", "text", { validation: { pattern: "^(?:ab)+$" } }),
  ]).validate;
  assert.deepEqual({ ...await validate({ ...baseInput, values: { code: "abab" } }) }, { code: "abab" });
});

test("enforces file MIME type, maxSizeMb and maxFiles constraints", async () => {
  const definition = field("photos", "Ảnh hồ sơ", "multiImage" as any, {
    validation: { allowedMimeTypes: ["image/png"], maxSizeMb: 1, maxFiles: 2 },
  });
  const { validate } = validatorFor([definition]);
  await assert.rejects(validate({ ...baseInput, values: { photos: [{ url: "x", fileName: "x.jpg", mimeType: "image/jpeg", size: 10 }] } }), /Ảnh hồ sơ.*định dạng/i);
  await assert.rejects(validate({ ...baseInput, values: { photos: [{ url: "x", fileName: "x.png", mimeType: "image/png", size: 1024 * 1024 + 1 }] } }), /Ảnh hồ sơ.*1 MB/i);
  await assert.rejects(validate({ ...baseInput, values: { photos: [1, 2, 3].map(index => ({ url: `x${index}`, fileName: `${index}.png`, mimeType: "image/png", size: 10 })) } }), /Ảnh hồ sơ.*tối đa 2/i);
});

test("supports wildcard MIME types like image/* in allowedMimeTypes", async () => {
  const definition = field("photo", "Ảnh đại diện", "image", {
    validation: { allowedMimeTypes: ["image/*"] },
  });
  const { validate } = validatorFor([definition]);
  const res = await validate({
    ...baseInput,
    values: { photo: { url: "https://example.com/dz.jpg", fileName: "dz.jpg", mimeType: "image/jpeg", size: 70000 } },
  });
  assert.deepEqual(res.photo, { url: "https://example.com/dz.jpg", fileName: "dz.jpg", mimeType: "image/jpeg", size: 70000 });
});

test("treats null, undefined, blank strings and empty arrays as missing", async () => {
  for (const value of [null, undefined, "   ", []]) {
    const { validate } = validatorFor([field("required", "Trường bắt buộc", "text", { isRequired: true })]);
    await assert.rejects(validate({ ...baseInput, values: { required: value } }), /Trường bắt buộc.*bắt buộc/i);
  }
});

test("all six models expose customFields as Mixed with an empty default", () => {
  for (const model of [Student, Course, Batch, Exam, Resource, Partner]) {
    const path = model.schema.path("customFields");
    assert.ok(path, `${model.modelName} lacks customFields`);
    assert.equal(path.instance, "Mixed");
    assert.deepEqual(path.getDefault(null, false), {});
    assert.equal(path.options.type, Schema.Types.Mixed);
  }
});

test("all six create and update Joi schemas accept customFields but reject unrelated top-level keys", () => {
  const createCases = [
    [createStudentSchema, { fullName: "A", phone: "0900000000", email: "student@example.com", registrationDate: "2026-07-18", customFields: { nickname: "A" } }],
    [createCourseSchema, { code: "C1", title: "Course", category: "General", duration: "3 months", customFields: { level: "a" } }],
    [createBatchSchema, { code: "B1", courseId: "course", daysOfWeek: [1], startTime: "08:00", endTime: "09:00", startDate: "2026-07-18", endDate: "2026-08-18", customFields: { room: "A" } }],
    [createExamSchema, { name: "Exam", status: "Sắp diễn ra", tentativeDate: "2026-07-18", location: "HCM", customFields: { note: "A" } }],
    [createResourceSchema, { name: "Room", type: "ROOM", identifier: "R1", capacity: "20", customFields: { floor: 2 } }],
    [createPartnerSchema, { name: "Partner", phone: "0900000000", customFields: { area: "south" } }],
  ] as const;
  const updateSchemas = [updateStudentSchema, updateCourseSchema, updateBatchSchema, updateExamSchema, updateResourceSchema, updatePartnerSchema];
  for (const [schema, value] of createCases) {
    assert.equal(schema.validate(value).error, undefined);
    assert.match(schema.validate({ ...value, unrelatedTopLevel: true }).error?.message ?? "", /unrelatedTopLevel.*not allowed/i);
  }
  for (const schema of updateSchemas) {
    assert.equal(schema.validate({ customFields: { arbitraryEnvelope: true } }).error, undefined);
    assert.match(schema.validate({ unrelatedTopLevel: true }).error?.message ?? "", /unrelatedTopLevel.*not allowed/i);
  }
});
