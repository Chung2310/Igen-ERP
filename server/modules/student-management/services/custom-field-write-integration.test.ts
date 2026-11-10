import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { StudentController } from "../controllers/student.controller";
import { CourseController } from "../controllers/course.controller";
import { BatchController } from "../controllers/batch.controller";
import { ExamController } from "../controllers/exam.controller";
import { ResourceController } from "../controllers/resource.controller";
import { PartnerController } from "../controllers/partner.controller";
import { StudentService } from "./student.service";
import { CourseService } from "./course.service";
import { BatchService } from "./batch.service";
import { ExamService } from "./exam.service";
import { ResourceService } from "./resource.service";
import { PartnerService } from "./partner.service";
import { AuthService } from "./auth.service";
import { User } from "../models/user.model";
import { Student } from "../models/student.model";
import { Course } from "../models/course.model";
import { Batch } from "../models/batch.model";
import { Exam } from "../models/exam.model";
import { Resource } from "../models/resource.model";
import { Partner } from "../models/partner.model";
import { Payment } from "../models/payment.model";
import { CommissionLevel } from "../models/commission-level.model";
import { StandardFieldConfig } from "../models/standard-field-config.model";
import { WorkerService } from "../../worker-management/services/worker.service";
import { ModuleSettingsService } from "./module-settings.service";
import { CustomFieldWriteService } from "./custom-field-write.service";
import {
  createCustomFieldValueValidator,
  type CustomFieldValueDefinition,
} from "./custom-field-value.service";
import type { ModuleKey } from "../interfaces/custom-field.interface";

type ResponseCapture = {
  statusCode: number;
  body: unknown;
  status(code: number): ResponseCapture;
  json(body: unknown): ResponseCapture;
};

