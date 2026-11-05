import { describe, expect, it } from "vitest";
import { leadInsights, summarizeLeads } from "./marketingOverviewMetrics";
import type { ExtendedLeadCard } from "../../modules/marketing-suite/message/services/crmService";

const lead = (status: ExtendedLeadCard["status"], value: number): ExtendedLeadCard => ({
  id: `${status}-${value}`, customerName: "Khách hàng", company: "", value,
  phone: "", avatar: "", email: "", productOfChoice: "", status,
});

describe("summarizeLeads", () => {
  it("tách cơ hội đang theo đuổi và đã chốt, không cộng giá trị không hợp lệ", () => {
    const result = summarizeLeads([lead("cold", 100), lead("warm", 200), lead("won", 500), lead("upsell", Number.NaN)]);
    expect(result.total).toBe(4);
    expect(result.open).toBe(3);
    expect(result.openValue).toBe(300);
    expect(result.totalValue).toBe(800);
    expect(result.byStage.won).toBe(1);
  });
  it("chỉ tính cơ hội mới khi backend có ngày tạo hợp lệ", () => {
    const withDate = { ...lead("won", 500), createdAt: "2026-11-01T00:00:00.000Z", productOfChoice: "Gói A" };
    const withoutDate = lead("cold", 100);
    const result = leadInsights([withDate, withoutDate], new Date("2026-11-05T00:00:00.000Z"));
    expect(result.newLast30Days).toBe(1);
    expect(result.winRate).toBe(50);
    expect(result.averageWonValue).toBe(500);
    expect(result.products).toEqual([{ name: "Gói A", count: 1 }]);
    expect(leadInsights([withoutDate]).newLast30Days).toBeNull();
  });
});
