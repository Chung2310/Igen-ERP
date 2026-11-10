import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliveryFind: vi.fn(),
  deliveryCount: vi.fn(),
  deliveryFindOneAndUpdate: vi.fn(),
  deliveryExists: vi.fn(),
  orderFind: vi.fn(),
  userFind: vi.fn(),
  getCustomerContact: vi.fn(),
}));

vi.mock("../models/retail-debt-reminder-delivery.model", () => ({
  RetailDebtReminderDeliveryModel: {
    find: mocks.deliveryFind,
    countDocuments: mocks.deliveryCount,
    findOneAndUpdate: mocks.deliveryFindOneAndUpdate,
    exists: mocks.deliveryExists,
  },
}));
vi.mock("../models/retail-order.model", () => ({ RetailOrderModel: { find: mocks.orderFind } }));
vi.mock("../../../model/user.model", () => ({ UserModel: { find: mocks.userFind } }));
vi.mock("../../customer-management/contracts", () => ({ getCustomerContact: mocks.getCustomerContact }));

import { RetailDebtReminderAssistantService } from "./retail-debt-reminder-assistant.service";

function query<T>(value: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
}

describe("RetailDebtReminderAssistantService.listRetryable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only retryable email failures with recipient and exact message preview, without internal delivery data", async () => {
    const deliveries = [
      {
        _id: "delivery-customer",
        orderId: "order-1",
        recipientId: "customer:customer-1",
        recipientType: "customer",
        payload: { to: "customer@example.com", subject: "Nợ đơn SO-001", text: "Đơn SO-001 còn nợ 1.000.000 ₫." },
        attempt: 1,
        maxAttempts: 3,
        error: "provider internal detail",
        createdAt: new Date("2026-11-01T00:00:00Z"),
      },
      {
        _id: "delivery-creator",
        orderId: "order-2",
        recipientId: "creator:staff-1",
        recipientType: "creator",
        payload: { to: "staff@example.com", subject: "Theo dõi SO-002", text: "Vui lòng theo dõi SO-002." },
        attempt: 2,
        maxAttempts: 4,
        createdAt: new Date("2026-11-01T00:01:00Z"),
      },
    ];
    const deliveryQuery = query(deliveries);
    const orderQuery = query([
      { _id: "order-1", orderCode: "SO-001", customerName: "Nguyễn An" },
      { _id: "order-2", orderCode: "SO-002", customerName: "Trần Bình" },
    ]);
    const userQuery = query([{ _id: "staff-1", displayName: "Lê Chi", email: "staff@example.com" }]);
    mocks.deliveryFind.mockReturnValue(deliveryQuery);
    mocks.deliveryCount.mockResolvedValue(2);
    mocks.orderFind.mockReturnValue(orderQuery);
    mocks.userFind.mockReturnValue(userQuery);
    mocks.getCustomerContact.mockResolvedValue({ name: "Nguyễn An", email: "customer@example.com" });

    const result = await RetailDebtReminderAssistantService.listRetryable(
      { companyCode: "ACME", branchId: "branch-1" },
      { page: 2, limit: 500 },
    );

    const deliveryFilter = mocks.deliveryFind.mock.calls[0][0];
    expect(deliveryFilter).toMatchObject({
      companyCode: "ACME",
      branchId: "branch-1",
      channel: "email",
      status: "failed",
      failureType: "temporary",
      $expr: { $lt: ["$attempt", "$maxAttempts"] },
    });
    expect(mocks.deliveryCount).toHaveBeenCalledWith(deliveryFilter);
    expect(deliveryQuery.skip).toHaveBeenCalledWith(100);
    expect(deliveryQuery.limit).toHaveBeenCalledWith(100);
    expect(mocks.orderFind).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "branch-1", _id: { $in: ["order-1", "order-2"] } });
    expect(mocks.userFind).toHaveBeenCalledWith({ companyCode: "ACME", _id: { $in: ["staff-1"] } });
    expect(mocks.getCustomerContact).toHaveBeenCalledWith({ companyCode: "ACME" }, "customer-1", { includeInactive: true });
    expect(result).toMatchObject({
      total: 2,
      page: 2,
      limit: 100,
      items: [
        { _id: "delivery-customer", recipientName: "Nguyễn An", recipientEmail: "customer@example.com", orderCode: "SO-001", subject: "Nợ đơn SO-001", message: "Đơn SO-001 còn nợ 1.000.000 ₫.", attempt: 1, maxAttempts: 3 },
        { _id: "delivery-creator", recipientName: "Lê Chi", recipientEmail: "staff@example.com", orderCode: "SO-002", subject: "Theo dõi SO-002", message: "Vui lòng theo dõi SO-002.", attempt: 2, maxAttempts: 4 },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(/recipientId|orderId|provider internal detail|failureType|payload/);
  });
});

describe("RetailDebtReminderAssistantService.retry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically queues only a scoped temporary failed email below its attempt limit", async () => {
    const updated = query({ status: "queued", nextAttemptAt: new Date("2026-11-01T00:00:00Z") });
    mocks.deliveryFindOneAndUpdate.mockReturnValue(updated);

    const result = await RetailDebtReminderAssistantService.retry(
      { companyCode: "ACME", branchId: "branch-1" },
      "delivery-1",
      new Date("2026-11-01T00:00:00Z"),
    );

    expect(mocks.deliveryFindOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: "delivery-1",
      companyCode: "ACME",
      branchId: "branch-1",
      channel: "email",
      status: "failed",
      failureType: "temporary",
      $expr: { $lt: ["$attempt", "$maxAttempts"] },
    });
    expect(mocks.deliveryFindOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { status: "queued", nextAttemptAt: new Date("2026-11-01T00:00:00Z") },
      $unset: { error: 1 },
    });
    expect(result).toEqual({ status: "queued", nextAttemptAt: new Date("2026-11-01T00:00:00Z") });
    expect(mocks.deliveryExists).not.toHaveBeenCalled();
  });

  it("distinguishes a missing delivery from one that is no longer retryable", async () => {
    mocks.deliveryFindOneAndUpdate.mockReturnValue(query(null));
    mocks.deliveryExists.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: "delivery-1" });

    await expect(RetailDebtReminderAssistantService.retry({ companyCode: "ACME", branchId: "branch-1" }, "missing"))
      .rejects.toMatchObject({ status: 404 });
    await expect(RetailDebtReminderAssistantService.retry({ companyCode: "ACME", branchId: "branch-1" }, "sent"))
      .rejects.toMatchObject({ status: 409 });
  });
});
