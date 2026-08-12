export type FundCode = "social" | "health" | "unemployment" | "accident" | "union";
export type PolicyFundForm = { employeeRate: number; employerRate: number; capBasis: "baseSalary" | "regionalMinimum" | "none" };
export type PayrollPolicyForm = {
  code: string; name: string; effectiveFrom: string; effectiveTo: string; sourceReference: string;
  baseSalary: number; regionalMinimumWage: number; socialCapMultiplier: number; unemploymentCapMultiplier: number;
  funds: Record<FundCode, PolicyFundForm>;
  personalDeduction: number; dependentDeduction: number;
  taxBrackets: { upTo: string; rate: number }[];
  shortTermWithholdingRate: number; shortTermWithholdingThreshold: number; nonResidentRate: number;
  overtime: { weekday: number; restDay: number; holiday: number; nightPremium: number; nightOvertimeBonus: number };
  roundingUnit: number;
};

export type PayrollPolicyDefinition = Omit<PayrollPolicyForm, "effectiveTo" | "funds" | "taxBrackets" | "shortTermWithholdingRate" | "nonResidentRate"> & {
  effectiveTo?: string;
  funds: { code: FundCode; employeeRate: number; employerRate: number; capBasis: PolicyFundForm["capBasis"] }[];
  taxBrackets: { upTo?: number; rate: number }[];
  shortTermWithholdingRate: number;
  nonResidentRate: number;
};

const dateOnly = (value?: string | Date) => value ? new Date(value).toISOString().slice(0, 10) : "";
const percent = (value: number | undefined, fallback = 0) => (value ?? fallback) * 100;

export function createDefaultPayrollPolicyForm(): PayrollPolicyForm {
  return {
    code: "", name: "", effectiveFrom: dateOnly(new Date()), effectiveTo: "", sourceReference: "",
    baseSalary: 2_340_000, regionalMinimumWage: 4_960_000, socialCapMultiplier: 20, unemploymentCapMultiplier: 20,
    funds: {
      social: { employeeRate: 8, employerRate: 17.5, capBasis: "baseSalary" },
      health: { employeeRate: 1.5, employerRate: 3, capBasis: "baseSalary" },
      unemployment: { employeeRate: 1, employerRate: 1, capBasis: "regionalMinimum" },
      accident: { employeeRate: 0, employerRate: 0, capBasis: "baseSalary" },
      union: { employeeRate: 0, employerRate: 0, capBasis: "none" },
    },
    personalDeduction: 11_000_000, dependentDeduction: 4_400_000,
    taxBrackets: [{ upTo: "5000000", rate: 5 }, { upTo: "10000000", rate: 10 }, { upTo: "", rate: 20 }],
    shortTermWithholdingRate: 10, shortTermWithholdingThreshold: 2_000_000, nonResidentRate: 20,
    overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: 0.3, nightOvertimeBonus: 0.2 }, roundingUnit: 1,
  };
}

export function policyDefinitionToForm(definition: any): PayrollPolicyForm {
  const form = createDefaultPayrollPolicyForm();
  const fund = (code: FundCode) => definition.funds?.find((item: any) => item.code === code);
  return {
    ...form, ...definition,
    effectiveFrom: dateOnly(definition.effectiveFrom), effectiveTo: dateOnly(definition.effectiveTo),
    sourceReference: definition.sourceReference ?? "",
    funds: Object.fromEntries((["social", "health", "unemployment", "accident", "union"] as FundCode[]).map((code) => {
      const item = fund(code);
      return [code, item ? { ...item, employeeRate: percent(item.employeeRate), employerRate: percent(item.employerRate) } : form.funds[code]];
    })) as PayrollPolicyForm["funds"],
    taxBrackets: (definition.taxBrackets ?? form.taxBrackets).map((item: any) => ({ upTo: item.upTo == null ? "" : String(item.upTo), rate: percent(item.rate) })),
    shortTermWithholdingRate: percent(definition.shortTermWithholdingRate, 0.1),
    nonResidentRate: percent(definition.nonResidentRate, 0.2),
  };
}

