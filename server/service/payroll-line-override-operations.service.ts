import type { ClientSession } from "mongoose";
import { PAYROLL_LINE_OVERRIDE_FIELDS } from "../interface/payroll-line-override.interface";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { loadAuthoritativePayrollSourceLines } from "./payroll-effective-line.service";
import {
  runPayrollAtomicTransaction,
  type PayrollTransactionRunner,
} from "./payroll-transaction.service";

type PayrollScope = { companyCode: string; branchId: string };
type PayrollLineOverrideRow = {
  employeeId: string;
  expectedVersion: number;
  reason: string;
  values?: Record<string, number>;
  customValues?: Record<string, number>;
  clearFields?: string[];
};

type PayrollLineOverrideDependencies = {
  transactionRunner: PayrollTransactionRunner;
  loadSourceLines: (
    scope: PayrollScope,
    run: any,
    session?: ClientSession,
  ) => Promise<any[]>;
};

const allowedFields = new Set<string>(PAYROLL_LINE_OVERRIDE_FIELDS);
const customCodePattern = /^[A-Za-z][A-Za-z0-9_]*$/;
const CANONICAL_RUN_ORDER = { createdAt: 1 as const, _id: 1 as const };

const failure = (code: string, message: string, status = 400): never => {
  throw Object.assign(new Error(message), { code, status });
};

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
    ...clearFields
      .filter((field) => field.startsWith("custom."))
      .map((field) => field.slice("custom.".length)),
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
    if (validCoreField) delete values[field];
    else delete customValues[field.slice("custom.".length)];
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

async function canonicalEditableRun(scope: PayrollScope, periodKey: string) {
  const run = await PayrollRunModel.findOne({ ...scope, periodKey, type: "regular" })
    .sort(CANONICAL_RUN_ORDER)
    .lean();
  if (!run || run.status !== "draft") {
    failure(
      "PAYROLL_LINE_OVERRIDE_LOCKED",
      "Payroll line overrides require an existing draft regular run",
      409,
    );
  }
  return run;
}

async function claimDraftRun(
  scope: PayrollScope,
  periodKey: string,
  runId: string,
  session?: ClientSession,
) {
  const options = { new: true, ...(session ? { session } : {}) };
  const run = await withSession(PayrollRunModel.findOneAndUpdate(
    { _id: runId, ...scope, periodKey, type: "regular", status: "draft" },
    { $inc: { version: 1 } },
    options,
  ), session).lean();
  if (!run) {
    failure(
      "PAYROLL_LINE_OVERRIDE_LOCKED",
      "Payroll line overrides require the same draft regular run",
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

const normalizeBulkReason = (rows: PayrollLineOverrideRow[]) => {
  if (!Array.isArray(rows) || !rows.length) {
    failure("PAYROLL_LINE_OVERRIDE_ROWS_REQUIRED", "At least one payroll override row is required");
  }
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
    failure("PAYROLL_LINE_OVERRIDE_ROW_INVALID", "Every payroll override row must be an object");
  }
  const reasons = rows.map((row) => (
    typeof row.reason === "string" ? row.reason.trim() : ""
  ));
  if (reasons.some((reason) => !reason)) {
    failure("PAYROLL_LINE_OVERRIDE_REASON_REQUIRED", "A reconciliation reason is required");
  }
  if (new Set(reasons).size !== 1) {
    failure(
      "PAYROLL_LINE_OVERRIDE_REASON_MISMATCH",
      "Every row in a payroll override batch must use the same reason",
    );
  }
  return reasons[0];
};

export function createPayrollLineOverrideOperations(
  dependencies: PayrollLineOverrideDependencies,
) {
  const listPayrollLineOverrides = async (scope: PayrollScope, periodKey: string) => (
    PayrollLineOverrideModel.find({ ...scope, periodKey }).sort({ employeeId: 1 }).lean()
  );

  const savePayrollLineOverride = async (
    scope: PayrollScope,
    periodKey: string,
    runId: string,
    actorId: string,
    reason: string,
    row: PayrollLineOverrideRow,
  ) => {
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

    const employeeId = typeof row.employeeId === "string" ? row.employeeId.trim() : "";
    const { clearFields, customCodes, setValues, unsetValues, auditValues } = parseChanges(row);
    const expectedVersion = row.expectedVersion;
    const identity = { ...scope, periodKey, employeeId };
    return dependencies.transactionRunner(async (session) => {
      const run = await claimDraftRun(scope, periodKey, runId, session);
      const sourceLines = await dependencies.loadSourceLines(scope, run, session);
      if (!employeeId || !sourceLines.some((line) => String(line.employeeId) === employeeId)) {
        failure(
          "PAYROLL_LINE_OVERRIDE_EMPLOYEE_NOT_IN_RUN",
          "Employee is not part of the active payroll run",
          409,
        );
      }
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
          runId,
          ...(run.activeRevisionId ? { activeRevisionId: String(run.activeRevisionId) } : {}),
          employeeId,
          reason,
          values: auditValues,
          clearFields,
          before,
          after,
        },
      }, session);
      return after;
    });
  };

  const bulkSavePayrollLineOverrides = async (
    scope: PayrollScope,
    periodKey: string,
    actorId: string,
    rows: PayrollLineOverrideRow[],
  ) => {
    const reason = normalizeBulkReason(rows);
    const canonicalRun = await canonicalEditableRun(scope, periodKey);
    const runId = String(canonicalRun._id ?? "");
    const results = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const employeeId = typeof row.employeeId === "string" ? row.employeeId.trim() : "";
      try {
        results.push({
          employeeId,
          status: "success",
          data: await savePayrollLineOverride(
            scope,
            periodKey,
            runId,
            actorId,
            reason,
            row,
          ),
        });
      } catch (error: any) {
        if (error?.code === "PAYROLL_TRANSACTION_UNAVAILABLE") {
          const hasCommittedRow = results.some((result) => result.status === "success");
          if (!hasCommittedRow) throw error;
          for (const pending of rows.slice(index)) {
            results.push({
              employeeId: typeof pending.employeeId === "string" ? pending.employeeId.trim() : "",
              status: "error",
              code: error.code,
              message: error instanceof Error ? error.message : "Atomic payroll writes are unavailable",
            });
          }
          break;
        }
        results.push({
          employeeId,
          status: "error",
          code: error?.code ?? "PAYROLL_LINE_OVERRIDE_ERROR",
          message: error instanceof Error ? error.message : "Unable to save payroll line override",
        });
      }
    }
    return results;
  };

  return { listPayrollLineOverrides, bulkSavePayrollLineOverrides };
}

const payrollLineOverrideOperations = createPayrollLineOverrideOperations({
  transactionRunner: runPayrollAtomicTransaction,
  loadSourceLines: loadAuthoritativePayrollSourceLines,
});

export const listPayrollLineOverrides = payrollLineOverrideOperations.listPayrollLineOverrides;
export const bulkSavePayrollLineOverrides = payrollLineOverrideOperations.bulkSavePayrollLineOverrides;
