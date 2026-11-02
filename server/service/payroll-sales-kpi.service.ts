import { KanbanTaskModel } from "../model/kanban-task.model";
import { RetailOrderModel } from "../modules/retail/models/retail-order.model";

export type PayrollSalesKpiScope = { companyCode: string; branchId?: string };
export type PayrollSalesKpiRow = { employeeId: string; targetAmount: number; actualSales: number; percent: number };

function periodDateRange(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);
  if (!match) throw Object.assign(new Error("Kỳ KPI không hợp lệ. Vui lòng chọn tháng theo định dạng YYYY-MM."), { statusCode: 400 });
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = `${match[1]}-${match[2]}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7) + "-01";
  return { start, nextMonth };
}

export async function getPayrollSalesKpiReport(scope: PayrollSalesKpiScope, periodKey: string) {
  const { start, nextMonth } = periodDateRange(periodKey);
  const scopedFilter = {
    companyCode: scope.companyCode,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
  const [tasks, sales] = await Promise.all([
    KanbanTaskModel.find({
      ...scopedFilter,
      category: "Bán hàng",
      dueDate: { $gte: start, $lt: nextMonth },
      salesKpiTarget: { $gt: 0 },
    }).select("assigneeUid salesKpiTarget").lean(),
    RetailOrderModel.aggregate<{ _id: string; grossSales: number; refunds: number }>([
      {
        $match: {
          ...scopedFilter,
          businessDate: { $gte: start, $lt: nextMonth },
          status: { $in: ["confirmed", "completed"] },
          orderCode: { $type: "string", $ne: "" },
          salespersonId: { $type: "string", $ne: "" },
        },
      },
      {
        $group: {
          _id: "$salespersonId",
          grossSales: { $sum: { $ifNull: ["$grandTotal", 0] } },
          refunds: { $sum: { $ifNull: ["$refundedAmount", 0] } },
        },
      },
    ]),
  ]);

  const targetByEmployee = new Map<string, number>();
  for (const task of tasks) {
    const employeeId = String(task.assigneeUid || "");
    const target = Number(task.salesKpiTarget || 0);
    if (!employeeId || !Number.isFinite(target) || target <= 0) continue;
    targetByEmployee.set(employeeId, (targetByEmployee.get(employeeId) || 0) + target);
  }

  const salesByEmployee = new Map(sales.map((row) => [String(row._id), Number(row.grossSales || 0) - Number(row.refunds || 0)]));
  const rows: PayrollSalesKpiRow[] = [...targetByEmployee.entries()].map(([employeeId, targetAmount]) => {
    const actualSales = salesByEmployee.get(employeeId) || 0;
    return {
      employeeId,
      targetAmount,
      actualSales,
      percent: Math.round((actualSales / targetAmount) * 1000) / 10,
    };
  });

  return { periodKey, rows };
}
