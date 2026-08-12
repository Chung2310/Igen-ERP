import assert from "node:assert/strict";
import test from "node:test";
import { buildRetailReportModel, projectRetailReportForCapability } from "./retail-report-metrics";

type Order = Parameters<typeof buildRetailReportModel>[0]["orders"][number];
type Shift = Parameters<typeof buildRetailReportModel>[0]["shifts"][number];

const shift = (overrides: Partial<Shift> = {}): Shift => ({
  _id: "shift-alice",
  shiftCode: "CA-001",
  businessDate: "2026-08-10",
  cashierId: "cashier-alice",
  cashierName: "Alice",
  status: "closed",
  grossSales: 0,
  collectedAmount: 0,
  refundedAmount: 0,
  ...overrides,
});

const order = (overrides: Partial<Order> = {}): Order => ({
  orderCode: "DH-001",
  shiftId: "shift-alice",
  businessDate: "2026-08-10",
  status: "completed",
  grandTotal: 100,
  totalCost: 60,
  refundedAmount: 0,
  dueAmount: 0,
  payments: [],
  ...overrides,
});

test("calculates gross, refunds, net, active order average, collected, due, and profit", () => {
  const model = buildRetailReportModel({
    orders: [
      order({
        orderCode: "DH-001",
        status: "confirmed",
        grandTotal: 100,
        totalCost: 60,
        dueAmount: 30,
        payments: [
          { method: "cash", amount: 50, tenderedAmount: 100, changeAmount: 50 },
          { method: "card", amount: 20 },
        ],
      }),
      order({ orderCode: "DH-002", grandTotal: 200, totalCost: 100, payments: [{ method: "transfer", amount: 200 }] }),
      order({
        orderCode: "DH-003",
        shiftId: "shift-bob",
        status: "cancelled",
        grandTotal: 80,
        totalCost: 50,
        refundedAmount: 80,
        payments: [{ method: "cash", amount: 80 }],
      }),
      order({
        orderCode: undefined,
        status: "draft",
        grandTotal: 999,
        totalCost: 700,
        dueAmount: 999,
        payments: [{ method: "cash", amount: 999 }],
      }),
    ],
    shifts: [shift(), shift({ _id: "shift-bob", shiftCode: "CA-002", cashierId: "cashier-bob", cashierName: "Bob" })],
    days: ["2026-08-10"],
    today: "2026-08-10",
    includeProfit: true,
  });

  assert.deepEqual(model.range, { from: "2026-08-10", to: "2026-08-10" });
  assert.deepEqual(model.summary, {
    grossSales: 380,
    refunds: 80,
    netSales: 300,
    orderCount: 2,
    averageOrderValue: 150,
    collectedAmount: 350,
    dueAmount: 30,
    totalCost: 160,
    grossProfit: 140,
    grossMarginPercent: 140 / 3,
  });
});

test("keeps a confirmed-then-cancelled order at net zero and excludes an expired draft", () => {
  const model = buildRetailReportModel({
    orders: [
      order({ orderCode: "DH-CANCELLED", status: "cancelled", grandTotal: 125, refundedAmount: 125, totalCost: 70 }),
      order({ orderCode: undefined, status: "draft", grandTotal: 500, refundedAmount: 0, totalCost: 300 }),
    ],
    shifts: [shift()],
    days: ["2026-08-10"],
    today: "2026-08-10",
    includeProfit: true,
  });

  assert.deepEqual(
    {
      grossSales: model.summary.grossSales,
      refunds: model.summary.refunds,
      netSales: model.summary.netSales,
      orderCount: model.summary.orderCount,
      totalCost: model.summary.totalCost,
    },
    { grossSales: 125, refunds: 125, netSales: 0, orderCount: 0, totalCost: 0 },
  );
});

