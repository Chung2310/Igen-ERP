import { afterEach, expect, it, vi } from "vitest";
import { operationById } from "./catalog";
import { callOperation, resolveReferences } from "./executor";

vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return {
    actorScope: () => ({ userId: "507f1f77bcf86cd799439020", companyCode: "ACME" }),
    assertOperation: async (_req: unknown, id: string) => operationById(id),
  };
});

afterEach(() => vi.unstubAllGlobals());

const req = {
  user: { id: "company-admin", uid: "company-admin", companyCode: "ACME", role: "admin" },
  headers: { authorization: "Bearer test" },
  socket: { localAddress: "127.0.0.1", localPort: 4050 },
} as any;

it("reads two retail report periods and returns only comparable public metrics", async () => {
  const branchId = "507f1f77bcf86cd799439024";
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const from = String(url.searchParams.get("from"));
    const month = Number(from.slice(5, 7));
    return new Response(JSON.stringify({
      success: true,
      data: {
        range: { from, to: url.searchParams.get("to") },
        summary: { grossSales: month * 1000, netSales: month * 900, grossProfit: month * 300, orderCount: month, privateCost: 123 },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }));

  const result = await callOperation(req, operationById("retail.report.compare")!, {
    targetBranch: branchId,
    currentFrom: "2026-11-01",
    currentTo: "2026-11-30",
    previousFrom: "2026-10-01",
    previousTo: "2026-10-31",
  } as any);

  expect(requests.map(url => [url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([
    ["2026-11-01", "2026-11-30"],
    ["2026-10-01", "2026-10-31"],
  ]);
  expect(result.data).toEqual({
    current: { from: "2026-11-01", to: "2026-11-30", grossSales: 11000, netSales: 9900, orderCount: 11, grossProfit: 3300 },
    previous: { from: "2026-10-01", to: "2026-10-31", grossSales: 10000, netSales: 9000, orderCount: 10, grossProfit: 3000 },
  });
  expect(JSON.stringify(result)).not.toContain("privateCost");
});

it("projects complete retail order pages into allowlisted receivable analysis rows", async () => {
  const orderId = "507f1f77bcf86cd799439025";
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    return new Response(JSON.stringify({
      success: true,
      data: {
        items: [{
          _id: orderId, orderCode: "DH-001", customerName: "Nguyễn An", status: "completed", paymentStatus: "partial",
          grandTotal: 1_000_000, paidAmount: 400_000, dueAmount: 600_000, businessDate: "2026-11-24", internalNote: "hidden",
        }],
        total: 1,
        page: 1,
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }));

  const result = await callOperation(req, operationById("retail.order.completed-unpaid.report")!, {
    targetBranch: "507f1f77bcf86cd799439024",
    query_status: "completed",
    query_page: 1,
    query_limit: 100,
    analysis: JSON.stringify({ filters: [{ field: "dueAmount", operator: "gt", value: 0 }] }),
  } as any);

  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("status")).toBe("completed");
  expect(result).toMatchObject({
    data: [{ orderCode: "DH-001", customerName: "Nguyễn An", status: "completed", paymentStatus: "partial", dueAmount: 600_000 }],
    analysisPage: { total: 1, page: 1, keys: [orderId] },
  });
  expect(JSON.stringify(result.data)).not.toContain(orderId);
  expect(JSON.stringify(result.data)).not.toContain("hidden");
});

it("ranks top-selling products by quantity rather than revenue", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: {
    range: { from: "2026-11-01", to: "2026-11-30" },
    products: [
      { sku: "SKU-EXPENSIVE", productName: "Máy đắt", netQuantity: 1, netSales: 90_000_000 },
      { sku: "SKU-B", productName: "Máy B", netQuantity: 5, netSales: 20_000_000 },
      { sku: "SKU-A", productName: "Máy A", netQuantity: 5, netSales: 10_000_000 },
      { sku: "SKU-LOW", productName: "Máy bán chậm", netQuantity: 2, netSales: 50_000_000 },
    ],
  } }), { status: 200, headers: { "content-type": "application/json" } })));

  const result = await callOperation(req, operationById("retail.report.top-products")!, {
    targetBranch: "507f1f77bcf86cd799439024", from: "2026-11-01", to: "2026-11-30", topN: 3,
  } as any);

  expect(result.data.products.map((row: any) => [row.sku, row.netQuantity])).toEqual([
    ["SKU-B", 5], ["SKU-A", 5], ["SKU-LOW", 2],
  ]);
});

