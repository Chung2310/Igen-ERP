import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";
import {
  createRetailReportController,
  loadRetailReportBranchCode,
} from "../controllers/retail-report.controller";
import { retailReportRoutes } from "../routes/retail-report.routes";
import type { RetailReportModel } from "./retail-report-metrics";
import {
  buildRetailReportWorkbook,
  escapeSpreadsheetCell,
} from "./retail-report-export.service";

const model: RetailReportModel = {
  products: [{ productId: "p1", sku: "=SKU", productName: "+Tea", category: "Drinks", brand: "North", netQuantity: 2, netSales: 100, profit: 40 }],
  slowProducts: [{ productId: "p1", sku: "=SKU", productName: "+Tea", category: "Drinks", brand: "North", netQuantity: 2, netSales: 100, profit: 40 }],
  range: { from: "2026-08-09", to: "2026-08-10" },
  summary: {
    grossSales: 350,
    refunds: 50,
    netSales: 300,
    orderCount: 2,
    averageOrderValue: 175,
    collectedAmount: 250,
    dueAmount: 50,
    totalCost: 180,
    grossProfit: 120,
    grossMarginPercent: 40,
  },
  timeSeries: [{
    businessDate: "2026-08-10",
    grossSales: 350,
    refunds: 50,
    netSales: 300,
    collectedAmount: 250,
    orderCount: 2,
  }],
  paymentMix: [{ method: "cash", amount: 250 }],
  cashiers: [{
    cashierId: "cashier-1",
    cashierName: "=CMD()",
    orderCount: 2,
    grossSales: 350,
    refunds: 50,
    netSales: 300,
    averageOrderValue: 175,
  }],
  shifts: [{
    shiftId: "shift-1",
    shiftCode: "+SHIFT",
    businessDate: "2026-08-10",
    cashierId: "cashier-1",
    cashierName: "@cashier",
    status: "-closed",
    grossSales: 350,
    collectedAmount: 250,
    refundedAmount: 50,
    varianceAmount: -5,
  }],
  debt: {
    totalDebt: 50,
    overdueDebt: 20,
    dueTodayDebt: 10,
    upcomingDebt: 20,
    customers: [{
      customerId: "customer-1",
      customerName: "=Customer",
      customerPhone: "+84901",
      totalDebt: 50,
      overdueDebt: 20,
      nearestDueDate: "2026-08-10",
      orderCount: 1,
    }],
  },
};

function readWorkbook(includeProfit: boolean) {
  const result = buildRetailReportWorkbook(model, {
    includeProfit,
    branchCode: "HCM/01\r\nInjected.xlsx",
  });
  return {
    ...result,
    workbook: XLSX.read(result.buffer, { type: "buffer" }),
  };
}

function allSheetValues(workbook: XLSX.WorkBook): unknown[] {
  return workbook.SheetNames.flatMap((name) => (
    XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true })
  ).flat());
}

test("builds the eight retail report worksheets in the required order", () => {
  const { workbook } = readWorkbook(false);

  assert.deepEqual(workbook.SheetNames, [
    "Tổng quan",
    "Theo ngày",
    "Thanh toán",
    "Thu ngân",
    "Ca bán hàng",
    "Công nợ",
    "Sản phẩm bán chạy",
    "Sản phẩm bán chậm",
  ]);
});

test("operator export omits every profit field while manager export includes numeric profit cells", () => {
  const operator = readWorkbook(false).workbook;
  const manager = readWorkbook(true).workbook;
  const operatorText = allSheetValues(operator).join("|");
  const managerRows = XLSX.utils.sheet_to_json<unknown[]>(manager.Sheets["Tổng quan"], { header: 1, raw: true });

  assert.doesNotMatch(operatorText, /totalCost|grossProfit|grossMargin|giá vốn|lợi nhuận|biên lợi nhuận/i);

  const managerLabels = managerRows.map((row) => row[0]);
  for (const label of ["Giá vốn", "Lợi nhuận gộp", "Biên lợi nhuận gộp (%)"]) {
    const rowIndex = managerLabels.indexOf(label);
    assert.notEqual(rowIndex, -1, `manager overview must include ${label}`);
    assert.equal(typeof managerRows[rowIndex][1], "number", `${label} must remain a numeric XLSX cell`);
  }

  assert.equal(manager.Sheets["Theo ngày"].B2.t, "n");
  assert.equal(manager.Sheets["Thanh toán"].B2.t, "n");
  assert.equal(manager.Sheets["Thu ngân"].D2.t, "n");
  assert.equal(manager.Sheets["Ca bán hàng"].F2.t, "n");
});

