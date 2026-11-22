import { isPayrollFormulaVariable } from "../config/payroll-formula-variables";
import type {
  PayrollFormulaApplication,
  PayrollFormulaContext,
  PayrollFormulaDefinition,
  PayrollFormulaExpression,
} from "../interface/payroll-formula.interface";

type ValidationFailure = { code: string; message: string };
const roundingUnits = [1, 10, 100, 1000];
const binaryOperators = ["add", "subtract", "multiply", "divide", "min", "max"];
const comparisonOperators = ["equal", "notEqual", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];
const resultBuckets = ["allowance", "bonus", "deduction", "adjustment"];
const roundingModes = ["none", "nearest", "up", "down"];

function invalid(code: string, message: string): ValidationFailure {
  return { code, message };
}

function validateExpression(node: any, depth = 0): ValidationFailure | undefined {
  if (depth > 8) return invalid("PAYROLL_FORMULA_DEPTH_EXCEEDED", "Biểu thức vượt quá độ sâu cho phép");
  if (!node || typeof node !== "object" || Array.isArray(node)) return invalid("PAYROLL_FORMULA_EXPRESSION_INVALID", "Biểu thức không hợp lệ");
  if (node.type === "constant") {
    return Number.isFinite(node.value) ? undefined : invalid("PAYROLL_FORMULA_CONSTANT_INVALID", "Hằng số không hợp lệ");
  }
  if (node.type === "variable") {
    return typeof node.key === "string" && isPayrollFormulaVariable(node.key)
      ? undefined
      : invalid("PAYROLL_FORMULA_VARIABLE_INVALID", `Biến ${String(node.key)} không được phép`);
  }
  if (node.type === "percent") {
    return validateExpression(node.value, depth + 1) ?? validateExpression(node.rate, depth + 1);
  }
  if (node.type === "binary" && binaryOperators.includes(node.operator)) {
    if (node.operator === "divide" && node.right?.type === "constant" && node.right.value === 0) {
      return invalid("PAYROLL_FORMULA_DIVISION_BY_ZERO", "Không thể chia cho 0");
    }
    return validateExpression(node.left, depth + 1) ?? validateExpression(node.right, depth + 1);
  }
  return invalid("PAYROLL_FORMULA_OPERATOR_INVALID", "Toán tử không được phép");
}

const validDate = (value: unknown) => {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return false;
  return Number.isFinite(new Date(value).getTime());
};

export function validatePayrollFormulaDefinition(definition: any): ValidationFailure | undefined {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return invalid("PAYROLL_FORMULA_DEFINITION_INVALID", "Thông tin công thức không hợp lệ");
  }
  if (typeof definition.code !== "string" || !definition.code.trim() || definition.code.length > 100
    || typeof definition.name !== "string" || !definition.name.trim() || definition.name.length > 200) {
    return invalid("PAYROLL_FORMULA_REQUIRED", "Mã và tên công thức là bắt buộc");
  }
  if (definition.description !== undefined && (typeof definition.description !== "string" || definition.description.length > 1000)) {
    return invalid("PAYROLL_FORMULA_DESCRIPTION_INVALID", "Mô tả công thức không hợp lệ");
  }
  if (!resultBuckets.includes(definition.resultBucket)) {
    return invalid("PAYROLL_FORMULA_BUCKET_INVALID", "Nhóm kết quả không hợp lệ");
  }
  if (!Number.isSafeInteger(definition.priority)) {
    return invalid("PAYROLL_FORMULA_PRIORITY_INVALID", "Thứ tự ưu tiên phải là số nguyên hợp lệ");
  }
  if (definition.effectiveFrom !== undefined && !validDate(definition.effectiveFrom)) {
    return invalid("PAYROLL_FORMULA_EFFECTIVE_DATE_INVALID", "Ngày bắt đầu áp dụng không hợp lệ");
  }
  if (definition.effectiveTo !== undefined && definition.effectiveTo !== null && !validDate(definition.effectiveTo)) {
    return invalid("PAYROLL_FORMULA_EFFECTIVE_DATE_INVALID", "Ngày kết thúc áp dụng không hợp lệ");
  }
  if (definition.effectiveFrom !== undefined && definition.effectiveTo !== undefined && definition.effectiveTo !== null
    && new Date(definition.effectiveTo).getTime() < new Date(definition.effectiveFrom).getTime()) {
    return invalid("PAYROLL_FORMULA_EFFECTIVE_WINDOW_INVALID", "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu");
  }
  if (!definition.conditions || !["and", "or"].includes(definition.conditions.combinator)
    || !Array.isArray(definition.conditions.items) || definition.conditions.items.length > 100) {
    return invalid("PAYROLL_FORMULA_CONDITION_INVALID", "Điều kiện không hợp lệ");
  }
  for (const item of definition.conditions.items) {
    if (!item || typeof item !== "object" || !isPayrollFormulaVariable(item.left)
      || !comparisonOperators.includes(item.operator) || !Number.isFinite(item.right)) {
      return invalid("PAYROLL_FORMULA_CONDITION_INVALID", "Điều kiện không hợp lệ");
    }
  }
  if (!definition.rounding || !roundingModes.includes(definition.rounding.mode)
    || !roundingUnits.includes(definition.rounding.unit)) {
    return invalid("PAYROLL_FORMULA_ROUNDING_INVALID", "Quy tắc làm tròn không hợp lệ");
  }
  return validateExpression(definition.expression);
}

