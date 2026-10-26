import { describe, expect, it } from "vitest";
import { RetailSePayTransactionModel } from "../models/retail-sepay-transaction.model";
import { retailSePayReviewReason } from "./retail-sepay.service";

describe("kiểm tra giao dịch SePay", () => {
  it("đưa khoản thu ngoài ca và số tiền dư vào danh sách kiểm tra", () => {
    expect(retailSePayReviewReason(true, 100_000, 100_000)).toMatch(/ngoài phiên/);
    expect(retailSePayReviewReason(false, 120_000, 100_000)).toMatch(/vượt/);
    expect(retailSePayReviewReason(false, 100_000, 100_000)).toBeUndefined();
  });

  it("lưu được khoản thu chưa gắn đơn với số tiền áp dụng bằng 0", () => {
    const doc = new RetailSePayTransactionModel({ provider: "sepay", transactionId: "bank-1", companyCode: "ACME", accountNumber: "123", receivedAmount: 100_000, appliedAmount: 0, status: "pending_review" });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.orderId).toBeUndefined();
  });
});