it("ranks in-stock IMEI serials by product model and excludes non-stock units", async () => {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const result = { success: true, data: { items: [
      { productId: "iphone14", productName: "iPhone 14", sku: "IPHONE14-BLK", status: "in_stock", serialNumber: "IMEI-001" },
      { productId: "iphone14", productName: "iPhone 14", sku: "IPHONE14-BLU", status: "in_stock", serialNumber: "IMEI-002" },
      { productId: "redmi14", productName: "Redmi Note 14", sku: "REDMI14", status: "in_stock", serialNumber: "IMEI-003" },
      { productId: "pixel", productName: "Pixel", sku: "PIXEL", status: "sold", serialNumber: "IMEI-004" },
    ], total: 4, page: Number(url.searchParams.get("page")), limit: 100 } };
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  }));

  const result = await callOperation(req, operationById("inventory.serial.stock-ranking")!, {
    targetBranch: "507f1f77bcf86cd799439024",
  } as any);

  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("status")).toBe("in_stock");
  expect(requests[0].searchParams.get("trackingMode")).toBe("serial");
  expect(requests[0].searchParams.get("branchId")).toBe("507f1f77bcf86cd799439024");
  expect(result.data.products).toEqual([{ productName: "iPhone 14", imeiCount: 2 }]);
});

it("ranks customers using only completed orders when asked for fulfilled sales", async () => {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    return new Response(JSON.stringify({ success: true, data: { items: [
      { orderCode: "DH-XONG-1", customerName: "Khách A", status: "completed", grandTotal: 2_000_000, refundedAmount: 500_000 },
      { orderCode: "DH-XONG-2", customerName: "Khách A", status: "completed", grandTotal: 1_000_000, refundedAmount: 0 },
      { orderCode: "DH-CHO", customerName: "Khách B", status: "confirmed", grandTotal: 9_000_000, refundedAmount: 0 },
      { orderCode: "DH-HUY", customerName: "Khách C", status: "cancelled", grandTotal: 99_000_000, refundedAmount: 0 },
    ], total: 4, page: 1, limit: 100 } }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const result = await callOperation(req, operationById("retail.order.top-customers.completed")!, {
    targetBranch: "507f1f77bcf86cd799439024", query_from: "2026-11-01", query_to: "2026-11-30", topN: 10,
  } as any);
  expect(requests[0].searchParams.get("status")).toBe("completed");
  expect(result.data.customers).toEqual([{ customerName: "Khách A", totalSpent: 2_500_000, orderCount: 2 }]);
});

it("returns zero-sales dates for retail daily extremes", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: {
    range: { from: "2026-11-01", to: "2026-11-02" },
    timeSeries: [
      { businessDate: "2026-11-01", netSales: 100, orderCount: 1 },
      { businessDate: "2026-11-02", netSales: 0, orderCount: 0 },
    ],
  } }), { status: 200, headers: { "content-type": "application/json" } })));
  const result = await callOperation(req, operationById("retail.report.daily-extremes")!, {
    targetBranch: "507f1f77bcf86cd799439024", from: "2026-11-01", to: "2026-11-02",
  } as any);
  expect(result.data).toMatchObject({
    highestRevenueDay: { businessDate: "2026-11-01", netSales: 100 },
    lowestRevenueDay: { businessDate: "2026-11-02", netSales: 0 },
    fewestOrdersDay: { businessDate: "2026-11-02", orderCount: 0 },
  });
});

