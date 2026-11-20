import { DEFAULT_PAYROLL_FORMULA_TEMPLATES } from "../config/payroll-formula-templates";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { PayrollFormulaModel } from "../model/payroll-formula.model";
import { validatePayrollFormulaDefinition } from "./payroll-formula-engine.service";

const formulaFields = [
  "code", "name", "description", "resultBucket", "priority", "effectiveFrom", "effectiveTo",
  "conditions", "expression", "rounding",
] as const;

function reject(error: any): never {
  throw Object.assign(new Error(error.message), { code: error.code, status: error.status ?? 400 });
}

function validated(input: any) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    reject({ code: "PAYROLL_FORMULA_DEFINITION_INVALID", message: "Thông tin công thức không hợp lệ" });
  }
  const unexpected = Object.keys(input).find((field) => !formulaFields.includes(field as any));
  if (unexpected) {
    reject({ code: "PAYROLL_FORMULA_FIELD_INVALID", message: `Không thể sửa trường ${unexpected}` });
  }
  const definition = Object.fromEntries(formulaFields
    .filter((field) => Object.prototype.hasOwnProperty.call(input, field))
    .map((field) => [field, input[field]]));
  const invalid = validatePayrollFormulaDefinition(definition);
  if (invalid) reject(invalid);
  return {
    ...definition,
    code: definition.code.trim(),
    name: definition.name.trim(),
    ...(typeof definition.description === "string" ? { description: definition.description.trim() } : {}),
  };
}

const duplicateFormula = (error: any) => error?.code === 11000;
const duplicateFailure = () => reject({
  code: "PAYROLL_FORMULA_DUPLICATE",
  message: "Mã công thức đã tồn tại",
  status: 409,
});

function customVariableCodes(definition: any) {
  const codes = new Set<string>();
  for (const condition of definition.conditions?.items ?? []) {
    if (typeof condition.left === "string" && condition.left.startsWith("custom.")) {
      codes.add(condition.left.slice("custom.".length));
    }
  }
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "variable" && typeof node.key === "string" && node.key.startsWith("custom.")) {
      codes.add(node.key.slice("custom.".length));
    }
    if (node.type === "binary") {
      visit(node.left);
      visit(node.right);
    } else if (node.type === "percent") {
      visit(node.value);
      visit(node.rate);
    }
  };
  visit(definition.expression);
  return [...codes];
}

async function assertActiveCustomVariables(companyCode: string, definition: any) {
  const codes = customVariableCodes(definition);
  if (!codes.length) return;
  const active: any[] = await PayrollCustomVariableModel.find({
    companyCode,
    status: "active",
    code: { $in: codes },
  }).select("code").lean();
  const activeCodes = new Set(active.map((variable) => String(variable.code)));
  const missing = codes.find((code) => !activeCodes.has(code));
  if (missing) {
    reject({
      code: "PAYROLL_FORMULA_CUSTOM_VARIABLE_INVALID",
      message: `Khoản bổ sung ${missing} chưa được bật`,
      status: 409,
    });
  }
}

export async function listPayrollFormulas(companyCode: string) {
  let items: any[] = await PayrollFormulaModel.find({ companyCode }).sort({ priority: 1, code: 1 }).lean();
  if (!items.length) {
    await Promise.all(DEFAULT_PAYROLL_FORMULA_TEMPLATES.map((template) => (
      createPayrollFormula(companyCode, "system", template).catch((error: any) => {
        if (error?.code !== "PAYROLL_FORMULA_DUPLICATE") throw error;
      })
    )));
    items = await PayrollFormulaModel.find({ companyCode }).sort({ priority: 1, code: 1 }).lean();
  }
  return items;
}

export async function createPayrollFormula(companyCode: string, actorId: string, input: any) {
  try {
    return await PayrollFormulaModel.create({
      ...validated(input),
      companyCode,
      status: "draft",
      version: 0,
      createdBy: actorId,
    });
  } catch (error: any) {
    if (duplicateFormula(error)) duplicateFailure();
    throw error;
  }
}

export async function updatePayrollFormula(companyCode: string, id: string, expectedVersion: number, input: any) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    reject({ code: "PAYROLL_FORMULA_VERSION_INVALID", message: "Phiên bản công thức không hợp lệ" });
  }
  const definition = validated(input);
  const current: any = await PayrollFormulaModel.findOne({ _id: id, companyCode }).lean();
  if (!current) reject({ code: "PAYROLL_FORMULA_NOT_FOUND", message: "Không tìm thấy công thức", status: 404 });
  if (current.status === "active") await assertActiveCustomVariables(companyCode, definition);
  try {
    const updated: any = await PayrollFormulaModel.findOneAndUpdate(
      { _id: id, companyCode, status: { $in: ["draft", "active"] }, version: expectedVersion },
      { $set: definition, $inc: { version: 1 } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) reject({ code: "PAYROLL_FORMULA_VERSION_CONFLICT", message: "Công thức đã thay đổi hoặc không thể sửa", status: 409 });
    return updated;
  } catch (error: any) {
    if (duplicateFormula(error)) duplicateFailure();
    throw error;
  }
}

export async function activatePayrollFormula(companyCode: string, id: string, actorId: string) {
  const current: any = await PayrollFormulaModel.findOne({
    _id: id,
    companyCode,
    status: { $in: ["draft", "retired"] },
  }).lean();
  if (!current) reject({ code: "PAYROLL_FORMULA_INVALID_STATE", message: "Không thể áp dụng công thức", status: 409 });
  const invalidDefinition = validatePayrollFormulaDefinition(current);
  if (invalidDefinition) reject(invalidDefinition);
  await assertActiveCustomVariables(companyCode, current);
  const value: any = await PayrollFormulaModel.findOneAndUpdate(
    { _id: id, companyCode, version: current.version, status: { $in: ["draft", "retired"] } },
    {
      $set: { status: "active", activatedBy: actorId, activatedAt: new Date() },
      $unset: { retiredBy: 1 },
      $inc: { version: 1 },
    },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!value) reject({ code: "PAYROLL_FORMULA_VERSION_CONFLICT", message: "Công thức đã thay đổi, hãy tải lại trước khi áp dụng", status: 409 });
  return value;
}

export async function retirePayrollFormula(companyCode: string, id: string, actorId: string) {
  const value: any = await PayrollFormulaModel.findOneAndUpdate(
    { _id: id, companyCode, status: "active" },
    { $set: { status: "retired", retiredBy: actorId }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  if (!value) reject({ code: "PAYROLL_FORMULA_INVALID_STATE", message: "Chỉ có thể ngưng công thức đang áp dụng", status: 409 });
  return value;
}

export async function clonePayrollFormula(companyCode: string, id: string, actorId: string, code: string) {
  const source: any = await PayrollFormulaModel.findOne({ _id: id, companyCode }).lean();
  if (!source) reject({ code: "PAYROLL_FORMULA_NOT_FOUND", message: "Không tìm thấy công thức", status: 404 });
  const definition = Object.fromEntries(formulaFields
    .filter((field) => field !== "code" && field !== "name" && Object.prototype.hasOwnProperty.call(source, field))
    .map((field) => [field, source[field]]));
  return createPayrollFormula(companyCode, actorId, {
    ...definition,
    code,
    name: `${source.name} - Bản sao`,
  });
}