export function payrollPolicyFormToDefinition(form: PayrollPolicyForm): PayrollPolicyDefinition {
  const definition: any = {
    ...form, effectiveFrom: form.effectiveFrom,
    funds: (Object.keys(form.funds) as FundCode[]).map((code) => ({ code, ...form.funds[code], employeeRate: form.funds[code].employeeRate / 100, employerRate: form.funds[code].employerRate / 100 })),
    taxBrackets: form.taxBrackets.map((item) => ({ ...(item.upTo.trim() ? { upTo: Number(item.upTo) } : {}), rate: item.rate / 100 })),
    shortTermWithholdingRate: form.shortTermWithholdingRate / 100,
    nonResidentRate: form.nonResidentRate / 100,
  };
  if (form.effectiveTo) definition.effectiveTo = form.effectiveTo; else delete definition.effectiveTo;
  if (!form.sourceReference.trim()) delete definition.sourceReference;
  return definition;
}

export type PayrollPolicyFormErrors = Record<string, string>;
const invalidNumber = (value: number) => !Number.isFinite(value) || value < 0;
const invalidPercent = (value: number) => invalidNumber(value) || value > 100;

export function validatePayrollPolicyStep(form: PayrollPolicyForm, step: number): PayrollPolicyFormErrors {
  const errors: PayrollPolicyFormErrors = {};
  if (step === 0) {
    if (!form.code.trim()) errors.code = "Vui lòng nhập mã công thức";
    if (!form.name.trim()) errors.name = "Vui lòng nhập tên công thức";
    if (!form.effectiveFrom) errors.effectiveFrom = "Vui lòng chọn ngày bắt đầu";
    if (form.effectiveTo && form.effectiveTo < form.effectiveFrom) errors.effectiveTo = "Ngày kết thúc phải sau ngày bắt đầu";
    (["baseSalary", "regionalMinimumWage", "socialCapMultiplier", "unemploymentCapMultiplier"] as const).forEach((key) => { if (invalidNumber(form[key])) errors[key] = "Giá trị không được âm"; });
  }
  if (step === 1) (Object.keys(form.funds) as FundCode[]).forEach((code) => {
    if (invalidPercent(form.funds[code].employeeRate)) errors[`funds.${code}.employeeRate`] = "Tỷ lệ phải từ 0 đến 100%";
    if (invalidPercent(form.funds[code].employerRate)) errors[`funds.${code}.employerRate`] = "Tỷ lệ phải từ 0 đến 100%";
  });
  if (step === 2) {
    const numeric = [form.personalDeduction, form.dependentDeduction, form.shortTermWithholdingThreshold];
    if (numeric.some(invalidNumber)) errors.taxAmounts = "Số tiền không được âm";
    if (invalidPercent(form.shortTermWithholdingRate) || invalidPercent(form.nonResidentRate) || form.taxBrackets.some((item) => invalidPercent(item.rate))) errors.taxRates = "Thuế suất phải từ 0 đến 100%";
    let previous = 0;
    form.taxBrackets.forEach((item, index) => { const bound = item.upTo === "" ? Infinity : Number(item.upTo); if (!Number.isFinite(bound) && item.upTo !== "" || bound <= previous || (bound === Infinity && index !== form.taxBrackets.length - 1)) errors.taxBrackets = "Các bậc thuế phải tăng dần; bậc cuối không giới hạn"; previous = bound; });
    if (!form.taxBrackets.length || form.taxBrackets.at(-1)?.upTo !== "") errors.taxBrackets = "Bậc thuế cuối phải không giới hạn";
  }
  if (step === 3) {
    Object.entries(form.overtime).forEach(([key, value]) => { if (invalidNumber(value)) errors[`overtime.${key}`] = "Hệ số không được âm"; });
    (["weekday", "restDay", "holiday"] as const).forEach((key) => { if (form.overtime[key] < 1) errors[`overtime.${key}`] = "Hệ số phải từ 1 trở lên"; });
    if (!Number.isInteger(form.roundingUnit) || form.roundingUnit < 1) errors.roundingUnit = "Đơn vị làm tròn phải là số nguyên dương";
  }
  return errors;
}

export function validatePayrollPolicyForm(form: PayrollPolicyForm): PayrollPolicyFormErrors {
  return Object.assign({}, ...[0, 1, 2, 3].map((step) => validatePayrollPolicyStep(form, step)));
}
