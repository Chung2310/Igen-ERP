import { describe, expect, it } from "vitest";
import {
  defaultBotQuestion,
  formatLeadCellDisplay,
  leadHasIntakeField,
  parseMultiSelectValue,
  toIntakeFieldKey,
} from "./leadSheetUtils";
import type { ExtendedLeadCard } from "../../services/crmService";

describe("leadSheetUtils", () => {
  it("converts Vietnamese column labels into safe database field keys without collisions", () => {
    const used = new Set(["so_dien_thoai"]);
    expect(toIntakeFieldKey("Họ và tên")).toBe("ho_va_ten");
    expect(toIntakeFieldKey("Địa chỉ nhận hàng")).toBe("dia_chi_nhan_hang");
    expect(toIntakeFieldKey("Số điện thoại", used)).toBe("so_dien_thoai_2");
    expect(toIntakeFieldKey("123 Ngân sách")).toBe("truong_123_ngan_sach");
  });

  it("generates natural Vietnamese bot questions based on column label and field type", () => {
    expect(defaultBotQuestion("SĐT", "phone")).toContain("số điện thoại");
    expect(defaultBotQuestion("Email", "email")).toContain("email");
    expect(defaultBotQuestion("Ngày hẹn", "date")).toContain("ngày");
    expect(defaultBotQuestion("Gói dịch vụ", "multi_select")).toContain("gói dịch vụ");
  });

  it("formats numbers, VND currencies, dates, and multi-select tags consistently", () => {
    expect(formatLeadCellDisplay("15000000", "currency")).toContain("15.000.000");
    expect(formatLeadCellDisplay("2500", "number")).toBe("2.500");
    expect(formatLeadCellDisplay("2026-05-14", "date")).toBe("14/05/2026");
    expect(formatLeadCellDisplay("   ")).toBe("");
    expect(parseMultiSelectValue("Trị mụn; Trẻ hóa, Chăm sóc da")).toEqual([
      "Trị mụn",
      "Trẻ hóa",
      "Chăm sóc da",
    ]);
  });

  it("matches intake columns accurately to lead account scope and saved snapshot/answers", () => {
    const lead: ExtendedLeadCard = {
      id: "l1",
      customerName: "Nguyễn An",
      phone: "0909",
      email: "",
      company: "",
      value: 0,
      avatar: "NA",
      productOfChoice: "",
      status: "cold",
      lastInteraction: "",
      lastInteractionTime: "",
      sourcePlatform: "facebook",
      sourceAccountId: "page-1",
      intakeFields: [{ key: "nhu_cau", label: "Nhu cầu", question: "?", type: "text", required: true }],
      answers: { ghi_chu: "Gọi chiều" },
    };

    expect(leadHasIntakeField(lead, { key: "intake:nhu_cau", answerKey: "nhu_cau", platform: "facebook", accountId: "page-1" })).toBe(true);
    expect(leadHasIntakeField(lead, { key: "intake:ghi_chu", answerKey: "ghi_chu", platform: "facebook", accountId: "page-1" })).toBe(true);
    expect(leadHasIntakeField(lead, { key: "intake:nhu_cau", answerKey: "nhu_cau", platform: "zalo", accountId: "zalo-1" })).toBe(false);
  });
});

