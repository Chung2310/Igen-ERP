import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { readAssistantTableFile } from "./assistant-table-file";

describe("assistant table files", () => {
  it("keeps CSV values such as phone numbers and account numbers as text", async () => {
    const file = new File(["Họ và tên;Số điện thoại;Số tài khoản\r\nChung;0987654321;00123"], "data.csv", { type: "text/csv" });
    await expect(readAssistantTableFile(file)).resolves.toMatchObject({
      fileName: "data.csv",
      headers: ["Họ và tên", "Số điện thoại", "Số tài khoản"],
      rows: [{ "Họ và tên": "Chung", "Số điện thoại": "0987654321", "Số tài khoản": "00123" }],
    });
  });

  it("reads the first worksheet from an Excel workbook", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Họ và tên", "SĐT", "Ngày sinh"], ["Chung", "0987654321", ""]]);
    sheet.C2 = { t: "d", v: new Date("1998-11-05T00:00:00.000Z"), z: "dd/mm/yyyy" };
    XLSX.utils.book_append_sheet(workbook, sheet, "Nhân sự");
    const file = new File([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], "data.xlsx");
    await expect(readAssistantTableFile(file)).resolves.toMatchObject({
      headers: ["Họ và tên", "SĐT", "Ngày sinh"],
      rows: [{ "Họ và tên": "Chung", "SĐT": "0987654321", "Ngày sinh": "1998-11-05" }],
    });
  });
});
