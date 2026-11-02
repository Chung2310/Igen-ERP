import { PayrollPublicationScheduleModel } from "../model/payroll-publication-schedule.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { duePublicationPeriods } from "./payroll-publication-schedule-state";
import { publishPayrollReconciliation } from "./payroll-reconciliation.service";

type Dependencies = {
  listSchedules: () => Promise<any[]>;
  listRuns: (scope: { companyCode: string; branchId: string }, periods: string[]) => Promise<any[]>;
  publish: typeof publishPayrollReconciliation;
  onError: (error: unknown) => void;
};
const defaults: Dependencies = {
  listSchedules: () => PayrollPublicationScheduleModel.find({ enabled: true }).lean(),
  listRuns: (scope, periods) => PayrollRunModel.find({ ...scope, periodKey: { $in: periods }, status: "draft", type: { $ne: "supplemental" }, reconciliationRequired: { $ne: true } }).lean(),
  publish: publishPayrollReconciliation,
  onError: error => console.error("[PayrollPublicationScheduler]", error),
};
export async function runPayrollPublicationScan(now = new Date(), dependencies: Dependencies = defaults) {
  let published = 0;
  for (const schedule of await dependencies.listSchedules()) {
    try {
      const periods = duePublicationPeriods(schedule, now);
      if (!periods.length) continue;
      const scope = { companyCode: schedule.companyCode, branchId: schedule.branchId };
      for (const run of await dependencies.listRuns(scope, periods)) {
        try {
          const result = await dependencies.publish(scope, String(run._id), "system:payroll-publication", Number(run.version ?? 0), { version: schedule.version, now });
          if (!result.skipped) published++;
        } catch (error) { dependencies.onError(error); }
      }
    } catch (error) { dependencies.onError(error); }
  }
  return { published };
}
export function startPayrollPublicationScheduler() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runPayrollPublicationScan(); }
    catch (error) { defaults.onError(error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
