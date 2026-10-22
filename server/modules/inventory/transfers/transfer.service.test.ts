import { describe, expect, it } from "vitest";
import { validateTransferRequest } from "./transfer.service";

describe("phiếu điều chuyển kho", () => {
  const base = { idempotencyKey: "request-001", fromWarehouseId: "source", toWarehouseId: "destination", toBranchId: "branch", reason: "Bổ sung tồn" };
  const variantId = "507f1f77bcf86cd799439011";
  it("chấp nhận phiếu nhiều dòng và chuẩn hóa IMEI", () => {
    const result = validateTransferRequest({ ...base, items: [
      { variantId, quantity: 2, serialNumbers: [" 123456 ", "789012"] },
      { variantId: "507f1f77bcf86cd799439012", quantity: 3 },
    ] });
    expect(result.items[0].serialNumbers).toEqual(["123456", "789012"]);
    expect(result.items).toHaveLength(2);
  });
  it("chặn SKU và IMEI trùng trước khi trừ tồn", () => {
    expect(() => validateTransferRequest({ ...base, items: [{ variantId, quantity: 1 }, { variantId, quantity: 1 }] })).toThrow();
    expect(() => validateTransferRequest({ ...base, items: [{ variantId, quantity: 2, serialNumbers: ["123", " 123 "] }] })).toThrow();
  });
  it("chặn số lượng không nguyên", () => {
    expect(() => validateTransferRequest({ ...base, items: [{ variantId, quantity: 1.5 }] })).toThrow();
  });
});
