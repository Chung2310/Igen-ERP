import { describe, expect, it } from "vitest";
import { analyzeList, collectAnalysisPages, validateListAnalysis, type AnalysisContract } from "./list-analysis";
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
