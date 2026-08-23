export type PayrollPolicyStatus = "draft" | "active" | "retired";

export type PayrollTaxBracket = {
  /** Upper bound of taxable income for this bracket, in VND. Omit on the top bracket. */
  upTo?: number;
  rate: number;
};

export type PayrollInsuranceFund = {
  code: "social" | "health" | "unemployment" | "accident" | "union";
  employeeRate: number;
  employerRate: number;
  /** Which cap applies to this fund. Unemployment uses the regional minimum wage cap. */
  capBasis: "baseSalary" | "regionalMinimum" | "none";
};

export interface IPayrollPolicy {
  companyCode: string;
  code: string;
  name: string;
  status: PayrollPolicyStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  sourceReference?: string;
  /** Mức lương cơ sở — caps social and health contributions at 20x. */
  baseSalary: number;
  regionalMinimumWage: number;
  socialCapMultiplier: number;
  unemploymentCapMultiplier: number;
  funds: PayrollInsuranceFund[];
  personalDeduction: number;
  dependentDeduction: number;
  taxBrackets: PayrollTaxBracket[];
  shortTermWithholdingRate: number;
  shortTermWithholdingThreshold: number;
  nonResidentRate: number;
  overtime: {
    weekday: number;
    restDay: number;
    holiday: number;
    nightPremium: number;
    nightOvertimeBonus: number;
  };
  roundingUnit: number;
  createdBy: string;
  activatedBy?: string;
  activatedAt?: Date;
  retiredBy?: string;
  version: number;
}
