import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  find: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("../../inventory/serials/serial-unit.model", () => ({
  SerialUnitModel: { findOne: mocks.findOne, find: mocks.find },
}));
vi.mock("../../inventory/serials/serial-event.model", () => ({
  SerialEventModel: { create: mocks.eventCreate },
}));
vi.mock("../../../model/product-variant.model", () => ({ ProductVariantModel: {} }));
vi.mock("../../../model/product-catalog.model", () => ({ ProductCatalogModel: {} }));
vi.mock("../../customer-management/contracts", () => ({ getCustomerContact: vi.fn() }));

import { updateWarranty, updateWarrantyByCode } from "./warranty-lookup.service";

function serialUnit() {
  return {
    _id: "507f1f77bcf86cd799439011",
    companyCode: "ACME",
    branchId: "507f1f77bcf86cd799439012",
    serialNumber: "IMEI-123",
    internalBarcode: "IG-UNIT-123",
    sku: "PHONE-1",
    productName: "Điện thoại thử nghiệm",
    status: "sold",
    supplierWarranty: { months: 12 },
    save: vi.fn().mockResolvedValue(undefined),
    toObject: vi.fn(function (this: any) { return { ...this }; }),
  };
}

describe("warranty lookup updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eventCreate.mockResolvedValue({});
  });

  it("updates one serial by its visible IMEI within the selected company and branch", async () => {
    const unit: any = serialUnit();
    mocks.find.mockReturnValue({ limit: vi.fn().mockResolvedValue([unit]) });

    const updated = await updateWarrantyByCode(
      { companyCode: "ACME", branchId: "507f1f77bcf86cd799439012" },
      "imei-123",
      { kind: "customer", startAt: "2026-10-31", months: 24 },
      { id: "actor-1", name: "Quản lý" },
    );

    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      branchId: "507f1f77bcf86cd799439012",
      $or: expect.arrayContaining([{ normalizedSerialNumber: "IMEI-123" }]),
    }));
    expect(unit.customerWarranty).toMatchObject({ months: 24, source: "manual", startSource: "manual" });
    expect(unit.save).toHaveBeenCalledOnce();
    expect(mocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      serialNumber: "IMEI-123",
      eventType: "warranty_adjusted",
      reason: "customer:24 tháng",
      actorId: "actor-1",
    }));
    expect(updated).toMatchObject({ serialNumber: "IMEI-123" });
  });

  it("requires a unique matching serial and does not write when multiple devices match", async () => {
    mocks.find.mockReturnValue({ limit: vi.fn().mockResolvedValue([serialUnit(), serialUnit()]) });

    await expect(updateWarrantyByCode(
      { companyCode: "ACME" },
      "IMEI-123",
      { kind: "supplier", startAt: "2026-10-31", months: 12 },
      { id: "actor-1", name: "Quản lý" },
    )).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it("rejects unsupported warranty kinds before querying or saving", async () => {
    await expect(updateWarrantyByCode(
      { companyCode: "ACME" },
      "IMEI-123",
      { kind: "other", startAt: "2026-10-31", months: 12 } as any,
      { id: "actor-1", name: "Quản lý" },
    )).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.find).not.toHaveBeenCalled();
  });

  it("keeps the ID endpoint scoped to the selected branch", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(updateWarranty(
      { companyCode: "ACME", branchId: "507f1f77bcf86cd799439012" },
      "507f1f77bcf86cd799439013",
      { kind: "supplier", startAt: "2026-10-31", months: 12 },
      { id: "actor-1", name: "Quản lý" },
    )).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.findOne).toHaveBeenCalledWith({
      _id: "507f1f77bcf86cd799439013",
      companyCode: "ACME",
      branchId: "507f1f77bcf86cd799439012",
    });
  });
});
