import type { IPayrollPolicy, PayrollInsuranceFund, PayrollTaxBracket } from "../interface/payroll-policy.interface";

export type OvertimeDayCategory = "weekday" | "restDay" | "holiday";

export type OvertimeEntry = {
  minutes: number;
  category: OvertimeDayCategory;
  /** Hours worked between 22:00 and 06:00 attract the night premium. */
  night?: boolean;
};

export type PayrollTaxMethod = "progressive" | "shortTerm" | "nonResident";

export type InsuranceFundAmount = {
  code: PayrollInsuranceFund["code"];
  base: number;
  employeeRate: number;
  employerRate: number;
  employeeAmount: number;
  employerAmount: number;
};

export type TaxBracketAmount = { upTo?: number; rate: number; taxableAmount: number; tax: number };

const round = (value: number, unit: number) => {
  if (!(unit > 0)) return Math.round(value);
  return Math.round(value / unit) * unit;
};

/**
 * Overtime is paid on top of the hourly rate. Night work adds a flat premium and
 * night overtime adds a further bonus computed on the weekday overtime rate,
 * which is how Bộ luật Lao động 2019 điều 98 expresses the night OT formula.
 */
export function overtimeMultiplier(policy: IPayrollPolicy, entry: OvertimeEntry): number {
  const base = policy.overtime[entry.category];
  if (!entry.night) return base;
  return base + policy.overtime.nightPremium + policy.overtime.nightOvertimeBonus * policy.overtime.weekday;
}

export function calculateOvertimePay(policy: IPayrollPolicy, hourlyRate: number, overtime: OvertimeEntry[]) {
  const details = overtime.map((entry) => {
    const multiplier = overtimeMultiplier(policy, entry);
    return {
      category: entry.category,
      night: Boolean(entry.night),
      minutes: entry.minutes,
      multiplier,
      amount: round((entry.minutes / 60) * hourlyRate * multiplier, policy.roundingUnit),
    };
  });
  return { details, total: details.reduce((sum, item) => sum + item.amount, 0) };
}

/**
 * Social and health contributions are capped at a multiple of the base salary,
 * unemployment at a multiple of the regional minimum wage.
 */
export function insuranceBaseFor(policy: IPayrollPolicy, fund: PayrollInsuranceFund, insuranceSalary: number): number {
  if (fund.capBasis === "none") return Math.max(0, insuranceSalary);
  const cap = fund.capBasis === "regionalMinimum"
    ? policy.regionalMinimumWage * policy.unemploymentCapMultiplier
    : policy.baseSalary * policy.socialCapMultiplier;
  return Math.min(Math.max(0, insuranceSalary), cap);
}

export function calculateInsurance(policy: IPayrollPolicy, insuranceSalary: number, participates = true) {
  const funds: InsuranceFundAmount[] = participates
    ? policy.funds.map((fund) => {
      const base = insuranceBaseFor(policy, fund, insuranceSalary);
      return {
        code: fund.code,
        base,
        employeeRate: fund.employeeRate,
        employerRate: fund.employerRate,
        employeeAmount: round(base * fund.employeeRate, policy.roundingUnit),
        employerAmount: round(base * fund.employerRate, policy.roundingUnit),
      };
    })
    : [];
  return {
    funds,
    employeeTotal: funds.reduce((sum, fund) => sum + fund.employeeAmount, 0),
    employerTotal: funds.reduce((sum, fund) => sum + fund.employerAmount, 0),
  };
}

export function calculateProgressiveTax(brackets: PayrollTaxBracket[], taxableIncome: number, roundingUnit = 1) {
  const income = Math.max(0, taxableIncome);
  let previousCeiling = 0;
  const details: TaxBracketAmount[] = [];
  for (const bracket of brackets) {
    if (income <= previousCeiling) break;
    const ceiling = bracket.upTo ?? Number.POSITIVE_INFINITY;
    const amountInBracket = Math.min(income, ceiling) - previousCeiling;
    details.push({
      ...(bracket.upTo === undefined ? {} : { upTo: bracket.upTo }),
      rate: bracket.rate,
      taxableAmount: amountInBracket,
      tax: round(amountInBracket * bracket.rate, roundingUnit),
    });
    previousCeiling = ceiling;
  }
  return { details, tax: details.reduce((sum, item) => sum + item.tax, 0) };
}