it("finds the highest-value order after reading the complete date range", async () => {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    requests.push(new URL(String(input)));
    return new Response(JSON.stringify({ success: true, data: {
      items: [
        { orderCode: "DH-LOW", customerName: "Khách A", grandTotal: 10_000, businessDate: "2026-11-01", status: "completed" },
        { orderCode: "DH-HIGH", customerName: "Khách B", grandTotal: 20_000, businessDate: "2026-11-02", status: "confirmed" },
      ], total: 2, page: 1,
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const result = await callOperation(req, operationById("retail.order.top-value")!, {
    targetBranch: "507f1f77bcf86cd799439024", query_from: "2026-11-01", query_to: "2026-11-30",
  } as any);
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("from")).toBe("2026-11-01");
  expect(result.data).toMatchObject({ orderCode: "DH-HIGH", customerName: "Khách B", grandTotal: 20_000 });
});

it("returns only closed POS shifts with a nonzero cash variance", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: {
    items: [
      { _id: "private-1", shiftCode: "CA-LECH", cashierName: "Thu ngân A", status: "closed", businessDate: "2026-11-24", expectedCash: 500_000, countedCash: 450_000, varianceAmount: -50_000 },
      { _id: "private-2", shiftCode: "CA-KHOP", cashierName: "Thu ngân B", status: "closed", businessDate: "2026-11-25", expectedCash: 500_000, countedCash: 500_000, varianceAmount: 0 },
      { _id: "private-3", shiftCode: "CA-MO", cashierName: "Thu ngân C", status: "open", businessDate: "2026-11-26", varianceAmount: 10_000 },
    ], total: 3, page: 1, limit: 100,
  } }), { status: 200, headers: { "content-type": "application/json" } })));
  const result = await callOperation(req, operationById("retail.shift.variance-report")!, {
    targetBranch: "507f1f77bcf86cd799439024", query_from: "2026-11-01", query_to: "2026-11-30", query_page: 1, query_limit: 100,
  } as any);
  expect(result.data.shifts).toEqual([expect.objectContaining({ shiftCode: "CA-LECH", varianceAmount: -50_000 })]);
  expect(JSON.stringify(result)).not.toContain("private-1");
});

it("counts unique customers and refunds from completed return vouchers", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: {
    items: [
      { _id: "private-1", code: "TH-001", type: "return", status: "completed", customerName: "Lê Anh Tú", totalAmount: 400_000, items: [], reason: "Màn hình lỗi" },
      { _id: "private-2", code: "TH-002", type: "return", status: "completed", customerName: "Lê Anh Tú", totalAmount: 300_000, items: [], reason: "Đổi màu" },
      { _id: "private-3", code: "TM-001", type: "buyback", status: "completed", customerName: "Nguyễn An", totalAmount: 900_000, items: [], reason: "Thu mua" },
    ], total: 3, page: 1, limit: 100,
  } }), { status: 200, headers: { "content-type": "application/json" } })));
  const result = await callOperation(req, operationById("retail.after-sale.customer-return-summary")!, {
    targetBranch: "507f1f77bcf86cd799439024", from: "2026-11-01", to: "2026-11-30", query_type: "return",
  } as any);
  expect(result.data).toMatchObject({ customerCount: 1, returnCount: 2, refundTotal: 700_000 });
});

it("finds completed retail orders missing either an issued invoice or full payment", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/retail/orders")) return new Response(JSON.stringify({ success: true, data: { items: [
      { orderCode: "DH-THIEU-HD", customerName: "Khách A", status: "completed", grandTotal: 1_000_000, dueAmount: 0 },
      { orderCode: "DH-CON-NO", customerName: "Khách B", status: "completed", grandTotal: 2_000_000, dueAmount: 500_000 },
      { orderCode: "DH-OK", customerName: "Khách C", status: "completed", grandTotal: 3_000_000, dueAmount: 0 },
    ], total: 3, page: 1, limit: 100 } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ success: true, data: { items: [
      { _id: "invoice-1", orderCode: "DH-CON-NO", status: "issued" },
      { _id: "invoice-2", orderCode: "DH-OK", status: "issued" },
    ], total: 2, page: 1, limit: 100 } }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const result = await callOperation(req, operationById("retail.order.invoice-debt-exceptions")!, {
    targetBranch: "507f1f77bcf86cd799439024", query_from: "2026-11-01", query_to: "2026-11-30",
  } as any);
  expect(result.data.orders.map((row: any) => row.orderCode)).toEqual(["DH-THIEU-HD", "DH-CON-NO"]);
});

