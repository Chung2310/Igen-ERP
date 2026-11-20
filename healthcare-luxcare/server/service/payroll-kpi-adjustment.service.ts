export type PayrollKpiSourceStatus = "provisional" | "closed" | "no_tasks";

export type PayrollKpiSnapshot = {
  periodKey: string;
  systemPercent: number;
  appliedPercent: number;
  sourceStatus: PayrollKpiSourceStatus;
};

export function buildPayrollKpiSnapshot(
  periodKey: string,
  periodStatus: Exclude<PayrollKpiSourceStatus, "no_tasks">,
  percent: number | null,
): PayrollKpiSnapshot {
  const systemPercent = percent === null ? 100 : normalizeAppliedKpiPercent(percent);
  return {
    periodKey,
    systemPercent,
    appliedPercent: systemPercent,
    sourceStatus: percent === null ? "no_tasks" : periodStatus,
  };
}

export function normalizeAppliedKpiPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw Object.assign(new Error("KPI percentage must be between 0 and 100"), {
      code: "KPI_PERCENT_OUT_OF_RANGE",
    });
  }
  return Math.round(value * 10) / 10;
}

export function applyPayrollKpi(
  netBeforeKpi: number,
  deductionBeforeKpi: number,
  appliedKpiPercent: number,
) {
  const normalizedNet = Math.max(0, Math.round(netBeforeKpi));
  const normalizedDeductions = Math.max(0, Math.round(deductionBeforeKpi));
  const percent = normalizeAppliedKpiPercent(appliedKpiPercent);
  const netAfterKpi = Math.round(normalizedNet * percent / 100);
  const kpiAdjustment = normalizedNet - netAfterKpi;
  return {
    netBeforeKpi: normalizedNet,
    netAfterKpi,
    kpiAdjustment,
    deductions: normalizedDeductions + kpiAdjustment,
  };
}
