import assert from "node:assert/strict";
import test from "node:test";
import * as invoiceService from "./retail-invoice.service";

test("invoice PDF helpers map paper sizes and sanitize filenames", () => {
  const invoicePdfPageSize = (invoiceService as any).invoicePdfPageSize;
  const invoicePdfFilename = (invoiceService as any).invoicePdfFilename;
  const resolveInvoiceFontPath = (invoiceService as any).resolveInvoiceFontPath;
  assert.equal(typeof invoicePdfPageSize, "function");
  assert.equal(typeof invoicePdfFilename, "function");
  assert.equal(typeof resolveInvoiceFontPath, "function");
  assert.deepEqual(invoicePdfPageSize("A4"), "A4");
  assert.deepEqual(invoicePdfPageSize("A5"), "A5");
  assert.deepEqual(invoicePdfPageSize("80mm"), [226.77, 600]);
  assert.equal(invoicePdfFilename('../HD-01\r\n"'), "HD-01.pdf");
  const fontPath = resolveInvoiceFontPath(
    "Roboto-Bold.ttf",
    (candidate: string) => candidate.replaceAll("\\", "/").endsWith("dist-server/server/assets/fonts/Roboto-Bold.ttf"),
    "/app",
  ).replaceAll("\\", "/");
  assert.equal(fontPath, "/app/dist-server/server/assets/fonts/Roboto-Bold.ttf");
});

test("invoice PDF renderer returns a Unicode PDF buffer", async () => {
  const renderRetailInvoicePdf = (invoiceService as any).renderRetailInvoicePdf;
  assert.equal(typeof renderRetailInvoicePdf, "function");
  const result = await renderRetailInvoicePdf({
    invoiceNo: "HD-HCM-202608-000001",
    orderCode: "DH-HCM-202608-000001",
    issuedAt: new Date("2026-08-12T01:00:00.000Z"),
    snapshot: {
      store: { legalName: "Công ty Igen", storeName: "Cửa hàng Igen", branchCode: "HCM", branchName: "Chi nhánh Hồ Chí Minh", branchAddress: "1 Nguyễn Huệ", branchPhone: "0901000000" },
      customerName: "Nguyễn Văn A",
      cashierName: "Thu ngân A",
      items: [{ sku: "SKU-1", productName: "Áo", unit: "cái", quantity: 1, unitPrice: 100_000, discountAmount: 0, lineTotal: 100_000 }],
      subtotal: 100_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 100_000,
      payments: [{ method: "cash", amount: 100_000 }], amountInWords: "Một trăm nghìn đồng",
    },
  }, "A4");
  assert.equal(result.filename, "HD-HCM-202608-000001.pdf");
  assert.equal(result.buffer.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.ok(result.buffer.length > 1_000);
});

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
    paidAmount: 111_800,
    dueAmount: 0,
    paymentStatus: "paid",
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
  assert.equal(snapshot.paidAmount, 111_800);
  assert.equal(snapshot.dueAmount, 0);
  assert.equal(snapshot.paymentStatus, "paid");
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

test("invoice snapshot preserves serial numbers for sold devices", () => {
  const snapshot = (invoiceService as any).buildRetailInvoiceSnapshot({
    customerName: "Khách lẻ", items: [{ productId: "p1", sku: "PHONE-1", productName: "Điện thoại", unit: "cái", quantity: 1, trackingMode: "serial", serialNumbers: ["IMEI-001"], unitPrice: 1_000, unitCost: 500, discountAmount: 0, lineTotal: 1_000 }],
    subtotal: 1_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 1_000, paidAmount: 1_000, dueAmount: 0, paymentStatus: "paid", payments: [],
  }, { id: "cashier-1", displayName: "Thu ngân" }, { legalName: "Igen", storeName: "Igen", branchCode: "CN", branchName: "Chi nhánh" });
  assert.deepEqual(snapshot.items[0].serialNumbers, ["IMEI-001"]);
  assert.equal(snapshot.items[0].trackingMode, "serial");
});

test("invoice PDF payment rows localize partial and full debt", () => {
  const rows = invoiceService.invoicePdfPaymentRows;
  assert.deepEqual(rows({ grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, payments: [{ method: "transfer", amount: 40_000 }] }), [
    { label: "Chuyển khoản", amount: 40_000 },
    { label: "Còn nợ", amount: 60_000 },
  ]);
  assert.deepEqual(rows({ grandTotal: 100_000, payments: [] }), [{ label: "Ghi nợ toàn bộ", amount: 100_000 }]);
  assert.ok(rows({ grandTotal: 100_000, paidAmount: 100_000, dueAmount: 0, paymentStatus: "refunded", payments: [{ method: "cash", amount: 100_000 }] }).some((row: any) => row.label === "Đã hoàn tiền"));
});

test("invoice snapshot rejects fractional VND and inconsistent payment totals", () => {
  const build = (overrides: any) => invoiceService.buildRetailInvoiceSnapshot({
    customerName: "A", items: [], subtotal: 100_000, orderDiscount: 0, taxRate: 0, taxAmount: 0,
    shippingFee: 0, grandTotal: 100_000, paidAmount: 40_000, dueAmount: 60_000, paymentStatus: "partial", payments: [],
    ...overrides,
  }, { displayName: "Thu ngân" }, { legalName: "A", storeName: "A", branchCode: "B", branchName: "B" });
  assert.throws(() => build({ paidAmount: 40_000.5, dueAmount: 59_999.5 }), /INVALID_INVOICE_VND/);
  assert.throws(() => build({ paidAmount: 40_000, dueAmount: 50_000 }), /INVALID_INVOICE_PAYMENT_TOTAL/);
});

test("legacy invoice cashier projection replaces an email without mutating snapshot", () => {
  const invoice = { issuedBy: "u1", snapshot: { cashierName: "cashier@example.com" } };
  const projected = invoiceService.projectLegacyInvoiceCashier(invoice, "Nguyễn An");
  assert.equal(projected.snapshot.cashierName, "Nguyễn An");
  assert.equal(invoice.snapshot.cashierName, "cashier@example.com");
});

test("invoice snapshot preserves immutable customer and VAT snapshots", () => {
  const snapshot = invoiceService.buildRetailInvoiceSnapshot({
    customerName: "Nguyễn Văn A", customerPhone: "0901",
    customerSnapshot: { customerId: "c1", customerCode: "KH-1", name: "Nguyễn Văn A", phone: "0901" },
    billingSnapshot: { legalName: "Công ty A", taxId: "0312345678", address: "1 Nguyễn Huệ", invoiceEmail: "invoice@a.vn" },
    items: [], subtotal: 1_000, orderDiscount: 0, taxRate: 0, taxAmount: 0, shippingFee: 0, grandTotal: 1_000, paidAmount: 1_000, dueAmount: 0, paymentStatus: "paid", payments: [],
  }, { displayName: "Thu ngân" }, { legalName: "IGEN", storeName: "IGEN", branchCode: "HCM", branchName: "HCM" });
  assert.equal(snapshot.customerSnapshot.customerCode, "KH-1");
  assert.equal(snapshot.billingSnapshot.taxId, "0312345678");
});
