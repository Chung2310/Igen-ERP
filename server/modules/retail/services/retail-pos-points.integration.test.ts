import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyModel } from "../../../model/company.model";
import { BranchModel } from "../../../model/branch.model";
import { ProductCatalogModel } from "../../../model/product-catalog.model";
import { ProductVariantModel } from "../../../model/product-variant.model";
import { ProductPriceModel } from "../../../model/product-price.model";
import { WarehouseModel } from "../../../model/warehouse.model";
import { InventoryBalanceModel } from "../../../model/inventory-balance.model";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailSettingsModel } from "../models/retail-settings.model";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { RetailPointPolicyModel } from "../models/retail-point-policy.model";
import { RetailPointLedgerModel } from "../models/retail-point-ledger.model";
import { RetailOrderService } from "./retail-order.service";
import { businessDateInVietnam } from "./cashier-shift.service";
import { listOrderWarranties } from "./order-warranty.service";
import { processRetailSePayTransaction } from "./retail-sepay.service";

vi.mock("./retail-customer-tier.service", async (original) => ({
  ...await original<typeof import("./retail-customer-tier.service")>(),
  processTierRefreshBySourceKey: vi.fn().mockResolvedValue(undefined),
}));

let replSet: MongoMemoryReplSet;
const branchId = new mongoose.Types.ObjectId();
const warehouseId = new mongoose.Types.ObjectId();
const productId = new mongoose.Types.ObjectId();
const variantId = new mongoose.Types.ObjectId();
const customerId = new mongoose.Types.ObjectId();
const sessionId = new mongoose.Types.ObjectId();
const scope = { companyCode: "POSPOINTS", branchId: String(branchId) };
const actor = { id: new mongoose.Types.ObjectId().toString(), displayName: "Thu ngân", role: "admin" };
let shift: any;
const input = () => ({ customerId: String(customerId), pointsToRedeem: 20, items: [{ productId: String(variantId), quantity: 1, discount: { type: "amount", value: 0 } }], orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0 });
const balance = async () => (await CustomerModel.findById(customerId).lean())?.pointsBalance;

