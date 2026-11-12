import { describe, expect, it } from "vitest";
import {
  buildLeadFieldFilter,
  buildVisibleFilterColumns,
  buildVisibleSortOptions,
  defaultBotQuestion,
  formatLeadCellDisplay,
  leadHasIntakeField,
  parseMultiSelectValue,
  toIntakeFieldKey,
  type LeadSheetColumn,
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

  it("builds visible-only filter and sort lists without duplicates across channels", () => {
    const visibleCols: LeadSheetColumn[] = [
      { key: "customerName", label: "Họ và tên", type: "text", kind: "system", defaultWidth: 204, editable: true, sortable: true, sortKey: "customerName" },
      { key: "intake:facebook:fb1:nhu_cau", answerKey: "nhu_cau", label: "Dịch vụ quan tâm", type: "multi_select", options: ["Trị mụn"], kind: "intake", defaultWidth: 200, editable: true, sortable: true, sortKey: "answers.nhu_cau" },
      { key: "intake:zalo:z1:nhu_cau", answerKey: "nhu_cau", label: "Dịch vụ quan tâm", type: "multi_select", options: ["Trị mụn", "Tắm trắng"], kind: "intake", defaultWidth: 200, editable: true, sortable: true, sortKey: "answers.nhu_cau" },
      { key: "intake:facebook:fb1:ngan_sach", answerKey: "ngan_sach", label: "Ngân sách", type: "currency", kind: "intake", defaultWidth: 176, editable: true, sortable: true, sortKey: "answers.ngan_sach" },
      { key: "intake:zalo:z1:ngan_sach_z", answerKey: "ngan_sach_z", label: "Ngân sách", type: "currency", kind: "intake", defaultWidth: 176, editable: true, sortable: true, sortKey: "answers.ngan_sach_z" },
      { key: "intake:facebook:fb1:dat_lich", answerKey: "dat_lich", label: "Đặt lịch", type: "checkbox", kind: "intake", defaultWidth: 152, editable: true, sortable: true, sortKey: "answers.dat_lich" },
    ];

    const filterCols = buildVisibleFilterColumns(visibleCols);
    expect(filterCols.map(c => c.label)).toEqual(["Họ và tên", "Dịch vụ quan tâm", "Ngân sách", "Đặt lịch"]);
    expect(filterCols[1].options?.map(o => o.value)).toEqual(["Trị mụn", "Tắm trắng"]);
    expect(filterCols[2].altKeys).toEqual(["answers.ngan_sach_z"]);

    expect(buildLeadFieldFilter(filterCols[2], "5.000.000")).toEqual({
      key: "answers.ngan_sach",
      altKeys: ["answers.ngan_sach_z"],
      value: "5.000.000",
      mode: "contains",
    });
    expect(buildLeadFieldFilter(filterCols[3], "Không")).toEqual({
      key: "answers.dat_lich",
      value: "Không",
      mode: "unchecked",
    });

    const sortOptions = buildVisibleSortOptions(visibleCols);
    expect(sortOptions.map(opt => opt.value)).toEqual([
      "updatedAt:desc",
      "customerName:asc",
      "customerName:desc",
      "answers.nhu_cau:asc",
      "answers.nhu_cau:desc",
      "answers.ngan_sach:asc",
      "answers.ngan_sach:desc",
      "answers.dat_lich:asc",
      "answers.dat_lich:desc",
    ]);
  });
});

