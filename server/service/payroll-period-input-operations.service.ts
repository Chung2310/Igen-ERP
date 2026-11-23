import type { ClientSession } from "mongoose";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { PayrollPeriodInputModel } from "../model/payroll-period-input.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollRunScopeReservationModel } from "../model/payroll-run-scope-reservation.model";
import { runPayrollAtomicTransaction } from "./payroll-transaction.service";

type Scope = { companyCode: string; branchId: string };
const periodInputFields = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"] as const;
const customVariableUnits = ["money", "number", "days", "hours", "minutes", "percent"] as const;
const customVariableMutableFields = ["code", "name", "description", "unit", "defaultValue"] as const;
const reservedCustomVariableCodes = new Set(Object.getOwnPropertyNames(Object.prototype).map((name) => name.toLowerCase()));

const failure = (code: string, message: string, status = 400): never => {
  throw Object.assign(new Error(message), { code, status });
};
const withSession = (query: any, session?: ClientSession) => (session ? query.session(session) : query);
const writeOptions = (session?: ClientSession) => ({ returnDocument: "after" as const, ...(session ? { session } : {}) });

async function createAudit(document: any, session?: ClientSession) {
  if (!session) return PayrollAuditModel.create(document);
  const [created] = await PayrollAuditModel.create([document], { session });
  return created;
}

const finiteNonNegative = (value: any) => value === undefined || (Number.isFinite(value) && value >= 0);
const duplicateCodeError = (error: any) => error?.code === 11000;

function buildPeriodInputChanges(input: any) {
  const { reason, expectedVersion, clearFields: rawClearFields, customValues: rawCustomValues } = input;
  const clearFields = Array.isArray(rawClearFields) ? [...new Set<string>(rawClearFields.map(String))] : [];
  for (const field of clearFields) {
    if (!periodInputFields.includes(field as any) && !/^custom\.[A-Za-z][A-Za-z0-9_]*$/.test(field)) {
      failure("PAYROLL_PERIOD_INPUT_CLEAR_FIELD_INVALID", `${field} không thể hoàn tác`);
    }
  }

  const values: Record<string, any> = {};
  for (const field of periodInputFields) {
    if (input[field] !== undefined) values[field] = input[field];
  }
  if (rawCustomValues != null) values.customValues = { ...rawCustomValues };

  for (const field of clearFields) {
    if (periodInputFields.includes(field as any)) delete values[field];
    else if (values.customValues) delete values.customValues[field.slice("custom.".length)];
  }
  if (values.customValues && !Object.keys(values.customValues).length) delete values.customValues;

  const unset = Object.fromEntries(clearFields.map((field) => [
    field.startsWith("custom.") ? `customValues.${field.slice("custom.".length)}` : field,
    1,
  ]));
  return { reason, expectedVersion, clearFields, values, unset };
}

export async function assertPeriodInputEditable(scope: Scope, periodKey: string, session?: ClientSession) {
  const query = withSession(PayrollRunModel.findOne({ ...scope, periodKey, type: "regular" }), session);
  const run: any = await query.sort({ createdAt: -1 }).lean();
  if (run && run.status !== "draft") failure("PAYROLL_PERIOD_INPUT_LOCKED", "Dữ liệu đầu vào đã bị khóa", 409);
  return run;
}

export async function listPayrollPeriodInputs(scope: Scope, periodKey: string) {
  const [items, variables, run] = await Promise.all([
    (PayrollPeriodInputModel as any).find({ ...scope, periodKey }).lean(),
    PayrollCustomVariableModel.find({ companyCode: scope.companyCode, status: "active" }).sort({ code: 1 }).lean(),
    PayrollRunModel.findOne({ ...scope, periodKey, type: "regular" }).sort({ createdAt: -1 }).lean(),
  ]);
  return { items, variables, editable: !run || run.status === "draft", needsRefresh: Boolean(run?.needsInputRefresh) };
}

