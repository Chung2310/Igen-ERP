import { describe, expect, it } from "vitest";
import { summarizeQuotationMoney } from "./quotationMoney";
import type { QuotationMoneyRow } from "./quotationOverviewService";

const quote = (id: string, total: number, kind: "customer" | "estimate", currency = "VND", totalUnknown = false): QuotationMoneyRow => ({
  _id: id, quoteNumber: id, customerName: `Khách ${id}`, kind, currency, total, totalUnknown, createdAt: "2026-11-06T18:00:00.000Z",
});

describe("summarizeQuotationMoney", () => {
  it("tách loại và tiền tệ, loại chứng từ chưa xác định tổng tiền", () => {
    const result = summarizeQuotationMoney([
      quote("A", 100, "customer"), quote("B", 300, "customer"), quote("C", 90, "estimate"),
      quote("D", 1000, "customer", "USD"), quote("E", 500, "customer", "VND", true),
    ], "VND");
    expect(result.customer).toMatchObject({ count: 2, total: 400, average: 200 });
    expect(result.customer.largest?.quoteNumber).toBe("B");
    expect(result.estimate).toMatchObject({ count: 1, total: 90, average: 90 });
    expect(result.top.map(row => row.quoteNumber)).toEqual(["B", "A", "C"]);
    expect(result.unknownCount).toBe(1);
    expect(result.trend).toEqual([{ date: "2026-11-07", customer: 400, estimate: 90 }]);
  });

  it("giữ giá trị 0 và không tạo trung bình khi không có chứng từ", () => {
    const result = summarizeQuotationMoney([quote("A", 0, "customer"), quote("B", -1, "estimate")], "VND");
    expect(result.customer.average).toBe(0);
    expect(result.estimate.average).toBeNull();
    expect(result.unknownCount).toBe(1);
  });
});
