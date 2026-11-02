import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ taskFind: vi.fn(), salesAggregate: vi.fn() }));

vi.mock("../model/kanban-task.model", () => ({
  KanbanTaskModel: { find: mocks.taskFind },
}));
vi.mock("../modules/retail/models/retail-order.model", () => ({
  RetailOrderModel: { aggregate: mocks.salesAggregate },
}));

import { getPayrollSalesKpiReport } from "./payroll-sales-kpi.service";

describe("payroll sales KPI report", () => {
  beforeEach(() => vi.resetAllMocks());

  it("compares monthly net POS sales with sales targets assigned on tasks", async () => {
    const tasks = [
      { assigneeUid: "employee-1", salesKpiTarget: 1_000_000 },
      { assigneeUid: "employee-1", salesKpiTarget: 3_000_000 },
      { assigneeUid: "employee-2", salesKpiTarget: 2_000_000 },
    ];
    mocks.taskFind.mockReturnValue({ select: () => ({ lean: async () => tasks }) });
    mocks.salesAggregate.mockResolvedValue([
      { _id: "employee-1", grossSales: 5_000_000, refunds: 1_000_000 },
    ]);

    const report = await getPayrollSalesKpiReport(
      { companyCode: "ACME", branchId: "branch-1" },
      "2026-08",
    );

    expect(report.rows).toEqual([
      { employeeId: "employee-1", targetAmount: 4_000_000, actualSales: 4_000_000, percent: 100 },
      { employeeId: "employee-2", targetAmount: 2_000_000, actualSales: 0, percent: 0 },
    ]);
    expect(mocks.taskFind).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      branchId: "branch-1",
      category: "Bán hàng",
      dueDate: { $gte: "2026-08-01", $lt: "2026-09-01" },
      salesKpiTarget: { $gt: 0 },
    }));
    expect(mocks.salesAggregate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ $match: expect.objectContaining({
        companyCode: "ACME",
        branchId: "branch-1",
        businessDate: { $gte: "2026-08-01", $lt: "2026-09-01" },
      }) }),
    ]));
  });

  it("rejects periods that are not YYYY-MM", async () => {
    await expect(getPayrollSalesKpiReport({ companyCode: "ACME" }, "2026-13"))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.taskFind).not.toHaveBeenCalled();
    expect(mocks.salesAggregate).not.toHaveBeenCalled();
  });
});
