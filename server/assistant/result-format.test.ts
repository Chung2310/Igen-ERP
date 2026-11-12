import { describe, expect, it } from "vitest";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { operationById } from "./catalog";
import { formatFriendlyAssistantResult } from "./result-format";

describe("student bulk result formatting", () => {
  it("renders invalid rows with the Excel row, learner, value and reason", () => {
    const operation = operationById("student.bulk.preview")!;
    const reply = formatFriendlyAssistantResult(operation, {
      errors: [{ row: 4, name: "Lê Minh Châu", phone: "SĐT giả lập 003", reason: "Số điện thoại không hợp lệ." }],
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toEqual({
      "Dòng": "4",
      "Học viên": "Lê Minh Châu",
      "Số điện thoại": "SĐT giả lập 003",
      "Lý do": "Số điện thoại không hợp lệ.",
    });
  });

  it("does not say records were created when every row was skipped", () => {
    const operation = operationById("student.bulk.create")!;
    const reply = formatFriendlyAssistantResult(operation, {
      importedCount: 0,
      skippedCount: 1,
      errors: [{ row: 2, name: "Nguyễn Văn An", phone: "SĐT giả lập 001", reason: "Số điện thoại không hợp lệ." }],
    });

    expect(reply).toContain("Đã nhập 0 học viên; bỏ qua 1 dòng · 1 kết quả:");
    expect(reply).not.toContain("đã tạo nhiều hồ sơ học viên");
    expect(parseAssistantResultTable(reply)?.rows[0]?.values["Học viên"]).toBe("Nguyễn Văn An");
  });
});
