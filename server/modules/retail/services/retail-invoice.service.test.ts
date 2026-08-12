import assert from "node:assert/strict";
import test from "node:test";
import * as invoiceService from "./retail-invoice.service";

test("invoice snapshot contains printable transaction data without unit cost", () => {
  const buildRetailInvoiceSnapshot = (invoiceService as any).buildRetailInvoiceSnapshot;
  assert.equal(typeof buildRetailInvoiceSnapshot, "function");
  const snapshot = buildRetailInvoiceSnapshot({
    businessDate: "2026-08-10",
    customerName: "Nguyễn Văn A",
    customerPhone: "0901000000",
    items: [{ productId: "p1", sku: "SKU-1", productName: "Áo", unit: "cái", quantity: 1, unitPrice: 100_000, unitCost: 60_000, discountAmount: 10_000, lineTotal: 90_000, category: "A" }],
    subtotal: 90_000,
    orderDiscount: 5_000,
    taxRate: 8,
    taxAmount: 6_800,
    shippingFee: 20_000,
    grandTotal: 111_800,
    payments: [{ method: "cash", amount: 111_800, tenderedAmount: 120_000, changeAmount: 8_200 }],
  }, { id: "cashier-1", displayName: "Thu ngân A" }, {
    legalName: "Igen Technology Co., Ltd",
    storeName: "Igen Store",
    branchCode: "HCM",
    branchName: "Ho Chi Minh",
    branchAddress: "1 Nguyen Hue",
    branchPhone: "0901000000",
  });

  assert.equal(snapshot.taxRate, 8);
  assert.equal(snapshot.shippingFee, 20_000);
  assert.equal(snapshot.businessDate, "2026-08-10");
  assert.equal(snapshot.cashierName, "Thu ngân A");
  assert.equal(snapshot.payments[0].changeAmount, 8_200);
  assert.equal("unitCost" in snapshot.items[0], false);
  assert.equal("category" in snapshot.items[0], false);
  assert.deepEqual(snapshot.store, {
    legalName: "Igen Technology Co., Ltd",
    storeName: "Igen Store",
    branchCode: "HCM",
    branchName: "Ho Chi Minh",
    branchAddress: "1 Nguyen Hue",
    branchPhone: "0901000000",
  });
});