it("separately ranks canceled orders by recorded actor and closed-shift variance by cashier", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/retail/orders")) return new Response(JSON.stringify({ success: true, data: { items: [
      { orderCode: "DH-HUY-1", status: "cancelled", cancelledByName: "Thu ngân An" },
      { orderCode: "DH-HUY-2", status: "canceled", cancelledByName: "Thu ngân An" },
      { orderCode: "DH-HUY-3", status: "cancelled" },
      { orderCode: "DH-OK", status: "completed", cancelledByName: "Thu ngân Bình" },
    ], total: 4, page: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ success: true, data: { items: [
      { shiftCode: "CA-AN-1", status: "closed", cashierName: "Thu ngân An", varianceAmount: -20_000 },
      { shiftCode: "CA-AN-2", status: "reconciled", cashierName: "Thu ngân An", varianceAmount: 10_000 },
      { shiftCode: "CA-BINH-1", status: "closed", cashierName: "Thu ngân Bình", varianceAmount: 25_000 },
      { shiftCode: "CA-OPEN", status: "open", cashierName: "Thu ngân Cường", varianceAmount: 1_000_000 },
    ], total: 4, page: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const result = await callOperation(req, operationById("retail.report.employee-cancelled-cash-variance")!, {
    targetBranch: "507f1f77bcf86cd799439024", from: "2026-11-01", to: "2026-11-30",
  } as any);
  expect(result.data).toMatchObject({
    cancellationLeader: { employeeName: "Thu ngân An", cancelledOrders: 2 },
    varianceLeader: { cashierName: "Thu ngân An", shiftCount: 2, totalAbsoluteVariance: 30_000, netVariance: -10_000 },
    unattributedCancelledOrders: 1,
  });
});

it("resolves the selected QR order from the order code embedded in its display option", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const data = url.pathname.endsWith("/auth/branches")
      ? { items: [{ _id: "507f1f77bcf86cd799439024", code: "QA-HN", name: "QA_EDU - HN", status: "active" }], total: 1, page: 1 }
      : { items: [{ _id: "507f1f77bcf86cd799439099", orderCode: "POS-NOV-PARTIAL-QA-EDU-HN-1", customerName: "Lê Anh Tú", status: "completed", dueAmount: 8_000_000 }], total: 1, page: 1 };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const operation = operationById("retail.order.payment-qr")!;
  const result = await resolveReferences(req, operation, {
    targetBranch: "507f1f77bcf86cd799439024",
    path_id: "Lê Anh Tú — mã POS-NOV-PARTIAL-QA-EDU-HN-1 — Chi nhánh QA_EDU - HN",
  } as any);
  expect(result.unresolvedReferenceKeys, JSON.stringify(result)).toEqual([]);
  expect(result.values.path_id).toBe("507f1f77bcf86cd799439099");
});

it("dispatches a resolved POS QR order using the path field's API key", async () => {
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    requests.push(new URL(String(input)));
    return new Response(JSON.stringify({ success: true, data: { orderCode: "POS-001", amount: 8_000_000, qrUrl: "https://example.test/qr" } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  }));
  const orderId = "507f1f77bcf86cd799439099";
  const result = await callOperation(req, operationById("retail.order.payment-qr")!, {
    targetBranch: "507f1f77bcf86cd799439024", path_id: orderId,
  } as any);
  expect(requests[0].pathname).toBe(`/api/v1/retail/orders/${orderId}/payment-qr`);
  expect(result.data).toMatchObject({ orderCode: "POS-001", amount: 8_000_000 });
});

it("uses the active branch to disambiguate customer profiles with the same name", async () => {
  const branchId = "507f1f77bcf86cd799439024";
  const customerId = "507f1f77bcf86cd799439099";
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const data = url.pathname.endsWith("/purchase-history")
      ? { summary: { orderCount: 7, totalPurchased: 217_500_000, currentDebt: 46_000_000 } }
      : url.pathname.endsWith(`/customers/${customerId}`)
        ? { _id: customerId, name: "Lê Anh Tú", tierName: "Vàng" }
        : { items: [
          { _id: "507f1f77bcf86cd799439088", name: "Lê Anh Tú", phone: "098874465", branchId: "507f1f77bcf86cd799439023", tier: { name: "Bạc" } },
          { _id: customerId, name: "Lê Anh Tú", phone: "098874464", branchId, tier: { name: "Vàng" } },
        ], total: 2, page: 1, limit: 100 };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const branchReq = { ...req, user: { ...req.user, branchId } };
  const result = await callOperation(branchReq, operationById("retail.customer.profile-summary")!, {
    query_q: "Lê Anh Tú", query_status: "active", query_page: 1, query_limit: 100,
  } as any);
  expect(result.data).toMatchObject({ found: true, customerName: "Lê Anh Tú", tier: "Vàng", totalSpent: 217_500_000 });
});