function responseCapture(): ResponseCapture {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("all six create controllers pass the authenticated tenant and exact module key", async (t) => {
  t.mock.method(User as any, "find", () => ({ select: async () => [] }));

  const cases = [
    [StudentController, StudentService, "createStudent", "students", 2],
    [CourseController, CourseService, "createCourse", "courses", 1],
    [BatchController, BatchService, "createBatch", "batches", 2],
    [ExamController, ExamService, "createExam", "exams", 1],
    [ResourceController, ResourceService, "createResource", "resources", 1],
    [PartnerController, PartnerService, "createPartner", "partners", 1],
  ] as const;

  for (const [controller, service, method, moduleKey, dataIndex] of cases) {
    const calls: unknown[][] = [];
    t.mock.method(service as any, method, async (...args: unknown[]) => {
      calls.push(args);
      return { _id: `${moduleKey}-1` };
    });
    const req = {
      user: {
        uid: "actor-a",
        id: "actor-a",
        email: "actor@example.com",
        role: "user",
        centerId: "center-a",
        companyCode: "tenant-a",
        branchId: "branch-a",
      },
      body: { companyCode: "tenant-b", branchId: "branch-b", customFields: {} },
      query: {},
      params: {},
    } as any;
    const res = responseCapture();
    let forwarded: unknown;

    await (controller.create as any)(req, res as unknown as Response, (error: unknown) => {
      forwarded = error;
    });

    assert.equal(forwarded, undefined, moduleKey);
    assert.equal(res.statusCode, 201, moduleKey);
    assert.deepEqual(calls[0]?.at(-1), { tenantId: "tenant-a", moduleKey, actorRole: "user" }, moduleKey);
    assert.equal((calls[0]?.[dataIndex] as { branchId?: string })?.branchId, "branch-a", moduleKey);
  }
});

test("public student registration stays on the legacy create path without dynamic required fields", async (t) => {
  t.mock.method(AuthService as any, "getUserProfile", async () => ({
    uid: "teacher-a",
    role: "user",
    companyCode: "tenant-a",
    centerId: "tenant-a",
    branchId: "branch-a",
    isActive: true,
  }));
  t.mock.method(User as any, "find", () => ({ select: async () => [] }));
  const calls: unknown[][] = [];
  t.mock.method(StudentService as any, "createStudent", async (...args: unknown[]) => {
    calls.push(args);
    return { _id: "student-public" };
  });
  const res = responseCapture();

  await StudentController.publicRegister({
    body: { teacherId: "teacher-a", fullName: "Public", phone: "0900000000" },
  } as any, res as unknown as Response);

  assert.equal(res.statusCode, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 3);
  assert.equal(calls[0][0], "teacher-a");
  assert.equal((calls[0][2] as { branchId?: string }).branchId, "branch-a");
});

test("public registration creates a worker for a labor tenant", async (t) => {
  t.mock.method(AuthService as any, "getUserProfile", async () => ({
    uid: "teacher-a", role: "user", companyCode: "tenant-a", centerId: "tenant-a", branchId: "branch-a", isActive: true,
  }));
  t.mock.method(ModuleSettingsService.prototype, "get", async () => ({ tenantId: "tenant-a", entityPreset: "worker" as const }));
  const workerCalls: unknown[][] = [];
  t.mock.method(WorkerService as any, "create", async (...args: unknown[]) => {
    workerCalls.push(args);
    return { _id: "worker-public", fullName: "Public worker" };
  });
  t.mock.method(StudentService as any, "createStudent", async () => {
    throw new Error("Student registration must not run for a labor tenant");
  });
  const res = responseCapture();

  await StudentController.publicRegister({
    body: { teacherId: "teacher-a", fullName: "Public worker", phone: "0900000000" },
  } as any, res as unknown as Response);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(workerCalls[0]?.[0], { companyCode: "tenant-a", branchId: "branch-a" });
  assert.equal((workerCalls[0]?.[1] as { status?: string }).status, "active");
});

test("public registration creates a worker when submitted from a worker QR", async (t) => {
  t.mock.method(AuthService as any, "getUserProfile", async () => ({
    uid: "teacher-a", role: "user", companyCode: "tenant-a", centerId: "tenant-a", branchId: "branch-a", isActive: true,
  }));
  t.mock.method(User as any, "findOne", () => ({ select: async () => ({ companyCode: "tenant-a" }) }));
  t.mock.method(StandardFieldConfig as any, "find", () => ({ lean: async () => [] }));
  t.mock.method(ModuleSettingsService.prototype, "get", async () => ({ tenantId: "tenant-a", entityPreset: "student" as const }));
  const workerCalls: unknown[][] = [];
  t.mock.method(WorkerService as any, "create", async (...args: unknown[]) => {
    workerCalls.push(args);
    return { _id: "worker-public", fullName: "Public worker" };
  });
  t.mock.method(StudentService as any, "createStudent", async () => {
    throw new Error("Worker QR registration must not create a student");
  });
  const res = responseCapture();

  await StudentController.publicRegister({
    body: {
      teacherId: "teacher-a",
      fullName: "Public worker",
      phone: "0900000000",
      email: "worker@example.com",
      entityPreset: "worker",
      registrationCompanyCode: "tenant-selected",
      registrationBranchId: "branch-selected",
    },
  } as any, res as unknown as Response);

  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.deepEqual(workerCalls[0]?.[0], { companyCode: "tenant-selected", branchId: "branch-selected" });
});

test("all six create services validate custom fields with create mode before persistence", async (t) => {
  const dbReached = new Error("database should not be reached before custom-field validation");
  t.mock.method(Student as any, "findOne", () => { throw dbReached; });
  t.mock.method(Course as any, "findOne", () => { throw dbReached; });
  t.mock.method(Batch as any, "findOne", () => { throw dbReached; });
  t.mock.method(Partner as any, "findOne", () => { throw dbReached; });
  t.mock.method(Exam.prototype as any, "save", async () => { throw dbReached; });
  t.mock.method(Resource.prototype as any, "save", async () => { throw dbReached; });

  const cases = [
    [StudentService, "students", () => StudentService.createStudent("owner-a", ["owner-a"], { phone: "0900000000", customFields: { note: " x " } }, { tenantId: "tenant-a", moduleKey: "students" })],
    [CourseService, "courses", () => CourseService.createCourse("owner-a", { code: "C1", customFields: { note: " x " } }, { tenantId: "tenant-a", moduleKey: "courses" })],
    [BatchService, "batches", () => BatchService.createBatch("owner-a", { uid: "actor-a", role: "user" }, { code: "B1", customFields: { note: " x " } }, { tenantId: "tenant-a", moduleKey: "batches" })],
    [ExamService, "exams", () => ExamService.createExam("owner-a", { name: "Exam", customFields: { note: " x " } }, { tenantId: "tenant-a", moduleKey: "exams" })],
    [ResourceService, "resources", () => ResourceService.createResource("owner-a", { name: "Room", customFields: { note: " x " } }, { tenantId: "tenant-a", moduleKey: "resources" })],
    [PartnerService, "partners", () => PartnerService.createPartner("owner-a", { name: "Partner", phone: "0900000000", commissionType: "fixed", commissionValue: 0, customFields: { note: " x " } } as any, { tenantId: "tenant-a", moduleKey: "partners" })],
  ] as const;

  for (const [service, moduleKey, invoke] of cases) {
    const calls: unknown[] = [];
    const validationStop = new Error(`validated ${moduleKey}`);
    const previous = (service as any).customFieldWrites;
    (service as any).customFieldWrites = {
      async prepareCreate(context: unknown, data: unknown) {
        calls.push({ context, data });
        throw validationStop;
      },
    };
    try {
      await assert.rejects(invoke, validationStop);
      assert.equal(calls.length, 1, moduleKey);
      assert.deepEqual((calls[0] as any).context, { tenantId: "tenant-a", moduleKey }, moduleKey);
      assert.deepEqual((calls[0] as any).data.customFields, { note: " x " }, moduleKey);
    } finally {
      (service as any).customFieldWrites = previous;
    }
  }
});

test("all six update services load in owner scope and validate the complete merged set", async (t) => {
  const existing = {
    _id: "entity-a",
    ownerId: "owner-a",
    code: "B1",
    customFields: { kept: "old" },
    set() { throw new Error("persistence should not be reached before custom-field validation"); },
  };
  t.mock.method(Student as any, "findOne", async () => existing);
  t.mock.method(Course as any, "findOne", async () => existing);
  t.mock.method(Batch as any, "findOne", async () => existing);
  t.mock.method(Exam as any, "findOne", async () => existing);
  t.mock.method(Resource as any, "findOne", async () => existing);
  t.mock.method(Partner as any, "findOne", async () => existing);
  t.mock.method(Student as any, "findOneAndUpdate", async () => { throw new Error("unexpected persistence"); });
  t.mock.method(Course as any, "findOneAndUpdate", async () => { throw new Error("unexpected persistence"); });
  t.mock.method(Exam as any, "findOneAndUpdate", async () => { throw new Error("unexpected persistence"); });
  t.mock.method(Resource as any, "findOneAndUpdate", async () => { throw new Error("unexpected persistence"); });

  const patch = { customFields: { changed: "new" } };
  const cases = [
    [StudentService, "students", () => StudentService.updateStudent("owner-a", ["owner-a"], "entity-a", { ...patch }, { tenantId: "tenant-a", moduleKey: "students" })],
    [CourseService, "courses", () => CourseService.updateCourse("owner-a", "entity-a", { ...patch }, { tenantId: "tenant-a", moduleKey: "courses" })],
    [BatchService, "batches", () => BatchService.updateBatch("owner-a", { uid: "actor-a", role: "user" }, "entity-a", { ...patch }, { tenantId: "tenant-a", moduleKey: "batches" })],
    [ExamService, "exams", () => ExamService.updateExam("owner-a", "entity-a", { ...patch }, { tenantId: "tenant-a", moduleKey: "exams" })],
    [ResourceService, "resources", () => ResourceService.updateResource("owner-a", "entity-a", { ...patch }, { tenantId: "tenant-a", moduleKey: "resources" })],
    [PartnerService, "partners", () => PartnerService.updatePartner("owner-a", "entity-a", { ...patch } as any, { tenantId: "tenant-a", moduleKey: "partners" })],
  ] as const;

  for (const [service, moduleKey, invoke] of cases) {
    const calls: unknown[] = [];
    const validationStop = new Error(`validated ${moduleKey}`);
    const previous = (service as any).customFieldWrites;
    (service as any).customFieldWrites = {
      async prepareUpdate(context: unknown, loaded: unknown, data: unknown) {
        calls.push({ context, loaded, data });
        throw validationStop;
      },
    };
    try {
      await assert.rejects(invoke, validationStop);
      assert.equal(calls.length, 1, moduleKey);
      assert.deepEqual((calls[0] as any).context, { tenantId: "tenant-a", moduleKey }, moduleKey);
      assert.equal((calls[0] as any).loaded, existing, moduleKey);
      assert.deepEqual((calls[0] as any).data.customFields, { changed: "new" }, moduleKey);
    } finally {
      (service as any).customFieldWrites = previous;
    }
  }
});

test("every update preload retains id and scalar, array, or ALL owner scope", async (t) => {
  const cases = [
    [StudentService, Student, "students", (owner: string | string[]) => StudentService.updateStudent(owner, owner, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "students" })],
    [CourseService, Course, "courses", (owner: string | string[]) => CourseService.updateCourse(owner, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "courses" })],
    [BatchService, Batch, "batches", (owner: string | string[]) => BatchService.updateBatch(owner, { uid: "actor-a", role: "user" }, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "batches" })],
    [ExamService, Exam, "exams", (owner: string | string[]) => ExamService.updateExam(owner, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "exams" })],
    [ResourceService, Resource, "resources", (owner: string | string[]) => ResourceService.updateResource(owner, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "resources" })],
    [PartnerService, Partner, "partners", (owner: string | string[]) => PartnerService.updatePartner(owner, "entity-a", {}, { tenantId: "tenant-a", moduleKey: "partners" })],
  ] as const;

  for (const [service, model, label, invoke] of cases) {
    const filters: unknown[] = [];
    t.mock.method(model as any, "findOne", async (filter: unknown) => {
      filters.push(filter);
      return { _id: "entity-a", ownerId: "owner-a", __v: 4, customFields: {} };
    });
    const previous = (service as any).customFieldWrites;
    const stop = new Error(`stop ${label}`);
    (service as any).customFieldWrites = { async prepareUpdate() { throw stop; } };
    try {
      for (const owner of ["owner-a", ["owner-a", "owner-b"], "ALL"] as Array<string | string[]>) {
        await assert.rejects(() => invoke(owner), stop);
      }
      assert.deepEqual(filters, [
        { _id: "entity-a", ownerId: "owner-a" },
        { _id: "entity-a", ownerId: { $in: ["owner-a", "owner-b"] } },
        { _id: "entity-a" },
      ], label);
    } finally {
      (service as any).customFieldWrites = previous;
    }
  }
});

