import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRetailReportController } from "../controllers/retail-report.controller";
import { retailRouter } from "../router";
import { retailReportRoutes } from "../routes/retail-report.routes";
import { analyticsService } from "../../../service/analytics.service";
import { RetailOrderModel } from "../models/retail-order.model";
import { CashierShiftModel } from "../models/cashier-shift.model";
import {
  buildRetailReportOrderPipeline,
  buildRetailReportShiftPipeline,
  createRetailReportService,
  RetailReportService,
} from "./retail-report.service";

test("report repository pipelines start with an inclusive company and branch date match", () => {
  const scope = { companyCode: "ACME", branchId: "branch-1" };
  const range = { from: "2026-08-01", to: "2026-08-10" };

  for (const pipeline of [
    buildRetailReportOrderPipeline(scope, range),
    buildRetailReportShiftPipeline(scope, range),
  ]) {
    assert.deepEqual(pipeline[0], {
      $match: {
        companyCode: "ACME",
        branchId: "branch-1",
        businessDate: { $gte: "2026-08-01", $lte: "2026-08-10" },
      },
    });
    assert.ok("$project" in pipeline[1], "repository must project only report fields after the scoped match");
  }
});

test("order pipeline scopes salesperson and product dimensions", () => {
  const pipeline = buildRetailReportOrderPipeline(
    { companyCode: "ACME", branchId: "branch-1" },
    { from: "2026-08-01", to: "2026-08-10" },
    { salespersonId: "seller-1", productId: "p1", sku: "SKU-1", category: "drinks", brand: "north" },
  );
  assert.deepEqual((pipeline[0] as any).$match, {
    companyCode: "ACME", branchId: "branch-1", businessDate: { $gte: "2026-08-01", $lte: "2026-08-10" }, salespersonId: "seller-1",
    items: { $elemMatch: { productId: "p1", sku: "SKU-1", category: { $regex: "^drinks$", $options: "i" }, brand: { $regex: "^north$", $options: "i" } } },
  });
});

test("report service loads scoped rows and delegates business semantics to the report reducer", async () => {
  type Pipeline = ReturnType<typeof buildRetailReportOrderPipeline>;
  const seen: { orders?: Pipeline; shifts?: Pipeline } = {};
  const service = createRetailReportService({
    loadOrders: async (pipeline) => {
      seen.orders = pipeline;
      return [{
        orderCode: "DH-1",
        businessDate: "2026-08-10",
        status: "completed",
        grandTotal: 100,
        totalCost: 60,
        refundedAmount: 0,
        dueAmount: 0,
        payments: [],
      }];
    },
    loadShifts: async (pipeline) => {
      seen.shifts = pipeline;
      return [];
    },
  });

  const result = await service.summary(
    { companyCode: "ACME", branchId: "branch-1" },
    { from: "2026-08-10", to: "2026-08-10" },
    false,
  );

  assert.deepEqual(seen.orders?.[0], {
    $match: {
      companyCode: "ACME",
      branchId: "branch-1",
      businessDate: { $gte: "2026-08-10", $lte: "2026-08-10" },
    },
  });
  assert.deepEqual(seen.shifts?.[0], seen.orders?.[0]);
  assert.equal(result.summary.netSales, 100);
  assert.equal("totalCost" in result.summary, false);
});

function response() {
  return {
    body: undefined as unknown,
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("controller ignores body scope and derives includeProfit from the manager capability", async () => {
  const calls: Array<{ scope: unknown; query: unknown; includeProfit: boolean }> = [];
  const capabilities: Array<{ actor: unknown; capability: string }> = [];
  const controller = createRetailReportController({
    hasCapability: async (actor, capability) => {
      capabilities.push({ actor, capability });
      return (actor as any).permissions.includes("retail:manage");
    },
    summary: async (scope, query, includeProfit) => {
      calls.push({ scope, query, includeProfit });
      return { marker: includeProfit } as any;
    },
  });

  for (const permissions of [["retail:read"], ["retail:manage"]]) {
    const req: any = {
      user: { id: permissions[0], role: "user", companyCode: "ACME", branchId: "branch-1", permissions },
      query: { from: "2026-08-10", to: "2026-08-10", includeProfit: "true" },
      body: { companyCode: "OTHER", branchId: "branch-2", includeProfit: true },
    };
    await controller.summary(req, response() as any, () => undefined);
  }

  assert.deepEqual(calls.map(({ scope }) => scope), [
    { companyCode: "ACME", branchId: "branch-1" },
    { companyCode: "ACME", branchId: "branch-1" },
  ]);
  assert.deepEqual(calls.map(({ includeProfit }) => includeProfit), [false, true]);
  assert.deepEqual(capabilities.map(({ capability }) => capability), ["manager", "manager"]);
});

test("controller forwards async report errors to the API error middleware", async () => {
  const expected = Object.assign(new Error("Khoảng ngày báo cáo không hợp lệ."), { status: 400 });
  const controller = createRetailReportController({
    hasCapability: async () => false,
    summary: async () => { throw expected; },
  });
  const res = response();
  let forwarded: unknown;

  await (controller.summary as any)(
    {
      user: { role: "user", companyCode: "ACME", branchId: "branch-1" },
      query: { from: "invalid" },
      body: {},
    },
    res,
    (error: unknown) => { forwarded = error; },
  );

  assert.equal(forwarded, expected);
  assert.equal(res.body, undefined);
});

test("summary route requires retail read or manager permission instead of POS access", () => {
  const route = retailReportRoutes.stack.find((layer: any) => layer.route?.path === "/summary") as any;
  assert.ok(route?.route?.methods?.get);
  assert.equal(route.route.stack.length, 2, "GET summary must have the report gate before its controller");

  const routeSource = readFileSync(new URL("../routes/retail-report.routes.ts", import.meta.url), "utf8");
  assert.match(
    routeSource,
    /requirePermission\(\["retail:read",\s*RETAIL_MANAGER_PERMISSION\]\)/,
  );

  const mountedPath = retailRouter.stack.find((layer: any) => layer.regexp?.test?.("/retail/reports"));
  assert.ok(mountedPath, "retail router must mount /retail/reports behind the existing parent guards");
});

test("analytics reconciliation uses the same Vietnam business day as the retail report", async () => {
  const originalOrders = RetailOrderModel.aggregate;
  const originalShifts = CashierShiftModel.aggregate;
  const originalAnalytics = analyticsService.getCombinedRevenue;
  const scope = { companyCode: "ACME", branchId: "branch-1" };
  let seen: unknown;
  RetailOrderModel.aggregate = (async () => []) as any;
  CashierShiftModel.aggregate = (async () => []) as any;
  analyticsService.getCombinedRevenue = (async (actualScope, range) => {
    seen = { scope: actualScope, from: range.from.toISOString(), to: range.to.toISOString() };
    return { goodsTotal: 0 };
  }) as typeof originalAnalytics;
  try {
    await RetailReportService.summary(scope, { from: "2026-08-10", to: "2026-08-10" }, false);
    assert.deepEqual(seen, {
      scope,
      from: "2026-08-09T17:00:00.000Z",
      to: "2026-08-10T16:59:59.999Z",
    });
  } finally {
    RetailOrderModel.aggregate = originalOrders;
    CashierShiftModel.aggregate = originalShifts;
    analyticsService.getCombinedRevenue = originalAnalytics;
  }
});
