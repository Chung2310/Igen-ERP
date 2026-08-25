import { KanbanTaskModel } from "../model/kanban-task.model";
import { KanbanMonthlyKpiSnapshotModel } from "../model/kanban-monthly-kpi-snapshot.model";
import { UserModel } from "../model/user.model";

export const KPI_TIMEZONE = "Asia/Ho_Chi_Minh" as const;

export type MonthlyKpiEmployee = { employeeId: string; employeeName: string; employeeAvatar: string };
export type MonthlyKpiTask = { assigneeUid: string; dueDate: string; status: string };
export type MonthlyKpiRow = MonthlyKpiEmployee & {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  percent: number | null;
};

export function periodBounds(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);
  if (!match) throw Object.assign(new Error("Kỳ KPI không hợp lệ. Vui lòng chọn tháng theo định dạng YYYY-MM."), { statusCode: 400 });
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - 7 * 60 * 60 * 1000),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) - 7 * 60 * 60 * 1000),
  };
}

export function currentPeriodKey(now = new Date()) {
  const vietnam = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return `${vietnam.getUTCFullYear()}-${String(vietnam.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousPeriodKey(now = new Date()) {
  const current = currentPeriodKey(now);
  const [year, month] = current.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dueInstant(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = hasZone ? raw : /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00+07:00` : `${raw}+07:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? undefined : date;
}

export function aggregateMonthlyKpiRows(employees: MonthlyKpiEmployee[], tasks: MonthlyKpiTask[], periodKey: string): MonthlyKpiRow[] {
  const { start, end } = periodBounds(periodKey);
  const counts = new Map<string, { total: number; completed: number }>();
  for (const task of tasks) {
    const status = task.status === "done" ? "Done" : task.status;
    if (status === "Archived") continue;
    const due = dueInstant(task.dueDate);
    if (!due || due < start || due >= end) continue;
    const count = counts.get(String(task.assigneeUid)) || { total: 0, completed: 0 };
    count.total += 1;
    if (status === "Done") count.completed += 1;
    counts.set(String(task.assigneeUid), count);
  }
  return employees.map((employee) => {
    const count = counts.get(String(employee.employeeId)) || { total: 0, completed: 0 };
    return {
      ...employee,
      totalTasks: count.total,
      completedTasks: count.completed,
      pendingTasks: count.total - count.completed,
      percent: count.total ? Math.round(count.completed * 1000 / count.total) / 10 : null,
    };
  });
}

export type MonthlyKpiScope = { companyCode: string; branchId?: string };

async function calculateRows(scope: MonthlyKpiScope) {
  const filter = { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  const [users, tasks] = await Promise.all([
    UserModel.find({ ...filter, role: { $ne: "superadmin" }, isActive: { $ne: false } }).select("_id displayName email photoURL").lean(),
    KanbanTaskModel.find(filter).select("assigneeUid dueDate status").lean(),
  ]);
  return { users, tasks };
}

export async function closeMonthlyKpiPeriod(scope: MonthlyKpiScope, periodKey: string, now = new Date()) {
  if (periodKey >= currentPeriodKey(now)) throw Object.assign(new Error("Chỉ có thể chốt kỳ KPI đã kết thúc."), { statusCode: 400 });
  const branchId = scope.branchId || "";
  const existing = await KanbanMonthlyKpiSnapshotModel.findOne({ companyCode: scope.companyCode, branchId, periodKey }).lean();
  if (existing) return existing;
  const { users, tasks } = await calculateRows(scope);
  const employees = users.map((user: any) => ({ employeeId: String(user._id), employeeName: user.displayName || user.email || "Nhân viên", employeeAvatar: user.photoURL || "" }));
  const rows = aggregateMonthlyKpiRows(employees, tasks as any[], periodKey);
  try {
    return await KanbanMonthlyKpiSnapshotModel.create({ companyCode: scope.companyCode, branchId, periodKey, timezone: KPI_TIMEZONE, status: "closed", closedAt: now, rows });
  } catch (error: any) {
    if (error?.code === 11000) return KanbanMonthlyKpiSnapshotModel.findOne({ companyCode: scope.companyCode, branchId, periodKey }).lean();
    throw error;
  }
}

export async function getMonthlyKpiReport(scope: MonthlyKpiScope, periodKey: string, now = new Date()) {
  periodBounds(periodKey);
  const current = currentPeriodKey(now);
  if (periodKey > current) throw Object.assign(new Error("Không thể xem KPI của tháng trong tương lai."), { statusCode: 400 });
  if (periodKey < current) {
    const snapshot: any = await closeMonthlyKpiPeriod(scope, periodKey, now);
    return { periodKey, periodStatus: "closed" as const, timezone: KPI_TIMEZONE, closedAt: snapshot.closedAt, rows: snapshot.rows };
  }
  const { users, tasks } = await calculateRows(scope);
  const employees = users.map((user: any) => ({ employeeId: String(user._id), employeeName: user.displayName || user.email || "Nhân viên", employeeAvatar: user.photoURL || "" }));
  return { periodKey, periodStatus: "provisional" as const, timezone: KPI_TIMEZONE, closedAt: null, rows: aggregateMonthlyKpiRows(employees, tasks as any[], periodKey) };
}