test("concurrent A/B updates use CAS across all six persistence styles", async (t) => {
  t.mock.method(Course as any, "find", () => ({ select: async () => [] }));
  t.mock.method(User as any, "find", () => ({ select: async () => [] }));
  t.mock.method(Student as any, "find", () => ({ select: async () => [] }));
  t.mock.method(CommissionLevel as any, "find", () => ({ sort: async () => [] }));
  let paymentDeletes = 0;
  let paymentUpdates = 0;
  t.mock.method(Payment as any, "deleteOne", async () => { paymentDeletes += 1; });
  t.mock.method(Payment as any, "updateOne", async () => { paymentUpdates += 1; });

  const cases = [
    [StudentService, Student, "students", () => StudentService.updateStudent("owner-a", "owner-a", "entity-a", { expectedVersion: 7, paymentHistory: [] }, { tenantId: "tenant-a", moduleKey: "students" })],
    [CourseService, Course, "courses", () => CourseService.updateCourse("owner-a", "entity-a", { expectedVersion: 7 }, { tenantId: "tenant-a", moduleKey: "courses" })],
    [BatchService, Batch, "batches", () => BatchService.updateBatch("owner-a", { uid: "actor-a", role: "user" }, "entity-a", { expectedVersion: 7 }, { tenantId: "tenant-a", moduleKey: "batches" })],
    [ExamService, Exam, "exams", () => ExamService.updateExam("owner-a", "entity-a", { expectedVersion: 7 }, { tenantId: "tenant-a", moduleKey: "exams" })],
    [ResourceService, Resource, "resources", () => ResourceService.updateResource("owner-a", "entity-a", { expectedVersion: 7 }, { tenantId: "tenant-a", moduleKey: "resources" })],
    [PartnerService, Partner, "partners", () => PartnerService.updatePartner("owner-a", "entity-a", { expectedVersion: 7 }, { tenantId: "tenant-a", moduleKey: "partners" })],
  ] as const;

  for (const [service, model, moduleKey, invoke] of cases) {
    let currentVersion = 7;
    let prepared = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const casCalls: Array<{ filter: any; update: any }> = [];
    const snapshot = () => ({
      _id: "entity-a",
      ownerId: "owner-a",
      __v: 7,
      code: "B1",
      customFields: {},
      paymentHistory: [{ id: "payment-1", amount: 10, date: "old", note: "" }],
      payoutHistory: [],
      set(data: object) { Object.assign(this, data); },
      async save() { return this; },
      toObject() { return { ...this }; },
    });
    t.mock.method(model as any, "findOne", async () => snapshot());
    t.mock.method(model as any, "findOneAndUpdate", async (filter: any, update: any) => {
      casCalls.push({ filter, update });
      if (!Object.prototype.hasOwnProperty.call(filter, "__v")) return snapshot();
      if (filter.__v !== currentVersion) return null;
      currentVersion += 1;
      return { ...snapshot(), ...update.$set, __v: currentVersion };
    });

    const previous = (service as any).customFieldWrites;
    (service as any).customFieldWrites = {
      async prepareUpdate(_context: unknown, _existing: unknown, data: Record<string, unknown>) {
        prepared += 1;
        if (prepared === 2) release();
        await gate;
        const { expectedVersion: _expectedVersion, ...persisted } = data;
        return { ...persisted, customFields: {} };
      },
    };
    try {
      const results = await Promise.allSettled([invoke(), invoke()]);
      const fulfilled = results.filter(result => result.status === "fulfilled");
      const rejected = results.filter(result => result.status === "rejected") as PromiseRejectedResult[];
      assert.equal(fulfilled.length, 1, moduleKey);
      assert.equal(rejected.length, 1, moduleKey);
      assert.equal((rejected[0].reason as any).status, 409, moduleKey);
      assert.match(String((rejected[0].reason as Error).message), /thay đổi|conflict|xung đột/i, moduleKey);
      assert.equal(casCalls.length, 2, moduleKey);
      assert.ok(casCalls.every(call => call.filter._id === "entity-a" && call.filter.ownerId === "owner-a"), moduleKey);
      assert.ok(casCalls.every(call => call.filter.__v === 7), moduleKey);
      assert.ok(casCalls.every(call => call.update.$inc?.__v === 1), moduleKey);
      assert.ok(casCalls.every(call => !("expectedVersion" in call.update.$set)), moduleKey);
    } finally {
      (service as any).customFieldWrites = previous;
    }
  }

  assert.equal(paymentDeletes, 1, "only the winning Student CAS may sync deleted payments");
  assert.equal(paymentUpdates, 0);
});

