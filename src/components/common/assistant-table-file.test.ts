import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readAssistantTableFile } from "./assistant-table-file";

describe("assistant table uploads", () => {
  const csv = (text: string) => ({ name: "input.csv", size: text.length, text: async () => text }) as File;
  it("preserves leading zeroes and quoted delimiters", async () => {
    expect((await readAssistantTableFile(csv('Tên,SĐT\n"An, Bình",0901234567'))).rows).toEqual([{ "Tên": "An, Bình", "SĐT": "0901234567" }]);
  });
  it("rejects duplicate headers instead of overwriting cells", async () => {
    await expect(readAssistantTableFile(csv("Tên,Tên\nAn,Bình"))).rejects.toThrow("trùng");
  });
  it("rejects unnamed data columns", async () => {
    await expect(readAssistantTableFile(csv("Tên,SĐT\nAn,0901234567,Extra"))).rejects.toThrow("chưa đặt tên");
  });
  it("rejects multiple sheets rather than silently importing only one", async () => {
    const workbook = XLSX.utils.book_new();
    for (const name of ["A", "B"]) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Tên"], ["An"]]), name);
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await expect(readAssistantTableFile({ name: "input.xlsx", size: bytes.length, arrayBuffer: async () => bytes } as File)).rejects.toThrow("nhiều trang tính");
  });
});