export function calculatePersonalIncomeTax(policy: IPayrollPolicy, args: {
  method: PayrollTaxMethod;
  taxableIncome: number;
  employeeInsurance: number;
  dependentCount: number;
  otherDeductions?: number;
  /** A valid cam kết 08/CK-TNCN suspends short-term withholding. */
  hasWithholdingCommitment?: boolean;
}) {
  const taxableIncome = Math.max(0, args.taxableIncome);
  if (args.method === "nonResident") {
    return {
      method: args.method,
      deductions: { personal: 0, dependents: 0, insurance: 0, other: 0, total: 0 },
      assessableIncome: taxableIncome,
      brackets: [] as TaxBracketAmount[],
      tax: round(taxableIncome * policy.nonResidentRate, policy.roundingUnit),
    };
  }
  if (args.method === "shortTerm") {
    const below = taxableIncome < policy.shortTermWithholdingThreshold;
    const exempt = args.hasWithholdingCommitment || below;
    return {
      method: args.method,
      deductions: { personal: 0, dependents: 0, insurance: 0, other: 0, total: 0 },
      assessableIncome: taxableIncome,
      brackets: [] as TaxBracketAmount[],
      tax: exempt ? 0 : round(taxableIncome * policy.shortTermWithholdingRate, policy.roundingUnit),
    };
  }

  const dependents = Math.max(0, args.dependentCount) * policy.dependentDeduction;
  const other = Math.max(0, args.otherDeductions ?? 0);
  const insurance = Math.max(0, args.employeeInsurance);
  const total = policy.personalDeduction + dependents + insurance + other;
  const assessableIncome = Math.max(0, taxableIncome - total);
  const progressive = calculateProgressiveTax(policy.taxBrackets, assessableIncome, policy.roundingUnit);
  return {
    method: args.method,
    deductions: { personal: policy.personalDeduction, dependents, insurance, other, total },
    assessableIncome,
    brackets: progressive.details,
    tax: progressive.tax,
  };
}

export type VietnamPayrollInput = {
  /** Pay earned from attendance, already prorated across contract segments. */
  workPay: number;
  overtime: OvertimeEntry[];
  hourlyRate: number;
  /** Income items that are taxable and count towards insurance where flagged. */
  taxableAllowances?: number;
  exemptAllowances?: number;
  bonuses?: number;
  otherDeductions?: number;
  advances?: number;
  insuranceSalary: number;
  participatesInsurance?: boolean;
  taxMethod?: PayrollTaxMethod;
  dependentCount?: number;
  hasWithholdingCommitment?: boolean;
  employerOtherCosts?: number;
};

export type VietnamPayrollResult = ReturnType<typeof calculateVietnamPayroll>;

export function calculateVietnamPayroll(policy: IPayrollPolicy, input: VietnamPayrollInput) {
  const overtime = calculateOvertimePay(policy, input.hourlyRate, input.overtime ?? []);
  const taxableAllowances = Math.max(0, input.taxableAllowances ?? 0);
  const exemptAllowances = Math.max(0, input.exemptAllowances ?? 0);
  const bonuses = Math.max(0, input.bonuses ?? 0);
  const workPay = Math.max(0, input.workPay);

  const totalIncome = workPay + overtime.total + taxableAllowances + exemptAllowances + bonuses;
  const taxableIncome = workPay + overtime.total + taxableAllowances + bonuses;

  const insurance = calculateInsurance(policy, input.insuranceSalary, input.participatesInsurance ?? true);
  const tax = calculatePersonalIncomeTax(policy, {
    method: input.taxMethod ?? "progressive",
    taxableIncome,
    employeeInsurance: insurance.employeeTotal,
    dependentCount: input.dependentCount ?? 0,
    hasWithholdingCommitment: input.hasWithholdingCommitment,
  });

  const otherDeductions = Math.max(0, input.otherDeductions ?? 0);
  const advances = Math.max(0, input.advances ?? 0);
  const withheld = insurance.employeeTotal + tax.tax + otherDeductions + advances;
  const rawNet = totalIncome - withheld;
  // Deductions may exceed income; the excess is carried forward instead of silently dropped.
  const carryForward = rawNet < 0 ? -rawNet : 0;
  const netPay = Math.max(0, rawNet);

  const warnings: Array<{ code: string; message: string; severity: "blocking" | "warning" }> = [];
  if (carryForward > 0) {
    warnings.push({
      code: "PAYROLL_DEDUCTIONS_EXCEED_INCOME",
      message: "Các khoản khấu trừ vượt thu nhập; phần vượt được chuyển kỳ sau",
      severity: "warning",
    });
  }

  return {
    policyId: (policy as any)._id ? String((policy as any)._id) : undefined,
    policyVersion: policy.version,
    formulaVersion: "vietnam-payroll-2",
    workPay,
    overtime,
    income: { taxableAllowances, exemptAllowances, bonuses, totalIncome, taxableIncome },
    insurance,
    tax,
    deductions: { other: otherDeductions, advances, total: withheld },
    netPay,
    carryForward,
    employerCost: totalIncome + insurance.employerTotal + Math.max(0, input.employerOtherCosts ?? 0),
    warnings,
  };
}