test("escapes every spreadsheet formula prefix and all dynamic strings written to workbook", () => {
  for (const value of ["=CMD()", "+SUM(1,1)", "-1+1", "@IMPORTDATA()"] as const) {
    assert.equal(escapeSpreadsheetCell(value), `'${value}`);
  }
  assert.equal(escapeSpreadsheetCell("safe"), "safe");

  const { workbook } = readWorkbook(false);
  const values = allSheetValues(workbook).filter((value): value is string => typeof value === "string");
  assert.equal(values.some((value) => /^[=+\-@]/.test(value)), false);
  for (const escaped of ["'=CMD()", "'+SHIFT", "'@cashier", "'-closed", "'=Customer", "'+84901"]) {
    assert.ok(values.includes(escaped), `workbook must contain escaped dynamic value ${escaped}`);
  }
});

test("sanitizes the workbook filename from the scoped branch code", () => {
  const { filename } = readWorkbook(false);

  assert.equal(filename, "bao-cao-ban-le-HCM-01-Injected-xlsx-2026-08-09-2026-08-10.xlsx");
  assert.doesNotMatch(filename, /[\r\n\\/\";]/);
});

test("loads the branch code with both authenticated company and branch scope", async () => {
  const calls: Array<{ filter: unknown; selection?: string }> = [];
  const code = await loadRetailReportBranchCode(
    { companyCode: "ACME", branchId: "branch-1" },
    {
      findOne(filter) {
        const call: { filter: unknown; selection?: string } = { filter };
        calls.push(call);
        return {
          select(selection) {
            call.selection = selection;
            return { lean: async () => ({ code: "HCM01" }) };
          },
        };
      },
    },
  );

  assert.equal(code, "HCM01");
  assert.deepEqual(calls, [{
    filter: { _id: "branch-1", companyCode: "ACME" },
    selection: "code",
  }]);
});

function response() {
  return {
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("export reuses authenticated scope, effective manager capability, and summary validation", async () => {
  const calls: Array<{ scope: unknown; query?: unknown; includeProfit?: boolean }> = [];
  const controller = createRetailReportController({
    hasCapability: async (_actor, capability) => {
      assert.equal(capability, "manager");
      return false;
    },
    summary: async (reportScope, query, includeProfit) => {
      calls.push({ scope: reportScope, query, includeProfit });
      return { ...model, summary: { ...model.summary, totalCost: undefined, grossProfit: undefined, grossMarginPercent: undefined } };
    },
    findBranchCode: async (reportScope) => {
      calls.push({ scope: reportScope });
      return "HCM01";
    },
    buildWorkbook: (_report, options) => {
      assert.deepEqual(options, { includeProfit: false, branchCode: "HCM01" });
      return { buffer: Buffer.from("xlsx"), filename: "safe.xlsx" };
    },
  });
  const res = response();
  let forwarded: unknown;

  await controller.export(
    {
      user: { role: "user", companyCode: "ACME", branchId: "branch-1", permissions: ["retail:operate"] },
      query: {
        companyCode: "ACME",
        branchId: "branch-1",
        from: "2026-08-09",
        to: "2026-08-10",
        includeProfit: "true",
        filename: "evil\r\nX-Injected: yes.xlsx",
      },
      body: { filename: "also-evil.xlsx", branchCode: "OTHER" },
    } as any,
    res as any,
    (error: unknown) => { forwarded = error; },
  );

  assert.equal(forwarded, undefined);
  assert.deepEqual(calls.map(({ scope }) => scope), [
    { companyCode: "ACME", branchId: "branch-1" },
    { companyCode: "ACME", branchId: "branch-1" },
  ]);
  assert.equal((calls[1].query as any).filename, "evil\r\nX-Injected: yes.xlsx");
  assert.equal(calls[1].includeProfit, false);
  assert.equal(res.headers["Content-Type"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(res.headers["Content-Disposition"], 'attachment; filename="safe.xlsx"');
  assert.deepEqual(res.body, Buffer.from("xlsx"));
});

test("export forwards report and branch errors to Express error middleware", async () => {
  const expected = Object.assign(new Error("Branch not found"), { status: 404 });
  const controller = createRetailReportController({
    hasCapability: async () => false,
    summary: async () => model,
    findBranchCode: async () => { throw expected; },
    buildWorkbook: () => { throw new Error("must not build"); },
  });
  const res = response();
  let forwarded: unknown;

  await controller.export(
    { user: { role: "user", companyCode: "ACME", branchId: "branch-1" }, query: {}, body: {} } as any,
    res as any,
    (error: unknown) => { forwarded = error; },
  );

  assert.equal(forwarded, expected);
  assert.equal(res.body, undefined);
});

test("export route uses the existing operate-or-manager guard", () => {
  const route = retailReportRoutes.stack.find((layer: any) => layer.route?.path === "/export") as any;
  assert.ok(route?.route?.methods?.get);
  assert.equal(route.route.stack.length, 2);
});
