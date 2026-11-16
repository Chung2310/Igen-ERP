import { describe, expect, it } from "vitest";
import { normalizeIntakeFields } from "./normalize-intake-fields";

describe("normalize intake fields", () => {
  it("creates safe field keys from Vietnamese labels when the user does not supply technical keys", () => {
    expect(normalizeIntakeFields([
      { label: "Họ và tên", question: "Anh/chị tên gì?" },
      { label: "Số điện thoại", question: "Số điện thoại liên hệ?", type: "phone" },
      { label: "Email", question: "Địa chỉ email?", required: false },
    ])).toEqual([
      { key: "ho_va_ten", label: "Họ và tên", question: "Anh/chị tên gì?", type: "text", required: true, options: [] },
      { key: "so_dien_thoai", label: "Số điện thoại", question: "Số điện thoại liên hệ?", type: "phone", required: true, options: [] },
      { key: "email", label: "Email", question: "Địa chỉ email?", type: "text", required: false, options: [] },
    ]);
  });

  it("makes generated keys unique while still rejecting an invalid key supplied by the caller", () => {
    const fields = normalizeIntakeFields([
      { label: "Email", question: "Email?" },
      { label: "Email", question: "Email dự phòng?" },
    ]);
    expect(fields?.map(field => field.key)).toEqual(["email", "email_2"]);
    expect(normalizeIntakeFields([{ key: "Email Address", label: "Email", question: "Email?" }])).toBeUndefined();
  });

  it("rejects select fields without choices and duplicate choices", () => {
    expect(normalizeIntakeFields([{ label: "Nhu cầu", question: "Chọn nhu cầu", type: "single_select" }])).toBeUndefined();
    expect(normalizeIntakeFields([{ label: "Nhu cầu", question: "Chọn nhu cầu", type: "single_select", options: ["A", "a"] }])).toBeUndefined();
  });
});
