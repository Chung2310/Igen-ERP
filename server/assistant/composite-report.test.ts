import { afterEach, describe, expect, it, vi } from "vitest";

const mockProvider = vi.hoisted(() => vi.fn());
vi.mock("./planner-provider", () => ({ assistantAnalysisChat: (...args: unknown[]) => mockProvider(...args) }));

import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { ASSISTANT_OPERATIONS } from "./catalog";
import { buildAssistantAnalysisBusinessContext, isAssistantReadOnlyResult, requiresAssistantAnalysis, synthesizeAssistantAnalysis } from "./composite-report";

afterEach(() => mockProvider.mockReset());

describe("assistant read-result analysis", () => {
  it.each([
    ["Tổng hợp giúp tôi tỉ lệ chấm công hôm nay", true],
    ["Thống kê phép năm còn lại của nhân sự", true],
    ["Tháng này có bao nhiêu ứng viên onboard và chủ yếu ở phòng nào", true],
    ["Cho tôi xem danh sách nhân sự", false],
  ])("detects when a read result needs analysis: %s", (question, expected) => {
    expect(requiresAssistantAnalysis(question)).toBe(expected);
  });

  it("selects authorized read-only lookups and reports, but excludes mutations", () => {
    const lookup = ASSISTANT_OPERATIONS.find(candidate => candidate.assistantMetadata?.intent === "lookup" && candidate.method === "GET")!;
    const report = ASSISTANT_OPERATIONS.find(candidate => candidate.assistantMetadata?.intent === "report" && candidate.method === "GET")!;

    expect(isAssistantReadOnlyResult(lookup)).toBe(true);
    expect(isAssistantReadOnlyResult(report)).toBe(true);
    expect(isAssistantReadOnlyResult({ ...lookup, method: "POST", readOnly: false })).toBe(false);
    expect(isAssistantReadOnlyResult({ ...lookup, method: "POST", readOnly: true })).toBe(true);
  });

  it("builds analysis definitions from the selected public fields in the active catalog", () => {
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.path === "/worker-management/partners/kpi")!;
    const context = buildAssistantAnalysisBusinessContext(operation, ["actualReferrals", "id"]);

    expect(context.module).toBe("Đối tác lao động");
    expect(context.outputFields).toEqual([{ key: "actualReferrals", definition: expect.objectContaining({ label: "Đã giới thiệu" }) }]);
    expect(JSON.stringify(context)).not.toContain('"id"');
  });

  it("describes nested annual leave balance columns to the analysis agent", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({
      summary: "Số dư phép năm 2026 của nhân sự.",
      columns: ["Nhân sự", "Còn lại"],
      rows: [{ cells: ["Nguyễn An", 12] }],
      limitations: [],
    }) });
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.id === "leave.balances.list")!;
    const businessContext = buildAssistantAnalysisBusinessContext(operation, operation.resultFields);

    expect(businessContext.outputFields).toContainEqual({
      key: "balances",
      childFields: ["employeeName", "department", "entitlement", "used", "pending", "unexcused", "remaining"],
    });

    await synthesizeAssistantAnalysis("Thống kê lượt nghỉ phép còn lại của các nhân sư", [{
      title: operation.title,
      purpose: "Số phép năm còn lại theo nhân sự",
      businessContext,
      rows: [{ year: 2026, balances: [{ employeeName: "Nguyễn An", remaining: 12 }] }],
    }]);
    const payload = JSON.parse(mockProvider.mock.calls[0][0].messages[1].content);
    expect(payload.sources[0].businessContext.outputFields).toContainEqual({
      key: "balances",
      childFields: ["employeeName", "department", "entitlement", "used", "pending", "unexcused", "remaining"],
    });
    expect(payload.sources[0].rows[0].balances[0]).toEqual({ employeeName: "Nguyễn An", remaining: 12 });
  });

  it("sends a report and its clarification context to AI and returns a shared structured result table", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({
      summary: "Đối tác lao động theo lượt giới thiệu trong tháng 11/2026",
      columns: ["Đối tác", "Lượt giới thiệu"],
      rows: [{ cells: ["Công ty A", 12] }, { cells: ["Công ty B", 8] }],
      limitations: [],
    }) });

    const reply = await synthesizeAssistantAnalysis("Tháng 11, chỉ tính chi nhánh Hà Nội", [{
      title: "Kết quả KPI đối tác",
      purpose: "Lượt giới thiệu theo đối tác",
      businessContext: { module: "Đối tác lao động", outputFields: [{ key: "actualReferrals", definition: { label: "Đã giới thiệu", aliases: ["lượt giới thiệu"] } }] },
      rows: [{ partnerName: "Công ty A", referrals: 12 }, { partnerName: "Công ty B", referrals: 8 }],
    }], [
      { role: "user", content: "Tổng hợp lượt giới thiệu của đối tác có nhiều nhất trong tháng này." },
      { role: "assistant", content: "Bạn muốn xem tháng nào và phạm vi chi nhánh nào?" },
    ]);

    const sent = JSON.stringify(mockProvider.mock.calls[0][0].messages);
    expect(sent).toContain("Công ty A");
    expect(sent).toContain("Đã giới thiệu");
    expect(sent).toContain("Tổng hợp lượt giới thiệu của đối tác có nhiều nhất trong tháng này.");
    expect(sent).toContain("Tháng 11, chỉ tính chi nhánh Hà Nội");
    expect(sent).toContain("Chỉ kết luận điều được dữ liệu hỗ trợ");
    expect(parseAssistantResultTable(reply)).toEqual(expect.objectContaining({
      headers: ["Đối tác", "Lượt giới thiệu"],
      rows: expect.arrayContaining([expect.objectContaining({ values: { "Đối tác": "Công ty A", "Lượt giới thiệu": "12" } })]),
    }));
  });

  it("synthesizes an authorized lookup against the original request and keeps the shared table format", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({
      summary: "Lan đang làm việc tại phòng Kế toán.",
      columns: ["Nhân viên", "Phòng ban"],
      rows: [{ cells: ["Lan", "Kế toán"] }],
      limitations: [],
    }) });
    const operation = ASSISTANT_OPERATIONS.find(candidate => candidate.assistantMetadata?.intent === "lookup" && candidate.resultFields.includes("fullName"))!;
    const reply = await synthesizeAssistantAnalysis("Lan đang làm ở phòng nào?", [{
      title: operation.title,
      purpose: "Tra cứu phòng ban của Lan",
      businessContext: buildAssistantAnalysisBusinessContext(operation, operation.resultFields),
      rows: [{ fullName: "Lan", department: "Kế toán" }],
    }], [{ role: "user", content: "Tra cứu phòng ban của Lan" }]);

    const sent = JSON.stringify(mockProvider.mock.calls[0][0].messages);
    expect(sent).toContain("Tra cứu phòng ban của Lan");
    expect(sent).toContain("Lan");
    expect(parseAssistantResultTable(reply)).toEqual(expect.objectContaining({
      headers: ["Nhân viên", "Phòng ban"],
      rows: [expect.objectContaining({ values: { "Nhân viên": "Lan", "Phòng ban": "Kế toán" } })],
    }));
  });

  it("rejects malformed synthesis instead of presenting a partial answer", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({ summary: "x", columns: ["Chỉ tiêu", "Kết quả"], rows: [{ cells: ["chỉ tiêu"] }], limitations: [] }) });
    await expect(synthesizeAssistantAnalysis("Tổng hợp", [{ title: "API", purpose: "dữ liệu", businessContext: {}, rows: [] }])).rejects.toThrow("bảng tổng hợp hợp lệ");
  });
});
