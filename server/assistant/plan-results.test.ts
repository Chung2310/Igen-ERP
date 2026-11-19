import { expect, it } from "vitest";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { combineAssistantPlanResults } from "./plan-results";
it("preserves both result tables and the final follow-up in the shared structure", () => {
  const combined = combineAssistantPlanResults([
    formatAssistantResultTable("Đã cập nhật", [{Tên:"Lan", Phòng:"Kế toán"}]),
    formatAssistantResultTable("Đã tạo công việc", [{Tên:"Bàn giao", Hạn:"18/11/2026"}], ["Bạn có muốn bổ sung không?"]),
  ]);
  const parsed = parseAssistantResultTable(combined)!;
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0].values.Tên).toBe("Lan");
  expect(parsed.rows[1].values.Hạn).toBe("18/11/2026");
  expect(parsed.after).toContain("Bạn có muốn bổ sung không?");
});
