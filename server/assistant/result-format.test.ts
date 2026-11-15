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

describe("nested API result fields", () => {
  it("shows only explicitly approved fields from nested result objects", () => {
    const source = operationById("customer.list")!;
    const operation = {
      ...source,
      title: "Lịch sử giao dịch khách hàng",
      resultFields: ["name", "items"],
      resultChildFields: { items: ["orderCode", "amount"] },
    };
    const reply = formatFriendlyAssistantResult(operation, [{
      name: "La Văn Sến",
      items: [{ orderCode: "DH-001", amount: 250000, customerPhone: "0987000000", internalId: "private-id" }],
    }]);

    expect(reply).toContain("La Văn Sến");
    expect(reply).toContain("DH-001");
    expect(reply).toContain("250.000");
    expect(reply).not.toContain("0987000000");
    expect(reply).not.toContain("private-id");
    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values["Tên khách hàng"]).toBe("La Văn Sến");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("DH-001");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("250.000");
  });
});

describe("shared tables for module lookups", () => {
  it("renders generic lookup lists as a table while keeping internal fields hidden", () => {
    const operation = operationById("customer.list")!;
    const reply = formatFriendlyAssistantResult(operation, [{
      customerCode: "KH-001",
      name: "La Văn Sến",
      phone: "0987217127",
      status: "active",
      internalId: "db-private-id",
    }]);

    const table = parseAssistantResultTable(reply);
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.values).toMatchObject({
      "Mã khách hàng": "KH-001",
      "Tên khách hàng": "La Văn Sến",
      "Số điện thoại": "0987217127",
      "Trạng thái": "Đang hoạt động",
    });
    expect(reply).not.toContain("db-private-id");
  });
});
