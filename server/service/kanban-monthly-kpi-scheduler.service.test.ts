import { describe, expect, it, vi } from "vitest";
import { runMonthlyKpiCloseScan } from "./kanban-monthly-kpi-scheduler.service";

describe("monthly KPI close scan", () => {
  it("closes the previous period once per company and branch scope", async () => {
    const close = vi.fn().mockResolvedValue({});
    const result = await runMonthlyKpiCloseScan(new Date("2026-09-01T02:00:00Z"), {
      listScopes: async () => [
        { companyCode: "A", branchId: "B1" },
        { companyCode: "A", branchId: "B1" },
        { companyCode: "A", branchId: "B2" },
      ],
      closePeriod: close,
    });
    expect(close).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledWith({ companyCode: "A", branchId: "B1" }, "2026-08", expect.any(Date));
    expect(result.closedScopes).toBe(2);
  });
});
