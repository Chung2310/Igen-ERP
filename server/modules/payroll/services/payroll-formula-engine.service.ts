import { isPayrollFormulaVariable } from "../config/payroll-formula-variables";
import type { PayrollFormulaApplication, PayrollFormulaContext, PayrollFormulaDefinition, PayrollFormulaExpression } from "../interfaces/payroll-formula.interface";

type ValidationFailure = { code: string; message: string };
const units = [1, 10, 100, 1000];
const binaries = ["add", "subtract", "multiply", "divide", "min", "max"];
const comparisons = ["equal", "notEqual", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];

function validateExpression(node: any, depth = 0): ValidationFailure | undefined {
  if (depth > 8) return { code: "PAYROLL_FORMULA_DEPTH_EXCEEDED", message: "Biểu thức vượt quá độ sâu cho phép" };
  if (!node || typeof node !== "object") return { code: "PAYROLL_FORMULA_EXPRESSION_INVALID", message: "Biểu thức không hợp lệ" };
  if (node.type === "constant") return Number.isFinite(node.value) ? undefined : { code: "PAYROLL_FORMULA_CONSTANT_INVALID", message: "Hằng số không hợp lệ" };
  if (node.type === "variable") return isPayrollFormulaVariable(node.key) ? undefined : { code: "PAYROLL_FORMULA_VARIABLE_INVALID", message: `Biến ${node.key} không được phép` };
  if (node.type === "percent") return validateExpression(node.value, depth + 1) ?? validateExpression(node.rate, depth + 1);
  if (node.type === "binary" && binaries.includes(node.operator)) {
    if (node.operator === "divide" && node.right?.type === "constant" && node.right.value === 0) return { code: "PAYROLL_FORMULA_DIVISION_BY_ZERO", message: "Không thể chia cho 0" };
    return validateExpression(node.left, depth + 1) ?? validateExpression(node.right, depth + 1);
  }
  return { code: "PAYROLL_FORMULA_OPERATOR_INVALID", message: "Toán tử không được phép" };
}

export function validatePayrollFormulaDefinition(definition: any): ValidationFailure | undefined {
  if (!definition?.code?.trim() || !definition?.name?.trim()) return { code: "PAYROLL_FORMULA_REQUIRED", message: "Mã và tên công thức là bắt buộc" };
  if (!["allowance", "bonus", "deduction", "adjustment"].includes(definition.resultBucket)) return { code: "PAYROLL_FORMULA_BUCKET_INVALID", message: "Nhóm kết quả không hợp lệ" };
  if (!Number.isInteger(definition.priority)) return { code: "PAYROLL_FORMULA_PRIORITY_INVALID", message: "Thứ tự ưu tiên phải là số nguyên" };
  if (!["and", "or"].includes(definition.conditions?.combinator) || !Array.isArray(definition.conditions?.items)) return { code: "PAYROLL_FORMULA_CONDITION_INVALID", message: "Điều kiện không hợp lệ" };
  for (const item of definition.conditions.items) if (!isPayrollFormulaVariable(item.left) || !comparisons.includes(item.operator) || !Number.isFinite(item.right)) return { code: "PAYROLL_FORMULA_CONDITION_INVALID", message: "Điều kiện không hợp lệ" };
  if (!["none", "nearest", "up", "down"].includes(definition.rounding?.mode) || !units.includes(definition.rounding?.unit)) return { code: "PAYROLL_FORMULA_ROUNDING_INVALID", message: "Quy tắc làm tròn không hợp lệ" };
  return validateExpression(definition.expression);
}

function required(context: PayrollFormulaContext, key: string) { const value = context[key as keyof PayrollFormulaContext]; if (!Number.isFinite(value)) throw new Error(`Thiếu biến ${key}`); return Number(value); }
function expression(node: PayrollFormulaExpression, context: PayrollFormulaContext, trace: string[]): number {
  if (node.type === "constant") return node.value;
  if (node.type === "variable") return required(context, node.key);
  if (node.type === "percent") { const result = expression(node.value, context, trace) * expression(node.rate, context, trace) / 100; trace.push(`percent = ${result}`); return result; }
  const left = expression(node.left, context, trace), right = expression(node.right, context, trace);
  if (node.operator === "divide" && right === 0) throw new Error("Không thể chia cho 0");
  const result = node.operator === "add" ? left + right : node.operator === "subtract" ? left - right : node.operator === "multiply" ? left * right : node.operator === "divide" ? left / right : node.operator === "min" ? Math.min(left, right) : Math.max(left, right);
  trace.push(`${node.operator}(${left}, ${right}) = ${result}`); return result;
}
function compare(left: number, operator: string, right: number) { return operator === "equal" ? left === right : operator === "notEqual" ? left !== right : operator === "greaterThan" ? left > right : operator === "greaterThanOrEqual" ? left >= right : operator === "lessThan" ? left < right : left <= right; }
function rounded(value: number, mode: string, unit: number) { if (mode === "none") return value; const scaled = value / unit; return (mode === "up" ? Math.ceil(scaled) : mode === "down" ? Math.floor(scaled) : Math.round(scaled)) * unit; }

export function evaluatePayrollFormula(formula: PayrollFormulaDefinition & { version?: number }, context: PayrollFormulaContext): PayrollFormulaApplication {
  const invalid = validatePayrollFormulaDefinition(formula); if (invalid) throw Object.assign(new Error(invalid.message), invalid);
  const checks = formula.conditions.items.map((item) => compare(required(context, item.left), item.operator, item.right));
  const applied = checks.length === 0 || (formula.conditions.combinator === "and" ? checks.every(Boolean) : checks.some(Boolean));
  const trace = checks.map((value, index) => `condition ${index + 1} = ${value}`);
  const value = applied ? rounded(expression(formula.expression, context, trace), formula.rounding.mode, formula.rounding.unit) : 0;
  if (applied) trace.push(`rounded = ${value}`);
  return { code: formula.code, name: formula.name, version: formula.version ?? 0, bucket: formula.resultBucket, applied, value, variables: context, trace };
}

export function evaluatePayrollFormulas(formulas: Array<PayrollFormulaDefinition & { version?: number }>, context: PayrollFormulaContext) {
  const applications = [...formulas].sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code)).map((item) => evaluatePayrollFormula(item, context));
  const totals = { allowance: 0, bonus: 0, deduction: 0, adjustment: 0 };
  applications.filter((item) => item.applied).forEach((item) => { totals[item.bucket] += item.value; });
  return { applications, totals };
}