it("excludes cancelled orders from a customer's purchase history", async () => {
  const customerId = "507f1f77bcf86cd799439024";
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const data = url.pathname.endsWith("/purchase-history")
      ? { summary: { orderCount: 2, totalPurchased: 30_000_000, currentDebt: 0 }, items: [
        { orderCode: "POS-OK", status: "completed", businessDate: "2026-11-25", grandTotal: 30_000_000, itemCount: 1 },
        { orderCode: "POS-CANCELLED", status: "cancelled", businessDate: "2026-11-26", grandTotal: 18_000_000, itemCount: 1 },
      ] }
      : { items: [{ _id: customerId, name: "Lê Anh Tú", phone: "098874464", branchId: req.user.branchId }] };
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  const result = await callOperation(req, operationById("retail.customer.purchase-warranty-summary")!, { path_phone: "098874464" } as any);
  expect(result.data.orders).toEqual([{ orderCode: "POS-OK", status: "completed", businessDate: "2026-11-25", grandTotal: 30_000_000, itemCount: 1 }]);
});

it("lists active retail suppliers and dealers while excluding collaborators", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: [
    { _id: "supplier-1", name: "Nhà cung cấp A", phone: "0900000001", roles: ["supplier"], status: "active" },
    { _id: "dealer-1", name: "Đại lý B", phone: "0900000002", roles: ["dealer"], status: "active" },
    { _id: "collaborator-1", name: "CTV C", phone: "0900000003", roles: ["collaborator"], status: "active" },
    { _id: "supplier-inactive", name: "Nhà cung cấp cũ", roles: ["supplier"], status: "inactive" },
  ] }), { status: 200, headers: { "content-type": "application/json" } })));
  const result = await callOperation(req, operationById("retail.partner.supplier-dealer-directory")!, {} as any);
  expect(result.data.partners).toEqual([
    { name: "Nhà cung cấp A", phone: "0900000001", partnerType: "supplier" },
    { name: "Đại lý B", phone: "0900000002", partnerType: "dealer" },
  ]);
});

it("downloads the authorized retail Excel report as an assistant file attachment", async () => {
  const xlsx = Buffer.from("PK\u0003\u0004QA retail report");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(xlsx, {
    status: 200,
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": 'attachment; filename="bao-cao-ban-le-HN-2026-11.xlsx"' },
  })));
  const result = await callOperation(req, operationById("retail.report.export")!, {
    targetBranch: "507f1f77bcf86cd799439024", from: "2026-11-01", to: "2026-11-30",
  } as any);
  expect(result).toMatchObject({ data: { fileName: "bao-cao-ban-le-HN-2026-11.xlsx", format: "xlsx" } });
  expect(result.__assistantFile).toMatchObject({ format: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  expect(result.__assistantFile.bytes).toEqual(xlsx);
});

it("downloads the authorized retail PDF export as an assistant file attachment", async () => {
  const pdf = Buffer.from("%PDF-1.4\nQA invoice export");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(pdf, {
    status: 200,
    headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="invoices-nov.pdf"' },
  })));
  const result = await callOperation(req, operationById("retail.invoice.bulk-pdf")!, {
    targetBranch: "507f1f77bcf86cd799439024", status: "issued", from: "2026-11-01", to: "2026-11-30", limit: 500,
  } as any);
  expect(result).toMatchObject({ data: { fileName: "invoices-nov.pdf", format: "pdf" } });
  expect(result.__assistantFile).toMatchObject({ format: "pdf", fileName: "invoices-nov.pdf", mimeType: "application/pdf" });
  expect(result.__assistantFile.bytes).toEqual(pdf);
});