function required(context: PayrollFormulaContext, key: string) {
  const hasValue = Object.prototype.hasOwnProperty.call(context, key);
  const value = hasValue ? context[key as keyof PayrollFormulaContext] : undefined;
  if (!Number.isFinite(value)) throw new Error(`Thiếu biến ${key}`);
  return Number(value);
}

function finiteResult(value: number): number {
  if (!Number.isFinite(value)) {
    throw Object.assign(new Error("Kết quả công thức vượt giới hạn số hợp lệ"), { code: "PAYROLL_FORMULA_RESULT_INVALID" });
  }
  return value;
}

function expression(node: PayrollFormulaExpression, context: PayrollFormulaContext, trace: string[]): number {
  if (node.type === "constant") return node.value;
  if (node.type === "variable") return required(context, node.key);
  if (node.type === "percent") {
    const result = finiteResult(expression(node.value, context, trace) * expression(node.rate, context, trace) / 100);
    trace.push(`percent = ${result}`);
    return result;
  }

  const left = expression(node.left, context, trace);
  const right = expression(node.right, context, trace);
  if (node.operator === "divide" && right === 0) throw new Error("Không thể chia cho 0");
  const result = node.operator === "add" ? left + right
    : node.operator === "subtract" ? left - right
      : node.operator === "multiply" ? left * right
        : node.operator === "divide" ? left / right
          : node.operator === "min" ? Math.min(left, right)
            : Math.max(left, right);
  finiteResult(result);
  trace.push(`${node.operator}(${left}, ${right}) = ${result}`);
  return result;
}

function compare(left: number, operator: string, right: number) {
  return operator === "equal" ? left === right
    : operator === "notEqual" ? left !== right
      : operator === "greaterThan" ? left > right
        : operator === "greaterThanOrEqual" ? left >= right
          : operator === "lessThan" ? left < right
            : left <= right;
}

function rounded(value: number, mode: string, unit: number) {
  if (mode === "none") return value;
  const scaled = value / unit;
  const roundedUnits = mode === "up" ? Math.ceil(scaled) : mode === "down" ? Math.floor(scaled) : Math.round(scaled);
  return finiteResult(roundedUnits * unit);
}

export function evaluatePayrollFormula(
  formula: PayrollFormulaDefinition & { version?: number },
  context: PayrollFormulaContext,
): PayrollFormulaApplication {
  const invalidDefinition = validatePayrollFormulaDefinition(formula);
  if (invalidDefinition) throw Object.assign(new Error(invalidDefinition.message), invalidDefinition);
  const checks = formula.conditions.items.map((item) => compare(required(context, item.left), item.operator, item.right));
  const applied = checks.length === 0 || (formula.conditions.combinator === "and" ? checks.every(Boolean) : checks.some(Boolean));
  const trace = checks.map((value, index) => `condition ${index + 1} = ${value}`);
  const value = applied ? rounded(expression(formula.expression, context, trace), formula.rounding.mode, formula.rounding.unit) : 0;
  if (applied) trace.push(`rounded = ${value}`);
  return { code: formula.code, name: formula.name, version: formula.version ?? 0, bucket: formula.resultBucket, applied, value, variables: context, trace };
}

export function evaluatePayrollFormulas(
  formulas: Array<PayrollFormulaDefinition & { version?: number }>,
  context: PayrollFormulaContext,
) {
  const applications = [...formulas]
    .sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code))
    .map((item) => evaluatePayrollFormula(item, context));
  const totals = { allowance: 0, bonus: 0, deduction: 0, adjustment: 0 };
  for (const item of applications) {
    if (!item.applied) continue;
    const nextTotal = totals[item.bucket] + item.value;
    totals[item.bucket] = finiteResult(nextTotal);
  }
  return { applications, totals };
}
