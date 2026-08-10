import type { RetailPaymentMethod } from "../interfaces/cashier-shift.interface";

type RetailReportOrder = {
  orderCode?: string;
  shiftId?: unknown;
  businessDate?: string;
  status: string;
  grandTotal: number;
  totalCost: number;
  refundedAmount: number;
  dueAmount: number;
  payments?: Array<{ method: RetailPaymentMethod; amount: number; tenderedAmount?: number; changeAmount?: number }>;
  customerId?: unknown;
  customerName?: string;
  customerPhone?: string;
  dueDate?: Date | string;
};

type RetailReportShift = {
  _id?: unknown;
  shiftId?: unknown;
  shiftCode: string;
  businessDate: string;
  cashierId: string;
  cashierName: string;
  status: string;
  grossSales: number;
  collectedAmount: number;
  refundedAmount: number;
  varianceAmount?: number;
};

type RetailReportInput = {
  orders: RetailReportOrder[];
  shifts: RetailReportShift[];
  days: string[];
  today: string;
  includeProfit: boolean;
};

export type RetailReportModel = {
  range: { from: string; to: string };
  summary: {
    grossSales: number;
    refunds: number;
    netSales: number;
    orderCount: number;
    averageOrderValue: number;
    collectedAmount: number;
    dueAmount: number;
    totalCost?: number;
    grossProfit?: number;
    grossMarginPercent?: number;
  };
  timeSeries: Array<{
    businessDate: string;
    grossSales: number;
    refunds: number;
    netSales: number;
    collectedAmount: number;
    orderCount: number;
  }>;
  paymentMix: Array<{ method: RetailPaymentMethod; amount: number }>;
  cashiers: Array<{
    cashierId: string;
    cashierName: string;
    orderCount: number;
    grossSales: number;
    refunds: number;
    netSales: number;
    averageOrderValue: number;
  }>;
  shifts: Array<{
    shiftId: string;
    shiftCode: string;
    businessDate: string;
    cashierId: string;
    cashierName: string;
    status: string;
    grossSales: number;
    collectedAmount: number;
    refundedAmount: number;
    varianceAmount?: number;
  }>;
  debt: {
    totalDebt: number;
    overdueDebt: number;
    dueTodayDebt: number;
    upcomingDebt: number;
    customers: Array<{
      customerId: string;
      customerName: string;
      customerPhone?: string;
      totalDebt: number;
      overdueDebt: number;
      nearestDueDate?: string;
      orderCount: number;
    }>;
  };
};

const PAYMENT_METHODS: RetailPaymentMethod[] = ["cash", "card", "transfer", "ewallet"];
const vietnamDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const isActive = (order: RetailReportOrder) => order.status === "confirmed" || order.status === "completed";
const collectedFor = (order: RetailReportOrder) => sum((order.payments || []).map((payment) => payment.amount));

function vietnamBusinessDate(value: Date | string | undefined): string | undefined {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value === undefined) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const parts = vietnamDateFormatter.formatToParts(parsed);
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function projectRetailReportForCapability(model: RetailReportModel, includeProfit: boolean): RetailReportModel {
  if (includeProfit) return model;
  const { totalCost: _totalCost, grossProfit: _grossProfit, grossMarginPercent: _grossMarginPercent, ...summary } = model.summary;
  return { ...model, summary };
}

