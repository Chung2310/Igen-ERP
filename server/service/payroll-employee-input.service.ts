import type { IHRSalaryTerm } from "../interface/hr-contract.interface";
import type { PayrollIssue, PayrollSalaryTerm } from "./payroll-effective-input.service";

const isoDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

export type ContractLike = {
  _id?: unknown;
  id?: string;
  startDate: Date | string;
  endDate?: Date | string;
  status: string;
  salaryTerms?: IHRSalaryTerm[];
};

export type ResolvedEmployeeTerms = {
  terms: PayrollSalaryTerm[];
  insuranceSalaryByTerm: Map<string, number>;
  issues: PayrollIssue[];
};

/**
 * Turns effective-dated contract salary terms into payroll segments for one period.
 * Terms are clipped to the contract window so an expired contract stops paying.
 */
export function resolveEmployeeSalaryTerms(
  employeeId: string,
  contracts: ContractLike[],
  period: { start: string; end: string },
): ResolvedEmployeeTerms {
  const issues: PayrollIssue[] = [];
  const terms: PayrollSalaryTerm[] = [];
  const insuranceSalaryByTerm = new Map<string, number>();

  const active = contracts.filter((contract) => contract.status === "active" || contract.status === "expired");
  for (const contract of active) {
    const contractId = String(contract.id ?? contract._id ?? "");
    const contractStart = isoDate(contract.startDate);
    const contractEnd = contract.endDate ? isoDate(contract.endDate) : period.end;
    const salaryTerms = contract.salaryTerms ?? [];
    if (!salaryTerms.length) continue;

    salaryTerms.forEach((term, index) => {
      const start = isoDate(term.salaryEffectiveFrom);
      const end = term.salaryEffectiveTo ? isoDate(term.salaryEffectiveTo) : period.end;
      const clippedStart = [start, contractStart, period.start].sort().at(-1)!;
      const clippedEnd = [end, contractEnd, period.end].sort()[0]!;
      if (clippedStart > clippedEnd) return;

      const probationRate = term.probation ? (term.probationRate ?? 1) : 1;
      const monthlySalary = term.probation && term.probationSalary !== undefined
        ? term.probationSalary
        : Math.round(term.payrollSalary * probationRate);
      const id = `${contractId}:${index}`;
      terms.push({
        id,
        start: clippedStart,
        end: clippedEnd,
        monthlySalary,
        salaryType: term.salaryType,
        ...(term.probation ? { probation: true } : {}),
      });
      insuranceSalaryByTerm.set(id, Number(term.insuranceSalary || 0));
    });
  }

  if (!terms.length) {
    issues.push({
      code: "CONTRACT_SALARY_TERM_MISSING",
      message: "Nhân viên chưa có điều khoản lương hiệu lực trong kỳ",
      employeeId,
      severity: "blocking",
    });
  }

  return { terms, insuranceSalaryByTerm, issues };
}

/**
 * The insurance base for a period is the highest declared base among the paid segments.
 * Khi chưa hợp đồng nào khai báo mức đóng, lấy lương tháng làm mức đóng — nếu không
 * mọi quỹ bảo hiểm sẽ tính trên 0 và ra 0 đ. Trần đóng vẫn do insuranceBaseFor áp.
 */
export function resolveInsuranceSalary(
  terms: PayrollSalaryTerm[],
  insuranceSalaryByTerm: Map<string, number>,
  fallbackMonthlySalary = 0,
): number {
  const declared = terms.reduce((highest, term) => Math.max(highest, insuranceSalaryByTerm.get(term.id) ?? 0), 0);
  if (declared > 0) return declared;
  const fromTerms = terms.reduce((highest, term) => Math.max(highest, term.monthlySalary ?? 0), 0);
  return Math.max(fromTerms, Math.max(0, fallbackMonthlySalary));
}

export type DependentLike = { status: string; deductionFrom: Date | string; deductionTo?: Date | string };

/** Counts verified dependents whose deduction window touches the payroll period. */
export function countDependents(dependents: DependentLike[], period: { start: string; end: string }): number {
  return dependents.filter((dependent) => (
    dependent.status === "verified"
    && isoDate(dependent.deductionFrom) <= period.end
    && (!dependent.deductionTo || isoDate(dependent.deductionTo) >= period.start)
  )).length;
}

export type ProfileLike = {
  participatesInsurance?: boolean;
  taxMethod?: "progressive" | "shortTerm" | "nonResident";
  residencyStatus?: "resident" | "nonResident";
  hasWithholdingCommitment?: boolean;
  taxCode?: string;
  paymentMethod?: "transfer" | "cash";
  bankName?: string;
  bankCode?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string;
  status?: string;
};

export function selectProfileForPeriod(profiles: ProfileLike[], period: { start: string; end: string }): ProfileLike | undefined {
  return profiles
    .filter((profile) => profile.status !== "inactive")
    .filter((profile) => (
      (!profile.effectiveFrom || isoDate(profile.effectiveFrom) <= period.end)
      && (!profile.effectiveTo || isoDate(profile.effectiveTo) >= period.start)
    ))
    .sort((left, right) => isoDate(right.effectiveFrom ?? new Date(0)).localeCompare(isoDate(left.effectiveFrom ?? new Date(0))))[0];
}

/**
 * A non-resident is always taxed at the non-resident rate regardless of the
 * configured method, so residency wins over an inconsistent profile.
 */
export function resolveTaxMethod(profile: ProfileLike | undefined): "progressive" | "shortTerm" | "nonResident" {
  if (!profile) return "progressive";
  if (profile.residencyStatus === "nonResident") return "nonResident";
  return profile.taxMethod === "nonResident" ? "progressive" : (profile.taxMethod ?? "progressive");
}

export function profileWarnings(employeeId: string, profile: ProfileLike | undefined): PayrollIssue[] {
  const issues: PayrollIssue[] = [];
  if (!profile) {
    issues.push({ code: "PAYROLL_PROFILE_MISSING", message: "Nhân viên chưa có hồ sơ payroll", employeeId, severity: "warning" });
    return issues;
  }
  if (!profile.taxCode?.trim()) {
    issues.push({ code: "PAYROLL_TAX_CODE_MISSING", message: "Thiếu mã số thuế", employeeId, severity: "warning" });
  }
  if (!profile.bankAccountNumber?.trim()) {
    issues.push({ code: "PAYROLL_BANK_ACCOUNT_MISSING", message: "Thiếu số tài khoản ngân hàng", employeeId, severity: "warning" });
  }
  return issues;
}