test("uses payment amount, fills empty days, copies shifts, and sorts cashiers by net sales then name", () => {
  const model = buildRetailReportModel({
    orders: [
      order({
        orderCode: "DH-ZED",
        shiftId: "shift-zed",
        businessDate: "2026-08-09",
        grandTotal: 200,
        payments: [{ method: "cash", amount: 180, tenderedAmount: 500, changeAmount: 320 }],
      }),
      order({ orderCode: "DH-BOB", shiftId: "shift-bob", grandTotal: 100, payments: [{ method: "card", amount: 100 }] }),
      order({ orderCode: "DH-ALICE", shiftId: "shift-alice", grandTotal: 100, payments: [{ method: "cash", amount: 100 }] }),
    ],
    shifts: [
      shift({ _id: "shift-zed", shiftId: "shift-zed", shiftCode: "CA-003", businessDate: "2026-08-09", cashierId: "cashier-zed", cashierName: "Zed", grossSales: 200, collectedAmount: 180, refundedAmount: 20, varianceAmount: -5 }),
      shift({ _id: "shift-bob", shiftId: "shift-bob", shiftCode: "CA-002", cashierId: "cashier-bob", cashierName: "Bob" }),
      shift({ _id: "shift-alice", shiftId: "shift-alice", shiftCode: "CA-001", cashierId: "cashier-alice", cashierName: "Alice" }),
    ],
    days: ["2026-08-09", "2026-08-10", "2026-08-11"],
    today: "2026-08-10",
    includeProfit: false,
  });

  assert.deepEqual(model.paymentMix, [
    { method: "cash", amount: 280 },
    { method: "card", amount: 100 },
  ]);
  assert.deepEqual(model.timeSeries, [
    { businessDate: "2026-08-09", grossSales: 200, refunds: 0, netSales: 200, collectedAmount: 180, orderCount: 1 },
    { businessDate: "2026-08-10", grossSales: 200, refunds: 0, netSales: 200, collectedAmount: 200, orderCount: 2 },
    { businessDate: "2026-08-11", grossSales: 0, refunds: 0, netSales: 0, collectedAmount: 0, orderCount: 0 },
  ]);
  assert.deepEqual(model.cashiers.map(({ cashierName, netSales }) => ({ cashierName, netSales })), [
    { cashierName: "Zed", netSales: 200 },
    { cashierName: "Alice", netSales: 100 },
    { cashierName: "Bob", netSales: 100 },
  ]);
  assert.deepEqual(model.shifts[0], {
    shiftId: "shift-zed",
    shiftCode: "CA-003",
    businessDate: "2026-08-09",
    cashierId: "cashier-zed",
    cashierName: "Zed",
    status: "closed",
    grossSales: 200,
    collectedAmount: 180,
    refundedAmount: 20,
    varianceAmount: -5,
  });
});

test("groups active confirmed and completed debt by customer and Vietnam business date", () => {
  const model = buildRetailReportModel({
    orders: [
      order({ orderCode: "DH-001", status: "confirmed", customerId: "customer-one", customerName: "Customer One", customerPhone: "0901", dueAmount: 50, dueDate: "2026-08-09T00:00:00.000Z" }),
      order({ orderCode: "DH-002", status: "confirmed", customerId: "customer-one", customerName: "Customer One", customerPhone: "0901", dueAmount: 100, dueDate: new Date("2026-08-09T17:00:00.000Z") }),
      order({ orderCode: "DH-003", status: "confirmed", customerId: "customer-two", customerName: "Customer Two", dueAmount: 30, dueDate: "2026-08-11" }),
      order({ orderCode: "DH-004", status: "completed", customerId: "customer-three", customerName: "Customer Three", dueAmount: 90, dueDate: "2026-08-08" }),
      order({ orderCode: "DH-005", status: "cancelled", customerId: "ignored", customerName: "Ignored", dueAmount: 90, dueDate: "2026-08-08" }),
    ],
    shifts: [shift()],
    days: ["2026-08-10"],
    today: "2026-08-10",
    includeProfit: false,
  });

  assert.equal(model.summary.dueAmount, 270);
  assert.deepEqual(model.debt, {
    totalDebt: 270,
    overdueDebt: 140,
    dueTodayDebt: 100,
    upcomingDebt: 30,
    customers: [
      {
        customerId: "customer-one",
        customerName: "Customer One",
        customerPhone: "0901",
        totalDebt: 150,
        overdueDebt: 50,
        nearestDueDate: "2026-08-09",
        orderCount: 2,
      },
      {
        customerId: "customer-three",
        customerName: "Customer Three",
        totalDebt: 90,
        overdueDebt: 90,
        nearestDueDate: "2026-08-08",
        orderCount: 1,
      },
      {
        customerId: "customer-two",
        customerName: "Customer Two",
        totalDebt: 30,
        overdueDebt: 0,
        nearestDueDate: "2026-08-11",
        orderCount: 1,
      },
    ],
  });
});

