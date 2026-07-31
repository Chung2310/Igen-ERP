export type PayrollIssue = {
  code: string;
  message: string;
  employeeId: string;
  severity: "blocking" | "warning";
};

export type PayrollSalaryTerm = {
  id: string;
  start: string;
  end: string;
  monthlySalary: number;
  salaryType?: "monthly" | "daily" | "hourly";
  probation?: boolean;
};

export type DetailedPayrollInput = {
  employeeId: string;
  period?: { start: string; end: string };
  policy?: { id: string; version: number };
  activeDependents?: string[];
  segments: Array<{
    sourceId: string;
    start: string;
    end: string;
    monthlySalary: number;
    salaryType?: "monthly" | "daily" | "hourly";
    probation?: boolean;
  }>;
  issues?: PayrollIssue[];
};

type PayrollInputSource = {
  period: { start: string; end: string };
  salaryTerms?: PayrollSalaryTerm[];
  policy?: { id: string; version: number };
  dependents?: { id: string; start: string; end: string }[];
};

const day = (value: string) => new Date(value + "T00:00:00.000Z").getTime();

export async function resolveDetailedPayrollInput(employeeId: string, source: PayrollInputSource): Promise<DetailedPayrollInput> {
  const { period } = source;
  const issues: PayrollIssue[] = [];
  const terms = (source.salaryTerms ?? [])
    .map((term) => ({ ...term, start: term.start < period.start ? period.start : term.start, end: term.end > period.end ? period.end : term.end }))
    .filter((term) => term.start <= term.end)
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

  if (!source.policy) issues.push({ code: "PAYROLL_POLICY_MISSING", message: "Payroll policy is missing for this period.", employeeId, severity: "blocking" });
  if (!terms.length) issues.push({ code: "SALARY_TERM_MISSING", message: "No effective salary term covers this period.", employeeId, severity: "blocking" });

  for (let index = 1; index < terms.length; index += 1) {
    if (day(terms[index].start) <= day(terms[index - 1].end)) {
      issues.push({ code: "SALARY_TERM_OVERLAP", message: "Salary terms overlap.", employeeId, severity: "blocking" });
    }
  }

  return {
    employeeId,
    period,
    policy: source.policy,
    activeDependents: (source.dependents ?? []).filter((dependent) => dependent.start <= period.end && dependent.end >= period.start).map((dependent) => dependent.id),
    segments: terms.map(({ id, start, end, monthlySalary, salaryType, probation }) => ({ sourceId: id, start, end, monthlySalary, salaryType, probation })),
    issues,
  };
}



