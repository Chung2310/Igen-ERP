import { describe, expect, it, vi } from "vitest";

vi.mock("../model/crm-ticket.model", () => ({
  CRMTicketModel: {},
}));

import { mapIntakeStandardFields, parseLeadIntakeAmount } from "./lead-intake.service";

describe("lead-intake.service helpers", () => {
  it("parses formatted VND budget strings into non-negative numeric amounts", () => {
    expect(parseLeadIntakeAmount("15,000,000")).toBe(15000000);
    expect(parseLeadIntakeAmount(" 250000 ")).toBe(250000);
    expect(parseLeadIntakeAmount("-500")).toBeUndefined();
    expect(parseLeadIntakeAmount("thỏa thuận")).toBeUndefined();
  });

  it("maps custom intake keys and Vietnamese labels back to core Lead aliases", () => {
    const mapped = mapIntakeStandardFields(
      [
        { key: "ho_ten", label: "Họ tên", type: "text" },
        { key: "sdt_khach", label: "SĐT", type: "phone" },
        { key: "email_lien_he", label: "Email", type: "email" },
        { key: "ten_cong_ty", label: "Tên công ty", type: "text" },
        { key: "nhu_cau", label: "Nhu cầu", type: "multi_select" },
        { key: "ngan_sach", label: "Ngân sách", type: "currency" },
      ],
      {
        ho_ten: "Trần Minh Quân",
        sdt_khach: "0909123456",
        email_lien_he: "quan@example.com",
        ten_cong_ty: "Công ty XYZ",
        nhu_cau: "Gói Doanh nghiệp",
        ngan_sach: "30,000,000",
      },
    );

    expect(mapped).toEqual({
      name: "Trần Minh Quân",
      phone: "0909123456",
      email: "quan@example.com",
      company: "Công ty XYZ",
      productOfChoice: "Gói Doanh nghiệp",
      value: "30,000,000",
    });
  });
});

