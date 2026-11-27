import { describe, expect, it } from "vitest";
import { derivePreviousMonthIssueRows, deriveRetailBusinessOverviewRows, deriveZeroSoldPhoneStockRows } from "./retail-business-overview";

describe("retail business overview derivation", () => {
  it("counts complete outgoing sale and internal slips once and excludes cancelled or out-of-period records", () => {
    expect(derivePreviousMonthIssueRows([
      { type: "xuất", purpose: "bán hàng", status: "Thành công", createdAt: "2026-10-03T02:00:00.000Z" },
      { type: "xuất", purpose: "nội bộ", status: "Hoàn thành", createdAt: "2026-10-15T02:00:00.000Z" },
      { type: "xuất", purpose: "bán hàng", status: "Đã hủy", createdAt: "2026-10-20T02:00:00.000Z" },
      { type: "nhập", purpose: "bán hàng", status: "Hoàn thành", createdAt: "2026-10-21T02:00:00.000Z" },
      { type: "xuất", purpose: "nội bộ", status: "Hoàn thành", createdAt: "2026-11-01T02:00:00.000Z" },
    ], true, { from: "2026-10-01", to: "2026-10-31" })).toMatchObject([
      { documentType: "Phiếu xuất bán hàng", count: 1 },
      { documentType: "Phiếu xuất dùng nội bộ", count: 1 },
    ]);
  });

  it("does not report partial slip counts when the stock log list is incomplete", () => {
    expect(derivePreviousMonthIssueRows([], false, { from: "2026-10-01", to: "2026-10-31" }))
      .toEqual([{ finding: "Chưa thể đếm chính xác vì danh sách phiếu xuất chưa được đọc đầy đủ.", from: "2026-10-01", to: "2026-10-31" }]);
  });

  it("joins complete 30-day sales and inventory by product line and excludes accessories", () => {
    const result = deriveZeroSoldPhoneStockRows(
      [{ products: [{ productName: "Redmi Note 14", netQuantity: 2 }, { productName: "iPhone 14", netQuantity: 1 }] }],
      [
        { name: "Huawei Honor 600 - Tím · 256 GB", category: "Điện thoại", stock: 4 },
        { name: "Huawei Honor 600 - Đen · 256 GB", category: "Điện thoại", stock: 2 },
        { name: "Redmi Note 14 - Tím · 128 GB", category: "Điện thoại", stock: 8 },
        { name: "Ốp nhựa iPhone 14 - Trong suốt", category: "Tấm ốp nhựa", stock: 20 },
      ],
      true,
    );

    expect(result).toEqual([{ productName: "Huawei Honor 600", unitsSoldInPeriod: 0, availableStock: 6, variantsInStock: 2 }]);
  });

  it("does not claim slow-stock results when the inventory list is incomplete", () => {
    expect(deriveZeroSoldPhoneStockRows([], [{ name: "Huawei Honor 600 - Tím", category: "Điện thoại", stock: 4 }], false))
      .toEqual([{ finding: "Chưa thể kết luận vì danh sách tồn kho chưa được đọc đầy đủ." }]);
  });

  it("counts previous-month export slips once and limits Redmi recipients to the rolling 30-day range", () => {
    const result = deriveRetailBusinessOverviewRows({
      salesReportRows: [], inventoryRows: [], inventoryComplete: true, stockLogComplete: true,
      previousMonth: { from: "2026-10-01", to: "2026-10-31" },
      last30Days: { from: "2026-10-29", to: "2026-11-27" },
      stockLogRows: [
        { type: "xuất", purpose: "bán", status: "Thành công", title: "Xuất bán POS", createdAt: "2026-10-30T04:00:00.000Z" },
        { type: "xuất", purpose: "nội bộ", status: "Thành công", title: "Xuất dùng nội bộ", productName: "Redmi Note 14", quantity: 1, customerName: "Bộ phận Kế toán", createdAt: "2026-10-15T04:00:00.000Z" },
        { type: "xuất", purpose: "nội bộ", status: "Thành công", title: "Xuất dùng nội bộ", productName: "Redmi Note 14", quantity: 2, notes: "Bộ phận kế toán sử dụng nội bộ", createdAt: "2026-11-18T04:00:00.000Z" },
        { type: "xuất", purpose: "nội bộ", status: "Thành công", title: "Xuất dùng nội bộ", productName: "Redmi Note 14", quantity: 1, customerName: "Ngoài kỳ", createdAt: "2026-11-28T04:00:00.000Z" },
        { type: "xuất", purpose: "bán", status: "Đã hủy", title: "Phiếu bị hủy", createdAt: "2026-10-20T04:00:00.000Z" },
      ],
    });

    expect(result.previousMonthIssues).toMatchObject([
      { documentType: "Phiếu xuất bán hàng", count: 1 },
      { documentType: "Phiếu xuất dùng nội bộ", count: 1 },
    ]);
    expect(result.recentRedmiRecipients).toMatchObject([
      { productName: "Redmi Note 14", recipient: "Bộ phận kế toán", quantity: 2, issueType: "Xuất dùng nội bộ" },
    ]);
  });
});
