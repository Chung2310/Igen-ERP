import { describe, expect, it } from "vitest";
import { buildActivityMonitorQuery, createActivityMonitorService } from "./activity-monitor.service";

const now = new Date("2026-10-23T10:00:00.000Z");
describe("activity monitor", () => {
  it("enforces literal search, tenant and account filters together", () => {
    const { filter, page, limit } = buildActivityMonitorQuery({ companyCode: " acme ", userId: "507f1f77bcf86cd799439011", search: ".*", result: "failure", category: "security", page: "2", limit: "30" }, now);
    expect(filter.companyCode).toBe("ACME");
    expect(String(filter.userId)).toBe("507f1f77bcf86cd799439011");
    expect(filter.description).toEqual({ $regex: "\\.\\*", $options: "i" });
    expect(filter.result).toBe("failure");
    expect(filter.category).toBe("security");
    expect([page, limit]).toEqual([2, 30]);
  });
  it.each([
    { companyCode: { $ne: "" } }, { userId: "invalid" }, { category: "password" }, { result: "partial" },
    { from: "2026-02-30" }, { from: "2026-10-24", to: "2026-10-23" },
    { from: "2025-01-01", to: "2026-10-23" }, { page: "1.5" }, { limit: "101" }, { search: "x".repeat(101) },
  ])("rejects malformed or unbounded query %j", (query) => {
    expect(() => buildActivityMonitorQuery(query, now)).toThrow();
  });
  it("returns scoped summary and projects only safe actor fields", async () => {
    let captured: any[] = [];
    const service = createActivityMonitorService({
      now: () => now,
      aggregate: async (pipeline) => { captured = pipeline; return [{ data: [{ eventId: "event-1" }], totals: [{ total: 64, failures: 3 }], companies: [{ count: 2 }], activeUsers: [{ count: 5 }] }]; },
      accounts: async () => [],
    });
    const result = await service.list({ companyCode: "ACME", page: "2" });
    expect(captured[0].$match.companyCode).toBe("ACME");
    expect(captured[1].$facet.data[1]).toEqual({ $skip: 30 });
    const lookup = captured[1].$facet.data.find((stage: any) => stage.$lookup).$lookup;
    expect(lookup.pipeline).toEqual([{ $project: { displayName: 1, email: 1, role: 1 } }]);
    expect(captured[1].$facet.data.at(-1).$project.password).toBeUndefined();
    expect(result.summary).toEqual({ failures: 3, companies: 2, activeUsers: 5 });
    expect(result.total).toBe(64);
    expect(result.retentionDays).toBe(90);
  });
  it("keeps account lookup scoped and treats regex characters literally", async () => {
    let filter: any;
    const service = createActivityMonitorService({ aggregate: async () => [], accounts: async (query) => { filter = query; return []; } });
    await service.accounts({ companyCode: "ACME", search: "[.*" });
    expect(filter.companyCode).toBe("ACME");
    expect(filter.$or[0].email.$regex).toBe("\\[\\.\\*");
  });
});