test("update controllers preserve write conflicts as HTTP 409 domain errors", async (t) => {
  t.mock.method(User as any, "find", () => ({ select: async () => [] }));
  const conflict = Object.assign(new Error("Dữ liệu vừa được thay đổi."), { status: 409 });
  const cases = [
    [StudentController, StudentService, "updateStudent"],
    [CourseController, CourseService, "updateCourse"],
    [BatchController, BatchService, "updateBatch"],
    [ExamController, ExamService, "updateExam"],
    [ResourceController, ResourceService, "updateResource"],
    [PartnerController, PartnerService, "updatePartner"],
  ] as const;

  for (const [controller, service, method] of cases) {
    t.mock.method(service as any, method, async () => { throw conflict; });
    const res = responseCapture();
    let forwarded: any;
    await (controller.update as any)({
      user: { uid: "actor-a", role: "user", companyCode: "tenant-a", centerId: "tenant-a" },
      params: { id: "entity-a" },
      body: {},
    }, res as unknown as Response, (error: unknown) => { forwarded = error; });
    if (controller === PartnerController) {
      assert.equal(forwarded, conflict);
    } else {
      assert.equal(res.statusCode, 409, method);
    }
  }
});

function writerWithDefinitions(definitions: Array<CustomFieldValueDefinition & { tenantId: string; moduleKey: ModuleKey }>) {
  const validator = createCustomFieldValueValidator({
    async find(filter) {
      return definitions.filter(definition => (
        definition.tenantId === filter.tenantId && definition.moduleKey === filter.moduleKey
      ));
    },
  });
  return new CustomFieldWriteService(validator);
}