export function buildRetailReportModel(input: RetailReportInput): RetailReportModel {
  const orders = input.orders.filter((order) => Boolean(order.orderCode));
  const activeOrders = orders.filter(isActive);
  const grossSales = sum(orders.map((order) => order.grandTotal));
  const refunds = sum(orders.map((order) => order.refundedAmount));
  const netSales = grossSales - refunds;
  const activeGrossSales = sum(activeOrders.map((order) => order.grandTotal));
  const totalCost = sum(activeOrders.map((order) => order.totalCost));
  const grossProfit = netSales - totalCost;

  const timeSeries = input.days.map((businessDate) => {
    const dayOrders = orders.filter((order) => order.businessDate === businessDate);
    const dayGrossSales = sum(dayOrders.map((order) => order.grandTotal));
    const dayRefunds = sum(dayOrders.map((order) => order.refundedAmount));
    return {
      businessDate,
      grossSales: dayGrossSales,
      refunds: dayRefunds,
      netSales: dayGrossSales - dayRefunds,
      collectedAmount: sum(dayOrders.map(collectedFor)),
      orderCount: dayOrders.filter(isActive).length,
    };
  });

  const paymentMix = PAYMENT_METHODS.map((method) => ({
    method,
    amount: sum(orders.flatMap((order) => (order.payments || []).filter((payment) => payment.method === method).map((payment) => payment.amount))),
  })).filter(({ amount }) => amount !== 0);

  const shiftById = new Map(input.shifts.map((shift) => [String(shift.shiftId ?? shift._id ?? ""), shift]));
  const cashierMap = new Map<string, RetailReportModel["cashiers"][number] & { activeGrossSales: number }>();
  for (const order of orders) {
    const shift = shiftById.get(String(order.shiftId ?? ""));
    if (!shift) continue;
    const row = cashierMap.get(shift.cashierId) || {
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
      orderCount: 0,
      grossSales: 0,
      refunds: 0,
      netSales: 0,
      averageOrderValue: 0,
      activeGrossSales: 0,
    };
    row.grossSales += order.grandTotal;
    row.refunds += order.refundedAmount;
    row.netSales = row.grossSales - row.refunds;
    if (isActive(order)) {
      row.orderCount += 1;
      row.activeGrossSales += order.grandTotal;
      row.averageOrderValue = row.activeGrossSales / row.orderCount;
    }
    cashierMap.set(shift.cashierId, row);
  }
  const cashiers = [...cashierMap.values()]
    .map(({ activeGrossSales: _activeGrossSales, ...row }) => row)
    .sort((left, right) => right.netSales - left.netSales || left.cashierName.localeCompare(right.cashierName));

  const debtOrders = orders.filter((order) => order.status === "confirmed" && order.dueAmount > 0);
  const debtCustomers = new Map<string, RetailReportModel["debt"]["customers"][number]>();
  let overdueDebt = 0;
  let dueTodayDebt = 0;
  let upcomingDebt = 0;
  for (const order of debtOrders) {
    const dueDate = vietnamBusinessDate(order.dueDate);
    if (dueDate && dueDate < input.today) overdueDebt += order.dueAmount;
    else if (dueDate === input.today) dueTodayDebt += order.dueAmount;
    else if (dueDate && dueDate > input.today) upcomingDebt += order.dueAmount;

    const customerId = String(order.customerId ?? "");
    const customer = debtCustomers.get(customerId) || {
      customerId,
      customerName: order.customerName || "",
      ...(order.customerPhone ? { customerPhone: order.customerPhone } : {}),
      totalDebt: 0,
      overdueDebt: 0,
      orderCount: 0,
    };
    customer.totalDebt += order.dueAmount;
    customer.orderCount += 1;
    if (dueDate && dueDate < input.today) customer.overdueDebt += order.dueAmount;
    if (dueDate && (!customer.nearestDueDate || dueDate < customer.nearestDueDate)) customer.nearestDueDate = dueDate;
    debtCustomers.set(customerId, customer);
  }

  const model: RetailReportModel = {
    range: { from: input.days[0] || "", to: input.days.at(-1) || "" },
    summary: {
      grossSales,
      refunds,
      netSales,
      orderCount: activeOrders.length,
      averageOrderValue: activeOrders.length ? activeGrossSales / activeOrders.length : 0,
      collectedAmount: sum(orders.map(collectedFor)),
      dueAmount: sum(activeOrders.filter((order) => order.status === "confirmed" && order.dueAmount > 0).map((order) => order.dueAmount)),
      totalCost,
      grossProfit,
      grossMarginPercent: netSales ? (grossProfit / netSales) * 100 : 0,
    },
    timeSeries,
    paymentMix,
    cashiers,
    shifts: input.shifts.map((shift) => ({
      shiftId: String(shift.shiftId ?? shift._id ?? ""),
      shiftCode: shift.shiftCode,
      businessDate: shift.businessDate,
      cashierId: shift.cashierId,
      cashierName: shift.cashierName,
      status: shift.status,
      grossSales: shift.grossSales,
      collectedAmount: shift.collectedAmount,
      refundedAmount: shift.refundedAmount,
      ...(shift.varianceAmount === undefined ? {} : { varianceAmount: shift.varianceAmount }),
    })),
    debt: {
      totalDebt: sum(debtOrders.map((order) => order.dueAmount)),
      overdueDebt,
      dueTodayDebt,
      upcomingDebt,
      customers: [...debtCustomers.values()].sort(
        (left, right) => right.totalDebt - left.totalDebt || left.customerName.localeCompare(right.customerName),
      ),
    },
  };

  return projectRetailReportForCapability(model, input.includeProfit);
}
