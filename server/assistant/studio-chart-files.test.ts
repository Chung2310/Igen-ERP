import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStudioChartFile } from "./studio-chart-files";

describe("parseStudioChartFile", () => {
  it("reads CSV data and keeps missing cells empty", async () => {
    const result = await parseStudioChartFile({
      buffer: Buffer.from("Tháng,Doanh thu,Ghi chú\nTháng 1,12000000,\nTháng 2,,Đang cập nhật", "utf8"),
      fileName: "doanh-thu.csv",
    });

    expect(result.sheets[0].headers).toEqual(["Tháng", "Doanh thu", "Ghi chú"]);
    expect(result.sheets[0].rows).toEqual([
      { "Tháng": "Tháng 1", "Doanh thu": "12000000", "Ghi chú": null },
      { "Tháng": "Tháng 2", "Doanh thu": null, "Ghi chú": "Đang cập nhật" },
    ]);
  });

  it("reads Excel cells, including dates and numeric values", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["Tháng", "Doanh thu"],
      ["Tháng 1", 12_000_000],
      ["Tháng 2", 15_500_000],
    ]), "Doanh thu");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = await parseStudioChartFile({ buffer, fileName: "doanh-thu.xlsx" });

    expect(result.sheets[0].name).toBe("Doanh thu");
    expect(result.sheets[0].rows[1]["Doanh thu"]).toBe(15_500_000);
  });
});
