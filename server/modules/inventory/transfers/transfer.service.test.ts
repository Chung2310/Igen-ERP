import { describe, expect, it } from "vitest";
import { validateTransferRequest } from "./transfer.service";

describe("phiếu điều chuyển kho", () => {
  const base = { idempotencyKey: "request-001", fromWarehouseId: "source", toWarehouseId: "destination", toBranchId: "branch", reason: "Bổ sung tồn" };
  const variantId = "507f1f77bcf86cd799439011";
  it("cho phép chọn chi nhánh nhận chưa có kho và vẫn bắt buộc kho gửi", () => {
    const branchOnly = { ...base, toWarehouseId: undefined };
    expect(validateTransferRequest({ ...branchOnly, items: [{ variantId, quantity: 1 }] }).toWarehouseId).toBe("");
    expect(() => validateTransferRequest({ ...branchOnly, fromWarehouseId: "", items: [{ variantId, quantity: 1 }] })).toThrow();
    expect(() => validateTransferRequest({ ...branchOnly, toBranchId: "", items: [{ variantId, quantity: 1 }] })).toThrow();
  });
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
  it("chấp nhận số lượng lẻ của hàng cân/đong và chặn số lượng không dương", () => {
    expect(validateTransferRequest({ ...base, items: [{ variantId, quantity: 1.5 }] }).items[0].quantity).toBe(1.5);
    expect(() => validateTransferRequest({ ...base, items: [{ variantId, quantity: 0 }] })).toThrow();
  });
  it("trả lỗi nhập liệu có mã 400 khi dòng hàng hoặc danh sách định danh sai định dạng", () => {
    for (const item of [null, [], { variantId, quantity: 1, serialNumbers: {} }, { variantId, quantity: 1, serialNumbers: [""] }]) {
      try { validateTransferRequest({ ...base, items: [item] }); throw new Error('Đã nhận dữ liệu sai'); }
      catch (error) { expect(error).toHaveProperty('status', 400); }
    }
  });
  it("không cho lặp cùng SKU bằng hai cách viết ObjectId hoa/thường", () => {
    expect(() => validateTransferRequest({ ...base, items: [{ variantId, quantity: 1 }, { variantId: variantId.toUpperCase(), quantity: 1 }] })).toThrow();
  });
});
