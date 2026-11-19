import { expect, it } from "vitest";
import { formatBusinessOverview } from "./overview-result";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
it("keeps zero counts, unknown attendance, and money in separate public metrics", () => {
  const reply = formatBusinessOverview({ education: { students: 0, tuition: 1200000 }, hr: { checkedIn: null, tasks: { total: 12 }, overdueTasks: 1 }, range: { from: "2026-11-01", to: "2026-11-30" } });
  const rows = parseAssistantResultTable(reply)!.rows.map(row => row.values);
  expect(rows).toContainEqual({ "Phân hệ": "Học viên", "Chỉ tiêu": "Tổng học viên", "Giá trị": "0" });
  expect(rows).toContainEqual({ "Phân hệ": "Học viên", "Chỉ tiêu": "Học phí thu trong kỳ", "Giá trị": "1.200.000 ₫" });
  expect(rows).toContainEqual({ "Phân hệ": "Nhân sự", "Chỉ tiêu": "Đã chấm công", "Giá trị": "Chưa có dữ liệu" });
  expect(rows).toContainEqual({ "Phân hệ": "Nhân sự", "Chỉ tiêu": "Tổng công việc", "Giá trị": "12" });
  expect(reply).toContain("01/11/2026");
});
it("omits inaccessible data and marks failed sections instead of inventing zero", () => {
  const reply = formatBusinessOverview({ access: { education: false }, education: { students: 999 }, hr: { employees: 888 }, errors: ["hr"], secret: "do-not-display" });
  expect(reply).toContain("chưa đầy đủ");
  expect(reply).not.toContain("999");
  expect(reply).not.toContain("888");
  expect(reply).not.toContain("do-not-display");
});