async function assertActiveCustomCodes(companyCode: string, customCodes: string[], session?: ClientSession) {
  if (!customCodes.length) return new Map<string, string>();
  const query = withSession(PayrollCustomVariableModel.find({
    companyCode,
    status: "active",
    code: { $in: customCodes },
  }), session);
  const activeVariables = await query.select("code unit").lean();
  const units = new Map(activeVariables.map((variable: any) => [String(variable.code), String(variable.unit)]));
  const inactiveCode = customCodes.find((code) => !units.has(code));
  if (inactiveCode) {
    failure("PAYROLL_PERIOD_INPUT_CUSTOM_FIELD_INVALID", `Khoản bổ sung ${inactiveCode} chưa được bật`, 409);
  }
  return units;
}

export async function savePayrollPeriodInput(
  scope: Scope,
  periodKey: string,
  employeeId: string,
  actorId: string,
  input: any,
) {
  if (typeof input?.reason !== "string" || !input.reason.trim()) {
    failure("PAYROLL_PERIOD_INPUT_REASON_REQUIRED", "Cần nhập lý do đối soát");
  }
  for (const field of periodInputFields) {
    if (!finiteNonNegative(input[field])) failure("PAYROLL_PERIOD_INPUT_VALUE_INVALID", `${field} không hợp lệ`);
  }
  if (input.customValues != null && (typeof input.customValues !== "object" || Array.isArray(input.customValues))) {
    failure("PAYROLL_PERIOD_INPUT_VALUE_INVALID", "Danh sách khoản bổ sung không hợp lệ");
  }
  for (const value of Object.values(input.customValues ?? {})) {
    if (!finiteNonNegative(value)) failure("PAYROLL_PERIOD_INPUT_VALUE_INVALID", "Giá trị tùy chỉnh không hợp lệ");
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
    failure("PAYROLL_PERIOD_INPUT_VERSION_INVALID", "Phiên bản dữ liệu không hợp lệ");
  }

  const { reason, expectedVersion, clearFields, values, unset } = buildPeriodInputChanges(input);
  const filter = { ...scope, periodKey, employeeId, version: expectedVersion };
  const update: any = {
    $set: { ...values, reason: reason.trim(), updatedBy: actorId },
    $setOnInsert: { ...scope, periodKey, employeeId },
    $inc: { version: 1 },
  };
  if (Object.keys(unset).length) update.$unset = unset;

  const customCodes = Object.entries(values.customValues ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([code]) => code);

  try {
    return await runPayrollAtomicTransaction(async (session) => {
      // Serialize edits with regular-run creation, including when no run exists yet.
      await PayrollRunScopeReservationModel.findOneAndUpdate(
        { scopeKey: JSON.stringify([scope.companyCode, scope.branchId]) },
        { $setOnInsert: { ...scope }, $inc: { revision: 1 } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
      );

      const run = await assertPeriodInputEditable(scope, periodKey, session);
      if (run) {
        const guardedRun: any = await PayrollRunModel.findOneAndUpdate(
          { _id: run._id, ...scope, periodKey, type: "regular", status: "draft", version: run.version },
          { $set: { needsInputRefresh: true }, $inc: { version: 1 } },
          writeOptions(session),
        ).lean();
        if (!guardedRun) failure("PAYROLL_PERIOD_INPUT_LOCKED", "Dữ liệu đầu vào đã bị khóa", 409);
      }

      const customUnits = await assertActiveCustomCodes(scope.companyCode, customCodes, session);
      const invalidPercent = Object.entries(values.customValues ?? {}).find(([code, value]) => (
        customUnits.get(code) === "percent" && value !== undefined && Number(value) > 100
      ));
      if (invalidPercent) {
        failure("PAYROLL_PERIOD_INPUT_VALUE_INVALID", `Giá trị phần trăm của ${invalidPercent[0]} phải từ 0 đến 100`);
      }
      const before: any = await withSession(PayrollPeriodInputModel.findOne({ ...scope, periodKey, employeeId }), session).lean();
      const options = { ...writeOptions(session), upsert: expectedVersion === 0, runValidators: true };
      const updated: any = await withSession(
        PayrollPeriodInputModel.findOneAndUpdate(filter, update, options),
        session,
      ).lean();
      if (!updated) failure("PAYROLL_PERIOD_INPUT_VERSION_CONFLICT", "Dữ liệu đã được người khác thay đổi", 409);

      await createAudit({
        ...scope,
        periodKey,
        action: "adjustment",
        actorId,
        metadata: { operation: "period_input", employeeId, reason: reason.trim(), values, clearFields, before, after: updated },
      }, session);
      return updated;
    });
  } catch (error: any) {
    if (duplicateCodeError(error)) {
      failure("PAYROLL_PERIOD_INPUT_VERSION_CONFLICT", "Dữ liệu đã được người khác thay đổi", 409);
    }
    throw error;
  }
}

export async function bulkSavePayrollPeriodInputs(scope: Scope, periodKey: string, actorId: string, rows: any[]) {
  const results = [];
  for (const row of rows) {
    try {
      results.push({
        employeeId: row.employeeId,
        status: "success",
        data: await savePayrollPeriodInput(scope, periodKey, row.employeeId, actorId, row),
      });
    } catch (error: any) {
      results.push({ employeeId: row.employeeId, status: "error", code: error.code, message: error.message });
    }
  }
  return results;
}

export async function listPayrollCustomVariables(companyCode: string) {
  return PayrollCustomVariableModel.find({ companyCode }).sort({ code: 1 }).lean();
}

function customVariableInput(input: any, { creating = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    failure("PAYROLL_CUSTOM_VARIABLE_FIELD_INVALID", "Thông tin khoản bổ sung không hợp lệ");
  }
  const allowed = new Set(customVariableMutableFields);
  const unexpected = Object.keys(input ?? {}).find((field) => !allowed.has(field as any));
  if (unexpected) failure("PAYROLL_CUSTOM_VARIABLE_FIELD_INVALID", `Không thể sửa trường ${unexpected}`);

  const changes: Record<string, any> = {};
  if (creating || Object.hasOwn(input, "code")) {
    const code = typeof input.code === "string" ? input.code.trim().toLowerCase() : "";
    if (!code || !/^[A-Za-z][A-Za-z0-9_]*$/.test(code) || reservedCustomVariableCodes.has(code)) {
      failure("PAYROLL_CUSTOM_VARIABLE_CODE_INVALID", "Mã khoản phải bắt đầu bằng chữ cái, chỉ dùng chữ số và dấu gạch dưới, và không trùng tên dành riêng");
    }
    changes.code = code;
  }
  if (creating || Object.hasOwn(input, "name")) {
    if (typeof input.name !== "string" || !input.name.trim()) failure("PAYROLL_CUSTOM_VARIABLE_REQUIRED", "Mã và tên biến là bắt buộc");
    changes.name = input.name.trim();
  }
  if (Object.hasOwn(input, "description")) {
    if (typeof input.description !== "string") failure("PAYROLL_CUSTOM_VARIABLE_DESCRIPTION_INVALID", "Mô tả khoản không hợp lệ");
    changes.description = input.description.trim();
  }
  if (creating || Object.hasOwn(input, "unit")) {
    if (!customVariableUnits.includes(input.unit)) failure("PAYROLL_CUSTOM_VARIABLE_UNIT_INVALID", "Đơn vị khoản không hợp lệ");
    changes.unit = input.unit;
  }
  if (Object.hasOwn(input, "defaultValue") && input.defaultValue !== "" && input.defaultValue != null) {
    const value = Number(input.defaultValue);
    if (!Number.isFinite(value) || value < 0) failure("PAYROLL_CUSTOM_VARIABLE_VALUE_INVALID", "Giá trị mặc định phải là số không âm");
    const unit = changes.unit ?? input.unit;
    if (unit === "percent" && value > 100) failure("PAYROLL_CUSTOM_VARIABLE_VALUE_INVALID", "Phần trăm phải từ 0 đến 100");
    changes.defaultValue = value;
  }
  if (creating && input.defaultValue !== undefined && input.defaultValue !== "" && input.defaultValue != null && changes.defaultValue === undefined) {
    failure("PAYROLL_CUSTOM_VARIABLE_VALUE_INVALID", "Giá trị mặc định không hợp lệ");
  }
  return changes;
}

export async function createPayrollCustomVariable(companyCode: string, actorId: string, input: any) {
  const changes = customVariableInput(input, { creating: true });
  try {
    return await PayrollCustomVariableModel.create({ ...changes, companyCode, status: "draft", version: 0, createdBy: actorId });
  } catch (error: any) {
    if (duplicateCodeError(error)) failure("PAYROLL_CUSTOM_VARIABLE_CODE_DUPLICATE", "Mã khoản này đã được sử dụng", 409);
    throw error;
  }
}

export async function updatePayrollCustomVariable(companyCode: string, id: string, expectedVersion: number, input: any) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    failure("PAYROLL_CUSTOM_VARIABLE_VERSION_INVALID", "Phiên bản biến không hợp lệ");
  }
  const changes = customVariableInput(input);
  if (!Object.keys(changes).length) failure("PAYROLL_CUSTOM_VARIABLE_UPDATE_EMPTY", "Chưa có thông tin cần cập nhật");

  const current: any = await PayrollCustomVariableModel.findOne({ _id: id, companyCode }).lean();
  if (!current) failure("PAYROLL_CUSTOM_VARIABLE_NOT_FOUND", "Không tìm thấy biến", 404);
  if (current.status === "retired") failure("PAYROLL_CUSTOM_VARIABLE_INVALID_STATE", "Không thể sửa khoản đã ngừng áp dụng", 409);
  if (current.status !== "draft" && changes.code && changes.code !== current.code) {
    failure("PAYROLL_CUSTOM_VARIABLE_CODE_IMMUTABLE", "Không thể đổi mã biến đang dùng", 409);
  }
  const effectiveUnit = changes.unit ?? current.unit;
  const effectiveDefault = changes.defaultValue ?? current.defaultValue;
  if (effectiveUnit === "percent" && effectiveDefault !== undefined && effectiveDefault > 100) {
    failure("PAYROLL_CUSTOM_VARIABLE_VALUE_INVALID", "Phần trăm phải từ 0 đến 100");
  }
  let updated: any;
  try {
    updated = await PayrollCustomVariableModel.findOneAndUpdate(
      { _id: id, companyCode, version: expectedVersion, status: { $in: ["draft", "active"] } },
      { $set: changes, $inc: { version: 1 } },
      { returnDocument: "after", runValidators: true },
    ).lean();
  } catch (error: any) {
    if (duplicateCodeError(error)) failure("PAYROLL_CUSTOM_VARIABLE_CODE_DUPLICATE", "Mã khoản này đã được sử dụng", 409);
    throw error;
  }
  if (!updated) failure("PAYROLL_CUSTOM_VARIABLE_VERSION_CONFLICT", "Biến đã thay đổi", 409);
  return updated;
}

export async function activatePayrollCustomVariable(companyCode: string, id: string, actorId: string) {
  const value: any = await PayrollCustomVariableModel.findOneAndUpdate(
    { _id: id, companyCode, status: { $in: ["draft", "retired"] } },
    { $set: { status: "active", activatedBy: actorId }, $unset: { retiredBy: 1 }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!value) failure("PAYROLL_CUSTOM_VARIABLE_INVALID_STATE", "Không thể áp dụng biến", 409);
  return value;
}

export async function retirePayrollCustomVariable(companyCode: string, id: string, actorId: string) {
  const value: any = await PayrollCustomVariableModel.findOneAndUpdate(
    { _id: id, companyCode, status: "active" },
    { $set: { status: "retired", retiredBy: actorId }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!value) failure("PAYROLL_CUSTOM_VARIABLE_INVALID_STATE", "Không thể ngừng áp dụng biến", 409);
  return value;
}
