import { afterEach, describe, expect, it, vi } from "vitest";
import { RetailIdempotencyModel } from "../models/retail-idempotency.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailOrderService } from "./retail-order.service";

const scope = { companyCode: "ACME", branchId: "branch-a" };
afterEach(() => vi.restoreAllMocks());

describe("tra cứu khóa yêu cầu POS", () => {
  it("không tiết lộ trạng thái khóa của chi nhánh khác", async () => {
    vi.spyOn(RetailIdempotencyModel, "findOne").mockReturnValue({ lean: async () => ({ branchId: "branch-b", status: "processing" }) } as any);
    const orderLookup = vi.spyOn(RetailOrderModel, "findOne");
    expect(await RetailOrderService.idempotency(scope, "key-1")).toEqual({ status: "not_found" });
    expect(orderLookup).not.toHaveBeenCalled();
  });

  it("không trả chứng từ lịch sử nếu đơn không thuộc chi nhánh hiện tại", async () => {
    vi.spyOn(RetailIdempotencyModel, "findOne").mockReturnValue({ lean: async () => ({ status: "completed", orderId: "order-b" }) } as any);
    vi.spyOn(RetailOrderModel, "findOne").mockReturnValue({ lean: async () => null } as any);
    expect(await RetailOrderService.idempotency(scope, "legacy-key")).toEqual({ status: "not_found" });
  });

  it("chặn dùng lại khóa xác nhận cho đơn khác", async () => {
    vi.spyOn(RetailIdempotencyModel, "findOne").mockReturnValue({ lean: async () => ({ status: "completed", operation: "confirm-order", orderId: "another-order" }) } as any);
    await expect(RetailOrderService.confirm(scope, "current-order", { idempotencyKey: "reused", expectedVersion: 1, expectedGrandTotal: 100, payments: [] }, {}, {})).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT" });
  });

  it("chặn trả chứng từ xác nhận thuộc chi nhánh khác", async () => {
    vi.spyOn(RetailIdempotencyModel, "findOne").mockReturnValue({ lean: async () => ({ status: "completed", operation: "confirm-order", orderId: "current-order", invoiceId: "invoice-b" }) } as any);
    vi.spyOn(RetailOrderModel, "findOne").mockReturnValue({ lean: async () => null } as any);
    vi.spyOn(RetailInvoiceModel, "findOne").mockReturnValue({ lean: async () => null } as any);
    await expect(RetailOrderService.confirm(scope, "current-order", { idempotencyKey: "other-branch", expectedVersion: 1, expectedGrandTotal: 100, payments: [] }, {}, {})).rejects.toMatchObject({ code: "ORDER_IDEMPOTENCY_CONFLICT", status: 409 });
  });
});