const definitionBase = {
  type: "text" as const,
  isVisible: true,
  isRequired: false,
  isArchived: false,
};

test("runtime writes stay tenant/module scoped and omit hidden or archived values", async () => {
  const writer = writerWithDefinitions([
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "studentOnly", label: "Student only" },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "requiredNew", label: "Required", isRequired: true },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "hidden", label: "Hidden", isVisible: false },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "archived", label: "Archived", isArchived: true },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "courses", key: "courseOnly", label: "Course only" },
  ]);

  await assert.rejects(
    () => writer.prepareCreate(
      { tenantId: "tenant-a", moduleKey: "courses" },
      { customFields: { studentOnly: "wrong module" } },
    ),
    /studentOnly/,
  );
  const tenantB = await writer.prepareCreate(
    { tenantId: "tenant-b", moduleKey: "students" },
    { name: "Legacy", customFields: {} },
  );
  assert.deepEqual({ ...(tenantB.customFields as object) }, {});

  const prepared = await writer.prepareCreate(
    { tenantId: "tenant-a", moduleKey: "students" },
    { customFields: { requiredNew: " yes ", hidden: "secret", archived: "old" } },
  );
  assert.deepEqual({ ...(prepared.customFields as object) }, { requiredNew: "yes" });
});

test("update preserves existing hidden and archived values without accepting client replacements", async () => {
  const writer = writerWithDefinitions([
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "visible", label: "Visible" },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "hidden", label: "Hidden", isVisible: false },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "archived", label: "Archived", isArchived: true },
  ]);

  const prepared = await writer.prepareUpdate(
    { tenantId: "tenant-a", moduleKey: "students" },
    { customFields: { visible: "old", hidden: "keep-hidden", archived: "keep-archived" } },
    { customFields: { visible: "new", hidden: "replace-hidden", archived: "replace-archived" } },
  );

  assert.deepEqual({ ...(prepared.customFields as object) }, {
    visible: "new",
    hidden: "keep-hidden",
    archived: "keep-archived",
  });
});

