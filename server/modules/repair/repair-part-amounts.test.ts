import { beforeEach, describe, expect, it, vi } from "vitest";

let parts: any[] = [];
vi.mock("./repair-part.model", () => ({ RepairPartModel: { find: () => ({ lean: async () => parts }) } }));
vi.mock("./repair-ticket.model", () => ({ RepairTicketModel: {} }));
vi.mock("../../integrations/shared/stock-movement.service", () => ({ writeStockMovement: async () => undefined }));

const { recomputeRepairTicketAmounts } = await import("./repair-part.service");

const ticket = (extra: Record<string, unknown> = {}) => ({ _id: "t1", companyCode: "IGEN", laborFee: 200_000, discountAmount: 0, paidAmount: 0, paymentStatus: "unpaid", save: vi.fn(async () => undefined), ...extra });

describe("tính tiền phiếu sửa chữa từ linh kiện", () => {
  beforeEach(() => { parts = []; });

  it("linh kiện bảo hành vào giá vốn nhưng không tính tiền khách", async () => {
    parts = [
      { unitCost: 300_000, unitPrice: 500_000, quantity: 1, chargeable: false },
      { unitCost: 50_000, unitPrice: 90_000, quantity: 2, chargeable: true },
    ];
    const doc: any = ticket();
    const result = await recomputeRepairTicketAmounts(doc);
    expect(result.partCost).toBe(400_000);
    expect(result.partRevenue).toBe(180_000);
    expect(doc.totalAmount).toBe(380_000); // công sửa 200k + linh kiện tính tiền 180k
  });

  it("hoàn hết linh kiện thì tiền quay về đúng công sửa", async () => {
    const doc: any = ticket();
    await recomputeRepairTicketAmounts(doc);
    expect(doc.partCost).toBe(0);
    expect(doc.partRevenue).toBe(0);
    expect(doc.totalAmount).toBe(200_000);
  });

  it("không tự tăng tiền của phiếu khách đã duyệt báo giá, chỉ báo phần lệch", async () => {
    parts = [{ unitCost: 400_000, unitPrice: 600_000, quantity: 1, chargeable: true }];
    const doc: any = ticket({ quotedAmount: 500_000, customerApprovedAt: new Date() });
    const result = await recomputeRepairTicketAmounts(doc);
    expect(doc.totalAmount).toBe(500_000);
    expect(result.quoteDeviation).toBe(300_000);
  });

  it("cập nhật công nợ và trạng thái thanh toán theo số đã thu", async () => {
    parts = [{ unitCost: 0, unitPrice: 100_000, quantity: 1, chargeable: true }];
    const doc: any = ticket({ paidAmount: 100_000 });
    await recomputeRepairTicketAmounts(doc);
    expect(doc.dueAmount).toBe(200_000);
    expect(doc.paymentStatus).toBe("partial");
  });
});
