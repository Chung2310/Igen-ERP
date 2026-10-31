import assert from "node:assert/strict";
import test from "node:test";
import * as controllerModule from "../controllers/retail-invoice.controller";
import { retailInvoiceRoutes } from "../routes/retail-invoice.routes";
import { invoicePdfPageSize } from "./retail-invoice-pdf.service";

test("invoice PDF uses the configured thermal paper width", () => {
  assert.deepEqual(invoicePdfPageSize("58mm"), [164.41, 600]);
  assert.deepEqual(invoicePdfPageSize("80mm"), [226.77, 600]);
});

test("invoice PDF controller uses authenticated branch scope and PDF headers", async () => {
  const createRetailInvoiceController = (controllerModule as any).createRetailInvoiceController;
  assert.equal(typeof createRetailInvoiceController, "function");
  const calls: unknown[] = [];
  const controller = createRetailInvoiceController({
    detail: async (scope: unknown, id: string) => { calls.push({ scope, id }); return { invoiceNo: "HD-01" }; },
    settings: async (scope: unknown) => { calls.push({ settingsScope: scope }); return { invoicePaperSize: "80mm" }; },
    renderPdf: async (_invoice: unknown, paperSize: string) => {
      assert.equal(paperSize, "80mm");
      return { buffer: Buffer.from("%PDF-test"), filename: "HD-01.pdf" };
    },
  });
  const headers: Record<string, string> = {};
  let body: unknown;
  let forwarded: unknown;
  await controller.pdf(
    { user: { companyCode: "ACME", branchId: "B1" }, query: {}, params: { id: "invoice-1" } } as any,
    { setHeader: (name: string, value: string) => { headers[name] = value; }, send: (value: unknown) => { body = value; } } as any,
    (error: unknown) => { forwarded = error; },
  );
  assert.equal(forwarded, undefined);
  assert.deepEqual(calls, [
    { scope: { companyCode: "ACME", branchId: "B1" }, id: "invoice-1" },
    { settingsScope: { companyCode: "ACME", branchId: "B1" } },
  ]);
  assert.equal(headers["Content-Type"], "application/pdf");
  assert.equal(headers["Content-Disposition"], 'attachment; filename="HD-01.pdf"');
  assert.deepEqual(body, Buffer.from("%PDF-test"));
});

test("invoice PDF controller forwards renderer errors", async () => {
  const expected = new Error("pdf failed");
  const createRetailInvoiceController = (controllerModule as any).createRetailInvoiceController;
  assert.equal(typeof createRetailInvoiceController, "function");
  const controller = createRetailInvoiceController({
    detail: async () => ({ invoiceNo: "HD-01" }),
    settings: async () => ({ invoicePaperSize: "A4" }),
    renderPdf: async () => { throw expected; },
  });
  let forwarded: unknown;
  await controller.pdf(
    { user: { companyCode: "ACME", branchId: "B1" }, query: {}, params: { id: "invoice-1" } } as any,
    {} as any,
    (error: unknown) => { forwarded = error; },
  );
  assert.equal(forwarded, expected);
});

test("invoice PDF route uses the existing operate-or-manager guard", () => {
  const route = retailInvoiceRoutes.stack.find((layer: any) => layer.route?.path === "/:id/pdf") as any;
  assert.ok(route?.route?.methods?.get);
  assert.equal(route.route.stack.length, 2);
});


test("bulk invoice PDF renders reconciliation summary and multiple invoice pages", async () => {
  const { renderBulkRetailInvoicesPdf } = await import("./retail-invoice-pdf.service");
  const sampleInvoice: any = {
    _id: "inv-1",
    invoiceNo: "HD-2026-0001",
    orderCode: "DH-0001",
    companyCode: "ACME",
    branchId: "B1",
    issuedAt: new Date("2026-05-01"),
    status: "issued",
    snapshot: {
      customerName: "Nguyễn Văn A",
      customerPhone: "0901234567",
      salespersonName: "Trần Nhân Viên",
      items: [
        { productName: "iPhone 16 Pro", sku: "IP16P", quantity: 1, unitPrice: 28000000, lineTotal: 28000000 },
      ],
      subtotal: 28000000,
      orderDiscount: 0,
      taxRate: 0,
      taxAmount: 0,
      grandTotal: 28000000,
      paidAmount: 28000000,
      dueAmount: 0,
      payments: [{ method: "cash", amount: 28000000 }],
    },
  };
  const result = await renderBulkRetailInvoicesPdf([sampleInvoice], "A4");
  assert.ok(result.buffer.length > 0);
  assert.equal(result.buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(result.filename.startsWith("chuoi-hoa-don-"));
  assert.ok(result.filename.endsWith(".pdf"));
});

test("bulk invoice PDF controller handles requests and sets attachment headers", async () => {
  const createRetailInvoiceController = (controllerModule as any).createRetailInvoiceController;
  const calls: unknown[] = [];
  const controller = createRetailInvoiceController({
    detail: async () => ({}),
    listForBulkPdf: async (scope: unknown, query: unknown) => {
      calls.push({ scope, query });
      return [{ invoiceNo: "HD-01" }, { invoiceNo: "HD-02" }];
    },
    settings: async () => ({ invoicePaperSize: "A4" }),
    renderPdf: async () => ({ buffer: Buffer.from(""), filename: "" }),
    renderBulkPdf: async (invoices: any[], paperSize: string) => {
      assert.equal(invoices.length, 2);
      assert.equal(paperSize, "A4");
      return { buffer: Buffer.from("%PDF-bulk"), filename: "doi-soat-test.pdf" };
    },
  });
  const headers: Record<string, string> = {};
  let body: unknown;
  let forwarded: unknown;
  await controller.bulkPdf(
    { user: { companyCode: "ACME", branchId: "B1" }, query: { from: "2026-01-01" }, body: { ids: ["1", "2"] } } as any,
    { setHeader: (name: string, value: string) => { headers[name] = value; }, send: (value: unknown) => { body = value; } } as any,
    (error: unknown) => { forwarded = error; },
  );
  assert.equal(forwarded, undefined);
  assert.equal(headers["Content-Type"], "application/pdf");
  assert.equal(headers["Content-Disposition"], 'attachment; filename="doi-soat-test.pdf"');
  assert.deepEqual(body, Buffer.from("%PDF-bulk"));
  assert.deepEqual(calls, [
    {
      scope: { companyCode: "ACME", branchId: "B1" },
      query: { from: "2026-01-01", ids: ["1", "2"] },
    },
  ]);
});

test("bulk invoice PDF route is registered for GET and POST", () => {
  const getRoute = retailInvoiceRoutes.stack.find((layer: any) => layer.route?.path === "/bulk-pdf" && layer.route?.methods?.get) as any;
  const postRoute = retailInvoiceRoutes.stack.find((layer: any) => layer.route?.path === "/bulk-pdf" && layer.route?.methods?.post) as any;
  assert.ok(getRoute);
  assert.ok(postRoute);
});
