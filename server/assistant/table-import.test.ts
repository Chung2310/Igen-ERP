import { describe, expect, it } from "vitest";
import { operationById } from "./catalog";
import { mapAssistantTableAttachment } from "./table-import";
import { validateStructuredField } from "./structured-data";

describe("assistant spreadsheet mapping", () => {
  it("maps Vietnamese employee headers and dates to the worker bulk workflow", () => {
    const op = operationById("worker.bulk.create")!;
    const result = mapAssistantTableAttachment(op, {
      fileName: "lao-dong.csv",
      headers: ["Họ và tên", "SĐT", "Ngày sinh", "Địa chỉ"],
      rows: [{ "Họ và tên": "Chung Abc", "SĐT": "987654321", "Ngày sinh": "05/11/1998", "Địa chỉ": "Hà Nội" }],
    });
    expect(result.fieldKey).toBe("workers");
    expect(result.rows).toEqual([{ fullName: "Chung Abc", phone: "0987654321", birthday: "1998-11-05", address: "Hà Nội" }]);
  });

  it("accepts a useful multi-row payload larger than the single-record JSON limit", () => {
    const field = operationById("worker.bulk.create")!.fields.find(candidate => candidate.key === "workers")!;
    const rows = Array.from({ length: 20 }, (_, index) => ({ fullName: `Lao động ${index + 1}`, phone: `0987654${String(index).padStart(3, "0")}`, note: "x".repeat(500) }));
    const serialized = JSON.stringify(rows);
    expect(serialized.length).toBeGreaterThan(4_000);
    expect(JSON.parse(validateStructuredField(field, serialized))).toEqual(rows);
  });

  it("maps partner contact and bank details without accepting unknown columns", () => {
    const op = operationById("partner.bulk.create")!;
    const result = mapAssistantTableAttachment(op, {
      fileName: "doi-tac.xlsx",
      headers: ["Tên đối tác", "Điện thoại", "Email", "Ngân hàng", "Số tài khoản", "Chủ tài khoản"],
      rows: [{ "Tên đối tác": "Công ty A", "Điện thoại": "0987654321", Email: "a@example.com", "Ngân hàng": "ACB", "Số tài khoản": "00123", "Chủ tài khoản": "NGUYEN VAN A" }],
    });
    expect(result.fieldKey).toBe("partners");
    expect(result.rows).toEqual([{ name: "Công ty A", phone: "0987654321", email: "a@example.com", bankName: "ACB", bankAccountNo: "00123", bankAccountName: "NGUYEN VAN A" }]);
    expect(() => mapAssistantTableAttachment(op, {
      fileName: "doi-tac.xlsx", headers: ["Tên đối tác", "Số nội bộ"],
      rows: [{ "Tên đối tác": "Công ty A", "Số nội bộ": "001" }],
    })).toThrow("Số nội bộ");
  });
});
