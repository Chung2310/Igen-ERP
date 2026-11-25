import { afterEach, describe, expect, it, vi } from "vitest";

const mockProvider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: (...args: unknown[]) => mockProvider(...args) }));

import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { synthesizeCompositeAssistantReport } from "./composite-report";

afterEach(() => mockProvider.mockReset());

describe("composite report synthesis", () => {
  it("sends source data to AI and returns a shared structured result table", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({
      summary: "Đối tác lao động theo lượt giới thiệu trong tháng 11/2026",
      columns: ["Đối tác", "Lượt giới thiệu"],
      rows: [{ cells: ["Công ty A", 12] }, { cells: ["Công ty B", 8] }],
      limitations: [],
    }) });

    const reply = await synthesizeCompositeAssistantReport("Tổng hợp lượt giới thiệu tháng 11/2026", [{
      title: "Kết quả KPI đối tác",
      purpose: "Lượt giới thiệu theo đối tác",
      rows: [{ partnerName: "Công ty A", referrals: 12 }, { partnerName: "Công ty B", referrals: 8 }],
    }]);

    const sent = JSON.stringify(mockProvider.mock.calls[0][0].messages);
    expect(sent).toContain("Công ty A");
    expect(sent).toContain("Chỉ kết luận điều được dữ liệu hỗ trợ");
    expect(parseAssistantResultTable(reply)).toEqual(expect.objectContaining({
      headers: ["Đối tác", "Lượt giới thiệu"],
      rows: expect.arrayContaining([expect.objectContaining({ values: { "Đối tác": "Công ty A", "Lượt giới thiệu": "12" } })]),
    }));
  });

  it("rejects malformed synthesis instead of presenting a partial answer", async () => {
    mockProvider.mockResolvedValue({ text: JSON.stringify({ summary: "x", columns: ["Chỉ tiêu", "Kết quả"], rows: [{ cells: ["chỉ tiêu"] }], limitations: [] }) });
    await expect(synthesizeCompositeAssistantReport("Tổng hợp", [{ title: "API", purpose: "dữ liệu", rows: [] }])).rejects.toThrow("bảng tổng hợp hợp lệ");
  });
});