test("old records remain readable but must supply newly required fields on their next save", async (t) => {
  const oldRecord = { _id: "student-old", customFields: { nickname: "Old" } };
  t.mock.method(Student as any, "findOne", async () => oldRecord);
  const read = await StudentService.getStudentById("owner-a", "student-old");
  assert.equal(read, oldRecord);

  const writer = writerWithDefinitions([
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "nickname", label: "Nickname" },
    { ...definitionBase, tenantId: "tenant-a", moduleKey: "students", key: "requiredNew", label: "Required", isRequired: true },
  ]);
  await assert.rejects(
    () => writer.prepareUpdate(
      { tenantId: "tenant-a", moduleKey: "students" },
      oldRecord,
      { fullName: "Still old" },
    ),
    /Required/,
  );
  const prepared = await writer.prepareUpdate(
    { tenantId: "tenant-a", moduleKey: "students" },
    oldRecord,
    { fullName: "Updated", customFields: { requiredNew: "supplied" } },
  );
  assert.deepEqual({ ...(prepared.customFields as object) }, {
    nickname: "Old",
    requiredNew: "supplied",
  });
});

test("write sanitization excludes context/ownership keys and rejects direct operators", async () => {
  const writer = writerWithDefinitions([]);
  const prepared = await writer.prepareCreate(
    { tenantId: "tenant-a", moduleKey: "courses" },
    {
      title: "Safe",
      companyCode: "tenant-b",
      centerId: "center-b",
      tenantId: "tenant-b",
      moduleKey: "students",
      ownerId: "attacker",
    },
  );
  assert.deepEqual({
    ...prepared,
    customFields: { ...(prepared.customFields as object) },
  }, { title: "Safe", customFields: {} });
  for (const unsafe of ["$set", "profile.name", "constructor"]) {
    await assert.rejects(
      () => writer.prepareUpdate(
        { tenantId: "tenant-a", moduleKey: "courses" },
        { customFields: {} },
        { [unsafe]: true },
      ),
      /không an toàn/,
      unsafe,
    );
  }
});

