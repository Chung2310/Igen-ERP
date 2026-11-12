import { describe, expect, it } from "vitest";
import { isVietnamesePhoneNormalizationRequest, normalizeUploadedVietnamesePhones } from "./vietnamese-phone-normalization";

describe("uploaded Vietnamese phone normalization", () => {
  it("recognizes the requested Vietnamese phone edit", () => {
    expect(isVietnamesePhoneNormalizationRequest("Thay sđt trong file thành số chuẩn Việt Nam")).toBe(true);
  });

  it("normalizes international and local mobile numbers while preserving other cells", () => {
    const result = normalizeUploadedVietnamesePhones({
      title: "danh_sach_hoc_vien.xlsx",
      content: {
        type: "uploaded-table",
        headers: ["Họ và tên", "Số điện thoại", "Email"],
        rows: [
          { "Họ và tên": "Nguyễn An", "Số điện thoại": "+84 912 345 678", Email: "an@example.com" },
          { "Họ và tên": "Trần Bình", "Số điện thoại": "987 654 321", Email: "binh@example.com" },
        ],
      },
    });

    expect(result).toMatchObject({ normalizedCount: 2 });
    if (!("document" in result)) throw new Error("Expected normalized document");
    expect(result.document.sheets[0]).toMatchObject({
      columns: ["Họ và tên", "Số điện thoại", "Email"],
      rows: [
        ["Nguyễn An", "0912345678", "an@example.com"],
        ["Trần Bình", "0987654321", "binh@example.com"],
      ],
    });
  });

  it("identifies the learner when a phone number cannot be corrected safely", () => {
    const result = normalizeUploadedVietnamesePhones({
      title: "danh_sach_hoc_vien.xlsx",
      content: {
        type: "uploaded-table",
        headers: ["Họ và tên", "SĐT"],
        rows: [{ "Họ và tên": "Lê Minh Châu", SĐT: "12345" }],
      },
    });

    expect(result).toMatchObject({ error: expect.stringContaining("Lê Minh Châu") });
    if (!("error" in result)) throw new Error("Expected invalid phone details");
    expect(result.error).toContain("12345");
    expect(result.error).toContain("không thể tự đoán");
  });
});
