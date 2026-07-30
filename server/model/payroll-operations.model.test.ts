import assert from "node:assert/strict";
import { test } from "vitest";
import { PayrollAttendanceSnapshotModel } from "./payroll-attendance-snapshot.model";
import { PayrollOperationJobModel } from "./payroll-operation-job.model";
import { PayrollRunModel } from "./payroll-run.model";

const hasIndex = (indexes: any[], keys: object, options: object) => indexes.some(
  ([actual, actualOptions]) => JSON.stringify(actual) === JSON.stringify(keys)
    && Object.entries(options).every(([key, value]) => actualOptions[key] === value),
);

test("indexes runs by scope without exact-range uniqueness", () => {
  const indexes = PayrollRunModel.schema.indexes() as any[];
  const keys = { companyCode: 1, branchId: 1, startDate: 1, endDate: 1, type: 1 };

  assert.equal(
    hasIndex(indexes, keys, {}),
    true,
  );
  assert.equal(
    indexes.some(([actual, options]) => JSON.stringify(actual) === JSON.stringify(keys) && options.unique === true),
    false,
  );
});

test("versions payroll runs with operational totals and issues", () => {
  const schema = PayrollRunModel.schema;

  assert.equal(schema.get("optimisticConcurrency"), true);
  assert.equal(schema.get("versionKey"), "version");
  assert.equal(schema.path("branchId")?.options.required, true);
  assert.notEqual(schema.path("startDate")?.options.required, true);
  assert.notEqual(schema.path("endDate")?.options.required, true);
  for (const path of ["startDate", "endDate", "type", "parentRunId", "supplementalReason", "issues", "version"]) {
    assert.ok(schema.path(path), path);
  }
  assert.deepEqual(schema.path("type")?.options.enum, ["regular", "supplemental"]);
  assert.deepEqual(schema.path("status")?.options.enum, [
    "draft",
    "attendance_locked",
    "calculated",
    "reviewed",
    "approved",
    "closed",
    "partially_paid",
    "paid",
  ]);
  for (const path of ["grossPay", "deductions", "netPay"]) {
    assert.ok(schema.path(`totals.${path}`), path);
  }
  for (const path of ["code", "message", "runId", "severity", "remediation"]) {
    assert.ok(schema.path(`issues.${path}`), path);
  }
});

test("persists immutable employee attendance snapshots for a run", () => {
  const schema = PayrollAttendanceSnapshotModel.schema;

  for (const path of ["companyCode", "branchId", "runId", "periodKey", "employees", "lockedAt", "lockedBy"]) {
    assert.equal(schema.path(path)?.options.required, true, path);
  }
  const employeeSchema = (schema.path("employees") as any).schema;
  for (const path of ["employeeId", "standardHours", "standardDays", "workedMinutes", "shortageMinutes", "paidLeaveMinutesByRate", "overtime"]) {
    assert.equal(employeeSchema.path(path)?.options.required, true, path);
  }
  assert.equal(schema.path("lockedAt")?.options.immutable, true);
  assert.equal(schema.path("lockedBy")?.options.immutable, true);
  assert.equal(hasIndex(schema.indexes(), { companyCode: 1, runId: 1 }, { unique: true }), true);
});

test("stores a unique idempotency key per company for operation jobs", () => {
  const schema = PayrollOperationJobModel.schema;

  assert.equal(
    hasIndex(schema.indexes(), { companyCode: 1, idempotencyKey: 1 }, { unique: true }),
    true,
  );
  for (const path of ["companyCode", "branchId", "idempotencyKey", "operation", "status"]) {
    assert.equal(schema.path(path)?.options.required, true, path);
  }
  assert.deepEqual(schema.path("status")?.options.enum, ["queued", "running", "succeeded", "failed"]);
});
