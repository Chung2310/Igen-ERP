import mongoose, { type ClientSession } from "mongoose";
import {
  PAYROLL_LINE_OVERRIDE_FIELDS,
} from "../interface/payroll-line-override.interface";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { PayrollRunModel } from "../model/payroll-run.model";

type PayrollScope = { companyCode: string; branchId: string };
type PayrollLineOverrideRow = {
  employeeId: string;
  expectedVersion: number;
  reason: string;
  values?: Record<string, number>;
  customValues?: Record<string, number>;
  clearFields?: string[];
};

const allowedFields = new Set<string>(PAYROLL_LINE_OVERRIDE_FIELDS);
const customCodePattern = /^[A-Za-z][A-Za-z0-9_]*$/;

const failure = (code: string, message: string, status = 400): never => {
  throw Object.assign(new Error(message), { code, status });
};

async function inTransaction<T>(operation: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (mongoose.connection.readyState !== 1) return operation();
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

function assertValidValue(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    failure("PAYROLL_LINE_OVERRIDE_VALUE_INVALID", `${field} is not a finite non-negative number`);
  }
}

function parseChanges(row: PayrollLineOverrideRow) {
  const values = { ...(row.values ?? {}) };
  const customValues = { ...(row.customValues ?? {}) };
  const clearFields = [...new Set((row.clearFields ?? []).map(String))];
  const customCodes = [...new Set([
    ...Object.keys(customValues),
    ...clearFields.filter((field) => field.startsWith("custom.")).map((field) => field.slice("custom.".length)),
  ])];

  for (const [field, value] of Object.entries(values)) {
    if (!allowedFields.has(field)) {
      failure("PAYROLL_LINE_OVERRIDE_FIELD_INVALID", `${field} cannot be overridden`);
    }
    assertValidValue(value, field);
  }

  for (const [code, value] of Object.entries(customValues)) {
    if (!customCodePattern.test(code)) {
      failure("PAYROLL_LINE_OVERRIDE_FIELD_INVALID", `${code} is not a valid custom field code`);
    }
    assertValidValue(value, `custom.${code}`);
  }

  for (const field of clearFields) {
    const validCoreField = allowedFields.has(field);
    const validCustomField = field.startsWith("custom.")
      && customCodePattern.test(field.slice("custom.".length));
    if (!validCoreField && !validCustomField) {
      failure("PAYROLL_LINE_OVERRIDE_FIELD_INVALID", `${field} cannot be restored`);
    }

    if (validCoreField) {
      delete values[field];
    } else {
      delete customValues[field.slice("custom.".length)];
    }
  }

  const setValues: Record<string, number> = { ...values };
  for (const [code, value] of Object.entries(customValues)) {
    setValues[`customValues.${code}`] = value;
  }

  const unsetValues = Object.fromEntries(clearFields.map((field) => [
    field.startsWith("custom.") ? `customValues.${field.slice("custom.".length)}` : field,
    1,
  ]));
  const auditValues: Record<string, unknown> = { ...values };
  if (Object.keys(customValues).length) auditValues.customValues = customValues;

  return { clearFields, customCodes, setValues, unsetValues, auditValues };
}

async function assertActiveCustomCodes(
  scope: PayrollScope,
  customCodes: string[],
  session?: ClientSession,
) {
  if (!customCodes.length) return;
  const activeVariables = await withSession(PayrollCustomVariableModel.find({
    companyCode: scope.companyCode,
    status: "active",
    code: { $in: customCodes },
  }), session).lean();
  const activeCodes = new Set(activeVariables.map((variable) => variable.code));
  const invalidCode = customCodes.find((code) => !activeCodes.has(code));
  if (invalidCode) {
    failure(
      "PAYROLL_LINE_OVERRIDE_FIELD_INVALID",
      `custom.${invalidCode} is not an active company custom field`,
    );
  }
}

async function assertEditableRun(scope: PayrollScope, periodKey: string) {
  const run = await PayrollRunModel.findOne({ ...scope, periodKey, type: "regular" }).lean();
  if (!run || run.status !== "draft") {
    failure(
      "PAYROLL_LINE_OVERRIDE_LOCKED",
      "Payroll line overrides require an existing draft regular run",
      409,
    );
  }
}

