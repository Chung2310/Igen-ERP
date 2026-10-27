import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { listOrderWarranties, normalizeOrderWarrantyQuery } from "./order-warranty.service";
import { retailWarrantyController } from "../controllers/retail-warranty.controller";

const scope = { companyCode: "WARRANTY", branchId: "MAIN" };
const at = new Date("2026-10-26T16:59:59Z"); // 23:59:59 in Vietnam
const line = (extra = {}) => ({ productId: "product", sku: "CHAIR", productName: "Ghế văn phòng", quantity: 3, trackingMode: "quantity", customerWarrantyMonths: 12, customerWarrantyStartAt: new Date("2025-10-26T00:00:00Z"), customerWarrantyEndAt: new Date("2026-10-26T00:00:00Z"), ...extra });
async function sold(extra = {}, items = [line()]) {
  const order = { _id: new mongoose.Types.ObjectId(), ...scope, orderCode: "DH-001", customerSnapshot: { name: "Khách An", phone: "0900000000", customerCode: "KH1" }, status: "completed", stockApplied: true, completedAt: at, items, ...extra };
  await RetailOrderModel.collection.insertOne(order);
  return String(order._id);
}
let mongo: MongoMemoryServer;
describe("ERP order warranty", () => {
  beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); }, 30000);
  beforeEach(async () => { await Promise.all([RetailOrderModel, RetailInvoiceModel, RetailAfterSaleModel].map(model => model.collection.deleteMany({}))); });
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });

  it("finds quantity goods without identifiers by order, invoice, customer or SKU", async () => {
    const orderId = await sold();
    await RetailInvoiceModel.collection.insertOne({ ...scope, orderId, status: "issued", invoiceNo: "HD-123" });
    for (const q of ["DH-001", "HD-123", "Khách An", "0900000000", "CHAIR", "Ghế"]) {
      const result = await listOrderWarranties(scope, { q }, at);
      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({ orderId, quantity: 3, invoiceNo: "HD-123", productName: "Ghế văn phòng", status: "expiring", daysLeft: 0 });
      expect(result.items[0]).not.toHaveProperty("serialNumbers");
    }
    expect((await listOrderWarranties(scope, { q: ".*" }, at)).total).toBe(0);
  });

  it("keeps scope boundaries and excludes unsold or cancelled orders", async () => {
    await sold();
    for (const extra of [{ companyCode: "OTHER" }, { branchId: "OTHER" }, { status: "draft" }, { status: "cancelled" }, { stockApplied: false }]) await sold(extra);
    expect((await listOrderWarranties(scope, {}, at)).total).toBe(1);
  });

  it("subtracts completed returns and buybacks using the original line index", async () => {
    const orderId = await sold({}, [line(), line({ sku: "OTHER", quantity: 2 })]);
    await RetailAfterSaleModel.collection.insertMany([
      { ...scope, code: "RT1", orderId, type: "return", status: "completed", items: [{ orderLineIndex: 0, quantity: 1 }, { orderLineIndex: 1, quantity: 2 }] },
      { ...scope, code: "RT2", orderId, type: "buyback", status: "completed", items: [{ orderLineIndex: 0, quantity: 1 }] },
      { ...scope, code: "RT3", orderId, type: "return", status: "draft", items: [{ orderLineIndex: 0, quantity: 1 }] },
      { ...scope, code: "RT4", branchId: "OTHER", orderId, type: "return", status: "completed", items: [{ orderLineIndex: 0, quantity: 100 }] },
    ]);
    const result = await listOrderWarranties(scope, {}, at);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ sku: "CHAIR", quantity: 1 });
  });

  it("uses stored dates, distinguishes missing information from zero warranty, and paginates", async () => {
    await sold({}, [line(), line({ customerWarrantyMonths: 0, customerWarrantyStartAt: undefined, customerWarrantyEndAt: undefined }), line({ customerWarrantyMonths: undefined, customerWarrantyStartAt: undefined, customerWarrantyEndAt: undefined }), line({ customerWarrantyStartAt: new Date("2026-10-27"), customerWarrantyEndAt: new Date("2027-10-27") }), line({ customerWarrantyEndAt: new Date("2026-10-25") }), line({ customerWarrantyEndAt: new Date("2027-10-26") })]);
    const result = await listOrderWarranties(scope, {}, at);
    expect(result.items.map((row: any) => row.status)).toEqual(["expiring", "none", "unrecorded", "pending", "expired", "active"]);
    expect((await listOrderWarranties(scope, { status: "unrecorded" }, at)).total).toBe(1);
    const paged = await listOrderWarranties(scope, { page: 2, limit: 2 }, at);
    expect(paged.total).toBe(6);
    expect(paged.items.map((row: any) => row.status)).toEqual(["unrecorded", "pending"]);
    expect((await listOrderWarranties(scope, { status: "expired" }, new Date("2026-10-26T17:00:00Z"))).total).toBe(2);
  });

  it("validates filters and branch requirements", async () => {
    for (const query of [{ page: 0 }, { page: 1.5 }, { limit: 101 }, { status: "bad" }, { days: 0 }, { q: "x".repeat(201) }]) expect(() => normalizeOrderWarrantyQuery(query)).toThrow();
    await expect(listOrderWarranties({ ...scope, branchId: "" })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects attempts to override the authenticated company or branch", async () => {
    for (const query of [{ companyCode: "OTHER" }, { branchId: "OTHER" }]) {
      let status = 200;
      const res: any = { status: (value: number) => { status = value; return res; }, json: (value: unknown) => value };
      const data = await retailWarrantyController.orders({ user: { role: "employee", ...scope }, query } as any, res);
      expect(status).toBe(403);
      expect(data).toMatchObject({ success: false });
    }
  });
});