describe("POS points through pricing, orders and payments", () => {
  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  }, 30_000);
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map(collection => collection.deleteMany({})));
    await Promise.all([
      CompanyModel.collection.insertOne({ code: scope.companyCode, name: "POS Test", vietqrConfig: { bankId: "970422", accountNo: "123456789" } }),
      BranchModel.collection.insertOne({ _id: branchId, companyCode: scope.companyCode, code: "MAIN", name: "MAIN", isActive: true }),
      WarehouseModel.collection.insertOne({ _id: warehouseId, ...scope, code: "WH", name: "Warehouse", kind: "selling", isDefault: true, isActive: true }),
      ProductCatalogModel.collection.insertOne({ _id: productId, companyCode: scope.companyCode, name: "Phone", status: "active" }),
      ProductVariantModel.collection.insertOne({ _id: variantId, companyCode: scope.companyCode, productId: String(productId), sku: "PHONE", unitCode: "CAI", status: "active", trackingMode: "quantity" }),
      ProductPriceModel.collection.insertOne({ ...scope, variantId: String(variantId), sellingPrice: 100_000, costPrice: 50_000, status: "active" }),
      InventoryBalanceModel.collection.insertOne({ ...scope, warehouseId: String(warehouseId), productId: String(productId), variantId: String(variantId), sku: "PHONE", quantity: 5, reservedQuantity: 0, minStock: 0, averageCost: 50_000, version: 0 }),
      RetailSettingsModel.collection.insertOne({ ...scope, maxDiscountPercent: 100 }),
      CustomerModel.create({ _id: customerId, companyCode: scope.companyCode, customerCode: "KH1", name: "Khách hàng", phone: "0900000000", normalizedPhone: "0900000000", status: "active", source: "pos", pointsBalance: 100, createdBy: actor.id, createdByName: actor.displayName, version: 0 }),
      RetailPointPolicyModel.create({ companyCode: scope.companyCode, enabled: true, earnVndPerPoint: 10_000, redeemVndPerPoint: 1_000, maxRedeemPercent: 50, version: 1, updatedBy: actor.id }),
    ]);
    shift = { _id: sessionId, ...scope, shiftCode: "CA1", cashierId: actor.id, cashierName: actor.displayName, status: "open", terminalId: "POS-TEST", openingFloat: 0, openedBy: actor.id, openedAt: new Date(), operationalEndsAt: new Date(Date.now() + 3_600_000), businessDate: businessDateInVietnam(new Date()), activityVersion: 0 };
    await CashierShiftModel.collection.insertOne(shift);
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("prices points without spending them and resolves ERP company-wide customers in a saved draft", async () => {
    const quote = await RetailOrderService.quote(scope, input());
    expect(quote).toMatchObject({ grandTotal: 80_000, pointsDiscount: 20_000 });
    const draft = await RetailOrderService.createDraft(scope, { ...input(), idempotencyKey: "draft-points" }, actor);
    expect(draft).toMatchObject({ customerId: String(customerId), grandTotal: 80_000, pointsToRedeem: 20, pointsRedeemed: 0, manualOrderDiscount: 0 });
    expect(await balance()).toBe(100);
    expect(await RetailPointLedgerModel.countDocuments({})).toBe(0);
  });

  it("confirms a saved draft without double discounting or redeeming again on a retry", async () => {
    const draft = await RetailOrderService.createDraft(scope, { ...input(), idempotencyKey: "draft-points" }, actor);
    const confirmation = { expectedVersion: 0, expectedGrandTotal: 80_000, idempotencyKey: "confirm-points", payments: [{ method: "cash", amount: 80_000, tenderedAmount: 80_000 }] };
    const result = await RetailOrderService.confirm(scope, String(draft._id), confirmation, actor, undefined, true);
    expect(result.order).toMatchObject({ grandTotal: 80_000, pointsRedeemed: 20, pointsDiscount: 20_000, status: "completed" });
    const retry = await RetailOrderService.confirm(scope, String(draft._id), confirmation, actor, undefined, true);
    expect(String(retry.order._id)).toBe(String(result.order._id));
    expect(await balance()).toBe(88);
    expect(await RetailPointLedgerModel.countDocuments({})).toBe(2);
  });

  it("snapshots warranty for quantity goods at confirmation and keeps the sold policy", async () => {
    await ProductCatalogModel.updateOne({ _id: productId }, { $set: { warrantyMonths: 12 } });
    const draft = await RetailOrderService.createDraft(scope, { ...input(), idempotencyKey: "draft-warranty" }, actor);
    const result = await RetailOrderService.confirm(scope, String(draft._id), { expectedVersion: 0, expectedGrandTotal: 80_000, idempotencyKey: "confirm-warranty", payments: [{ method: "cash", amount: 80_000, tenderedAmount: 80_000 }] }, actor, undefined, true);
    expect(result.order.items[0]).toMatchObject({ customerWarrantyMonths: 12, trackingMode: "quantity" });
    expect(result.order.items[0].customerWarrantyStartAt).toBeInstanceOf(Date);
    expect(result.order.items[0].customerWarrantyEndAt).toBeInstanceOf(Date);
    await ProductCatalogModel.updateOne({ _id: productId }, { $set: { warrantyMonths: 24 } });
    const warranties = await listOrderWarranties(scope);
    expect(warranties.total).toBe(1);
    expect(warranties.items[0]).toMatchObject({ orderId: String(result.order._id), warrantyMonths: 12, quantity: 1 });
    expect(warranties.items[0].warrantyEndAt).toEqual(result.order.items[0].customerWarrantyEndAt);
  });

  it("keeps the draft and stock unchanged when the customer's points were spent elsewhere", async () => {
    const draft = await RetailOrderService.createDraft(scope, { ...input(), idempotencyKey: "draft-points" }, actor);
    await CustomerModel.updateOne({ _id: customerId }, { $set: { pointsBalance: 10 } });
    const confirmation = { expectedVersion: 0, expectedGrandTotal: 80_000, idempotencyKey: "confirm-stale-points", payments: [{ method: "cash", amount: 80_000, tenderedAmount: 80_000 }] };
    await expect(RetailOrderService.confirm(scope, String(draft._id), confirmation, actor, undefined, true)).rejects.toThrow();
    expect(await balance()).toBe(10);
    expect(await RetailPointLedgerModel.countDocuments({})).toBe(0);
    expect((await InventoryBalanceModel.findOne({ ...scope, variantId: String(variantId) }).lean())?.quantity).toBe(5);
    expect((await RetailOrderService.detail(scope, String(draft._id), actor, true)).status).toBe("draft");
  });

  it("checks out once, then restores points and stock when the order is cancelled", async () => {
    const request = { input: input(), posSessionId: String(sessionId), expectedGrandTotal: 80_000, idempotencyKey: "checkout-points", payments: [{ method: "cash", amount: 80_000, tenderedAmount: 80_000 }] };
    const result = await RetailOrderService.checkout(scope, request, actor, shift, true);
    await RetailOrderService.checkout(scope, request, actor, shift, true);
    expect(await balance()).toBe(88);
    const cancel = { expectedVersion: result.order.version, idempotencyKey: "cancel-points", reason: "Khách hủy đơn", refunds: [{ method: "transfer", amount: 80_000 }] };
    await RetailOrderService.cancel(scope, String(result.order._id), cancel, actor, undefined, true);
    await RetailOrderService.cancel(scope, String(result.order._id), cancel, actor, undefined, true);
    expect(await balance()).toBe(100);
    expect((await InventoryBalanceModel.findOne({ ...scope, variantId: String(variantId) }).lean())?.quantity).toBe(5);
    expect(await RetailPointLedgerModel.countDocuments({ type: "redeem" })).toBe(1);
    expect(await RetailPointLedgerModel.countDocuments({ type: "refund_redeem" })).toBe(1);
  });

  it("earns points only after the pending SePay payment is received", async () => {
    const paymentCode = "AKMP1234567890ABCDEF1234567890";
    const request = { input: input(), posSessionId: String(sessionId), expectedGrandTotal: 80_000, idempotencyKey: "checkout-qr-points", payments: [], pendingTransferAmount: 80_000, paymentCode };
    const result = await RetailOrderService.checkout(scope, request, actor, shift, true);
    expect(result.order.status).toBe("confirmed");
    expect(await balance()).toBe(80);
    const payment = { id: "points-sepay-1", accountNumber: "123456789", transferType: "in", transferAmount: 80_000, code: paymentCode };
    await processRetailSePayTransaction(payment);
    await processRetailSePayTransaction(payment);
    expect(await balance()).toBe(88);
    expect(await RetailPointLedgerModel.countDocuments({ type: "earn" })).toBe(1);
  });
});