async function claimDraftRun(scope: PayrollScope, periodKey: string, session?: ClientSession) {
  const options = { new: true, ...(session ? { session } : {}) };
  const run = await withSession(PayrollRunModel.findOneAndUpdate(
    { ...scope, periodKey, type: "regular", status: "draft" },
    { $inc: { version: 1 } },
    options,
  ), session).lean();
  if (!run) {
    failure(
      "PAYROLL_LINE_OVERRIDE_LOCKED",
      "Payroll line overrides require a draft regular run",
      409,
    );
  }
  return run;
}

async function createAudit(value: Record<string, unknown>, session?: ClientSession) {
  if (!session) return PayrollAuditModel.create(value as any);
  const [created] = await PayrollAuditModel.create([value as any], { session });
  return created;
}

export async function listPayrollLineOverrides(scope: PayrollScope, periodKey: string) {
  return PayrollLineOverrideModel.find({ ...scope, periodKey }).sort({ employeeId: 1 }).lean();
}

async function savePayrollLineOverride(
  scope: PayrollScope,
  periodKey: string,
  actorId: string,
  row: PayrollLineOverrideRow,
) {
  if (!row.reason?.trim()) {
    failure("PAYROLL_LINE_OVERRIDE_REASON_REQUIRED", "A reconciliation reason is required");
  }
  if (
    typeof row.expectedVersion !== "number"
    || !Number.isInteger(row.expectedVersion)
    || row.expectedVersion < 0
  ) {
    failure(
      "PAYROLL_LINE_OVERRIDE_VERSION_INVALID",
      "expectedVersion must be a supplied non-negative integer number",
    );
  }

  const { clearFields, customCodes, setValues, unsetValues, auditValues } = parseChanges(row);
  const reason = row.reason.trim();
  const expectedVersion = row.expectedVersion;
  const identity = { ...scope, periodKey, employeeId: row.employeeId };
  return inTransaction(async (session) => {
    await claimDraftRun(scope, periodKey, session);
    await assertActiveCustomCodes(scope, customCodes, session);
    const before = await withSession(PayrollLineOverrideModel.findOne(identity), session).lean();
    const update: Record<string, unknown> = {
      $set: { ...setValues, reason, updatedBy: actorId },
      $setOnInsert: identity,
      $inc: { version: 1 },
    };
    if (Object.keys(unsetValues).length) update.$unset = unsetValues;

    let after;
    try {
      after = await withSession(PayrollLineOverrideModel.findOneAndUpdate(
        { ...identity, version: expectedVersion },
        update,
        {
          new: true,
          upsert: expectedVersion === 0,
          runValidators: true,
          ...(session ? { session } : {}),
        },
      ), session).lean();
    } catch (error: any) {
      if (error?.code === 11000) {
        failure(
          "PAYROLL_LINE_OVERRIDE_VERSION_CONFLICT",
          "Payroll line override was changed by another user",
          409,
        );
      }
      throw error;
    }

    if (!after) {
      failure(
        "PAYROLL_LINE_OVERRIDE_VERSION_CONFLICT",
        "Payroll line override was changed by another user",
        409,
      );
    }

    await createAudit({
      ...scope,
      periodKey,
      action: "adjustment",
      actorId,
      metadata: {
        operation: "line_override",
        employeeId: row.employeeId,
        reason,
        values: auditValues,
        clearFields,
        before,
        after,
      },
    }, session);

    return after;
  });
}

export async function bulkSavePayrollLineOverrides(
  scope: PayrollScope,
  periodKey: string,
  actorId: string,
  rows: PayrollLineOverrideRow[],
) {
  await assertEditableRun(scope, periodKey);
  const results = [];
  for (const row of rows) {
    try {
      results.push({
        employeeId: row.employeeId,
        status: "success",
        data: await savePayrollLineOverride(scope, periodKey, actorId, row),
      });
    } catch (error: any) {
      results.push({
        employeeId: row.employeeId,
        status: "error",
        code: error?.code ?? "PAYROLL_LINE_OVERRIDE_ERROR",
        message: error instanceof Error ? error.message : "Unable to save payroll line override",
      });
    }
  }
  return results;
}