test("removes profit fields from operator projections without mutating the manager model", () => {
  const managerModel = buildRetailReportModel({
    orders: [order({ grandTotal: 200, totalCost: 125 })],
    shifts: [shift()],
    days: ["2026-08-10"],
    today: "2026-08-10",
    includeProfit: true,
  });

  const operatorModel = projectRetailReportForCapability(managerModel, false);
  const managerProjection = projectRetailReportForCapability(managerModel, true);

  assert.equal(Object.hasOwn(operatorModel.summary, "totalCost"), false);
  assert.equal(Object.hasOwn(operatorModel.summary, "grossProfit"), false);
  assert.equal(Object.hasOwn(operatorModel.summary, "grossMarginPercent"), false);
  assert.deepEqual(managerProjection.summary, {
    grossSales: 200,
    refunds: 0,
    netSales: 200,
    orderCount: 1,
    averageOrderValue: 200,
    collectedAmount: 0,
    dueAmount: 0,
    totalCost: 125,
    grossProfit: 75,
    grossMarginPercent: 37.5,
  });
  assert.equal(managerModel.summary.totalCost, 125);
});

test("builds deterministic top and slow product rows with manager-only profit", () => {
  const orders = [order({
    salespersonId: "seller-1",
    items: [
      { productId: "p2", sku: "B", productName: "Beta", category: "Drinks", brand: "North", quantity: 1, unitPrice: 50, unitCost: 30, discountAmount: 0, lineTotal: 50 },
      { productId: "p1", sku: "A", productName: "Alpha", category: "Drinks", brand: "South", quantity: 2, unitPrice: 50, unitCost: 20, discountAmount: 10, lineTotal: 90 },
    ],
  })];
  const manager = buildRetailReportModel({ orders, shifts: [shift()], days: ["2026-08-10"], today: "2026-08-10", includeProfit: true });
  assert.deepEqual(manager.products, [
    { productId: "p1", sku: "A", productName: "Alpha", category: "Drinks", brand: "South", netQuantity: 2, netSales: 90, profit: 50 },
    { productId: "p2", sku: "B", productName: "Beta", category: "Drinks", brand: "North", netQuantity: 1, netSales: 50, profit: 20 },
  ]);
  assert.deepEqual(manager.slowProducts.map((row) => row.sku), ["B", "A"]);
  const operator = buildRetailReportModel({ orders, shifts: [], days: ["2026-08-10"], today: "2026-08-10", includeProfit: false });
  assert.equal(operator.products.some((row) => "profit" in row), false);
});

test("product metrics honor product, SKU, category, brand and salesperson filters", () => {
  const model = buildRetailReportModel({
    orders: [
      order({ salespersonId: "seller-1", items: [{ productId: "p1", sku: "A", productName: "Alpha", category: "Drinks", brand: "North", quantity: 1, unitPrice: 100, unitCost: 50, discountAmount: 0, lineTotal: 100 }] }),
      order({ orderCode: "DH-2", salespersonId: "seller-2", items: [{ productId: "p2", sku: "B", productName: "Beta", category: "Food", brand: "South", quantity: 1, unitPrice: 200, unitCost: 100, discountAmount: 0, lineTotal: 200 }] }),
    ], shifts: [], days: ["2026-08-10"], today: "2026-08-10", includeProfit: true,
    filters: { salespersonId: "seller-1", productId: "p1", sku: "A", category: "drinks", brand: "north" },
  });
  assert.deepEqual(model.products.map((row) => row.productId), ["p1"]);
});
