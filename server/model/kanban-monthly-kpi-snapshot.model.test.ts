import { describe, expect, it } from "vitest";
import { KanbanMonthlyKpiSnapshotModel } from "./kanban-monthly-kpi-snapshot.model";

describe("KanbanMonthlyKpiSnapshotModel", () => {
  it("keeps one immutable monthly snapshot per tenant branch", () => {
    const indexes = KanbanMonthlyKpiSnapshotModel.schema.indexes();
    expect(indexes.some(([keys, options]) =>
      JSON.stringify(keys) === JSON.stringify({ companyCode: 1, branchId: 1, periodKey: 1 }) && options.unique,
    )).toBe(true);
    expect((KanbanMonthlyKpiSnapshotModel.schema.path("status") as any).enumValues).toEqual(["closed"]);
    const row = (KanbanMonthlyKpiSnapshotModel.schema.path("rows") as any).schema;
    expect((row.path("percent") as any).options.max).toBe(100);
  });
});