test("missing update records preserve each service's existing result behavior", async (t) => {
  t.mock.method(Student as any, "findOne", async () => null);
  t.mock.method(Course as any, "findOne", async () => null);
  t.mock.method(Batch as any, "findOne", async () => null);
  t.mock.method(Exam as any, "findOne", async () => null);
  t.mock.method(Resource as any, "findOne", async () => null);
  t.mock.method(Partner as any, "findOne", async () => null);
  const context = (moduleKey: ModuleKey) => ({ tenantId: "tenant-a", moduleKey });

  assert.equal(await StudentService.updateStudent("owner-a", ["owner-a"], "missing", {}, context("students")), null);
  assert.equal(await CourseService.updateCourse("owner-a", "missing", {}, context("courses")), null);
  assert.equal(await BatchService.updateBatch("owner-a", { uid: "actor-a", role: "user" }, "missing", {}, context("batches")), null);
  assert.equal(await ExamService.updateExam("owner-a", "missing", {}, context("exams")), null);
  assert.equal(await ResourceService.updateResource("owner-a", "missing", {}, context("resources")), null);
  await assert.rejects(
    () => PartnerService.updatePartner("owner-a", "missing", {}, context("partners")),
    /tìm thấy/i,
  );
});

test("existing course fee normalization is preserved after custom-field preparation", async (t) => {
  t.mock.method(Course as any, "findOne", async () => null);
  t.mock.method(Course.prototype as any, "save", async function(this: any) { return this; });
  const previous = CourseService.customFieldWrites;
  CourseService.customFieldWrites = {
    async prepareCreate(_context: unknown, data: Record<string, unknown>) {
      return { ...data, customFields: {} };
    },
  } as any;
  try {
    const saved = await CourseService.createCourse(
      "owner-a",
      { code: "C1", title: "Course", category: "General", duration: "1", fee: "12345" },
      { tenantId: "tenant-a", moduleKey: "courses" },
    );
    assert.match(String(saved.fee), /12\.345/);
  } finally {
    CourseService.customFieldWrites = previous;
  }
});
