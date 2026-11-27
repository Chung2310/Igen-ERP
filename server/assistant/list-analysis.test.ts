import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { analyzeList, collectAnalysisPages, reconcileRequestedRanking, validateListAnalysis, type AnalysisContract } from "./list-analysis";
const contract: AnalysisContract = { fields: { name: { label: "Tên", type: "text" }, score: { label: "Điểm", type: "number" }, status: { label: "Trạng thái", type: "text" } } };
const rows = [
  { name: "A", score: 10, status: "achieved", password: "private" }, { name: "B", score: 10, status: "achieved" },
  { name: "C", score: 3, status: "incomplete" }, { name: "D", score: 0, status: "not_set" },
];
describe("declarative list analysis independent of business modules", () => {
  it.each(["duplicate", "changed-total", "empty-page"])("rejects inconsistent pagination: %s", async kind => {
    let page = 0;
    const paginated = { ...contract, pagination: { pageField: "page", sizeField: "limit" } };
    await expect(collectAnalysisPages(paginated, {}, async () => {
      page++;
      return { data: page === 2 && kind === "empty-page" ? [] : [{ name: "An" }], analysisPage: { page, total: page === 2 && kind === "changed-total" ? 3 : 2, keys: page === 2 && kind === "empty-page" ? [] : ["same"] } };
    })).rejects.toThrow();
  });
  it("keeps ties and zero values", () => {
    expect(analyzeList(contract, rows, { extreme: { field: "score", direction: "max" }, limit: 1 }, true).records.map(r => r.Tên)).toEqual(["A", "B"]);
    expect(analyzeList(contract, rows, { extreme: { field: "score", direction: "min" } }, true).records[0].Tên).toBe("D");
  });
  it("recovers a ranking on the requested metric when the model omitted it", () => {
    const rankingContract: AnalysisContract = { fields: {
      partner: { label: "Đối tác", type: "text" },
      actualReferrals: { label: "Đã giới thiệu", type: "number", aliases: ["lao động", "giới thiệu"] },
      targetReferrals: { label: "Chỉ tiêu", type: "number" },
    } };
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", rankingContract, undefined))
      .toEqual({ kind: "resolved", analysis: { extreme: { field: "actualReferrals", direction: "max" } } });
  });
  it("maps labor referral wording onto the declared labor KPI field", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", {
      fields: { actualReferrals: operation.analysis!.fields.actualReferrals },
    }, undefined).kind).toBe("resolved");
    expect(reconcileRequestedRanking("Đối tác nào giới thiệu được nhiều lao động nhất trong tháng", operation.analysis!, undefined))
      .toMatchObject({ kind: "resolved", analysis: { extreme: { field: "actualReferrals", direction: "max" } } });
  });
  it("asks which metric to rank when a multi-metric report request is underspecified", () => {
    const result = reconcileRequestedRanking("Đối tác nào nhiều nhất trong tháng", {
      fields: { actualReferrals: { label: "Đã giới thiệu", type: "number" }, targetReferrals: { label: "Chỉ tiêu", type: "number" } },
    }, undefined);
    expect(result.kind).toBe("clarify");
  });
  it("treats top N as a sorted list with the requested size", () => {
    const result = reconcileRequestedRanking("Top 5 đối tác theo số lao động được giới thiệu", {
      fields: { actualReferrals: { label: "Đã giới thiệu", type: "number", aliases: ["lao động"] } },
    }, undefined);
    expect(result).toEqual({ kind: "resolved", analysis: { sort: { field: "actualReferrals", direction: "desc" }, limit: 5 } });
  });
  it("combines predicates and sorting without exposing other fields", () => {
    const result = analyzeList(contract, rows, { filters: [{ field: "score", operator: "gte", value: 3 }, { field: "status", operator: "ne", value: "achieved" }], sort: { field: "score", direction: "desc" }, limit: 2 }, true);
    expect(result.records).toEqual([{ Tên: "C", Điểm: "3", "Trạng thái": "incomplete" }]);
  });
  it("supports unenumerated combinations of group, count, sum and average", () => {
    expect(analyzeList(contract, rows, { groupBy: "status", aggregate: { operation: "count" } }, true).records[0]["Số lượng"]).toBe("2");
    expect(analyzeList(contract, rows, { aggregate: { operation: "sum", field: "score" } }, true).records[0]["Tổng điểm"]).toBe("23");
    expect(analyzeList(contract, rows, { filters: [{ field: "score", operator: "gt", value: 0 }], aggregate: { operation: "avg", field: "score" } }, true).records[0]["Trung bình điểm"]).toBe((23 / 3).toLocaleString("vi-VN"));
  });
  it("refuses incomplete populations", () => expect(() => analyzeList(contract, rows, {}, false)).toThrow("Chưa lấy đủ"));
  it.each([{ extreme: { field: "password", direction: "max" } }, { filters: [{ field: "score", operator: "gt", value: "2" }] }, { code: "return secrets" }, { limit: 0 }, { groupBy: "unknown", aggregate: { operation: "count" } }])("rejects unsupported or unsafe plans", plan => expect(() => validateListAnalysis(plan, contract)).toThrow());
  it("does not treat missing numbers as zero", () => {
    expect(analyzeList(contract, [{ name: "A", score: null }, { name: "B", score: 0 }], { extreme: { field: "score", direction: "min" } }, true).records.map(r => r.Tên)).toEqual(["B"]);
  });
});
