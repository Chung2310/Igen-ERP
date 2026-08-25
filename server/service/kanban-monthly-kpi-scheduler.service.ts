import { UserModel } from "../model/user.model";
import { closeMonthlyKpiPeriod, previousPeriodKey, type MonthlyKpiScope } from "./kanban-monthly-kpi.service";

type SchedulerDependencies = {
  listScopes: () => Promise<MonthlyKpiScope[]>;
  closePeriod: typeof closeMonthlyKpiPeriod;
};

const defaultDependencies: SchedulerDependencies = {
  listScopes: async () => (await UserModel.find({ companyCode: { $nin: [null, "", "SYSTEM"] }, role: { $ne: "superadmin" }, isActive: { $ne: false } })
    .select("companyCode branchId").lean()).map((user: any) => ({ companyCode: user.companyCode, ...(user.branchId ? { branchId: String(user.branchId) } : {}) })),
  closePeriod: closeMonthlyKpiPeriod,
};

export async function runMonthlyKpiCloseScan(now = new Date(), dependencies: SchedulerDependencies = defaultDependencies) {
  const unique = new Map<string, MonthlyKpiScope>();
  for (const scope of await dependencies.listScopes()) {
    if (!scope.companyCode) continue;
    unique.set(`${scope.companyCode}:${scope.branchId || ""}`, scope);
  }
  const periodKey = previousPeriodKey(now);
  for (const scope of unique.values()) await dependencies.closePeriod(scope, periodKey, now);
  return { periodKey, closedScopes: unique.size };
}

export function startMonthlyKpiScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await runMonthlyKpiCloseScan(); }
    catch (error) { console.error("[MonthlyKpiScheduler]", error); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => void run(), 60 * 60 * 1000);
  timer.unref?.();
  return () => clearInterval(timer);
}
