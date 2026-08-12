import assert from "node:assert/strict";
import test from "node:test";
import * as controllerModule from "../controllers/retail-invoice.controller";
import { retailInvoiceRoutes } from "../routes/retail-invoice.routes";

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
