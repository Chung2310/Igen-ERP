import type { PipelineStage } from "mongoose";
import type { RetailBranchScope } from "../contracts";
import { CashierShiftModel } from "../models/cashier-shift.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { buildRetailReportModel } from "./retail-report-metrics";
import { parseRetailReportRange } from "./retail-report-range";

type ReportRange = { from: string; to: string };
type ReportFilters = { salespersonId?: string; productId?: string; sku?: string; category?: string; brand?: string };
type ReportInput = Parameters<typeof buildRetailReportModel>[0];
type ReportOrder = ReportInput["orders"][number];
type ReportShift = ReportInput["shifts"][number];

type RetailReportRepository = {
  loadOrders(pipeline: PipelineStage[]): Promise<ReportOrder[]>;
  loadShifts(pipeline: PipelineStage[]): Promise<ReportShift[]>;
};

export function buildRetailReportOrderPipeline(scope: RetailBranchScope, range: ReportRange, filters: ReportFilters = {}): PipelineStage[] {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const itemFilters = Object.fromEntries(["productId", "sku", "category", "brand"].filter((key) => filters[key as keyof ReportFilters]).map((key) => {
    const value = filters[key as keyof ReportFilters] as string;
    return [key, key === "category" || key === "brand" ? { $regex: `^${escape(value)}$`, $options: "i" } : value];
  }));
  return [
    {
      $match: {
        companyCode: scope.companyCode,
        branchId: scope.branchId,
        businessDate: { $gte: range.from, $lte: range.to },
        ...(filters.salespersonId ? { salespersonId: filters.salespersonId } : {}),
        ...(Object.keys(itemFilters).length ? { items: { $elemMatch: itemFilters } } : {}),
      },
    },
    {
      $project: {
        _id: 0,
        orderCode: 1,
        shiftId: 1,
        businessDate: 1,
        status: 1,
        grandTotal: 1,
        totalCost: 1,
        refundedAmount: 1,
        dueAmount: 1,
        "payments.method": 1,
        "payments.amount": 1,
        customerId: 1,
        customerName: 1,
        customerPhone: 1,
        dueDate: 1,
        salespersonId: 1,
        items: 1,
      },
    },
  ];
}

export function buildRetailReportShiftPipeline(scope: RetailBranchScope, range: ReportRange): PipelineStage[] {
  return [
    {
      $match: {
        companyCode: scope.companyCode,
        branchId: scope.branchId,
        businessDate: { $gte: range.from, $lte: range.to },
      },
    },
    {
      $project: {
        shiftCode: 1,
        businessDate: 1,
        cashierId: 1,
        cashierName: 1,
        status: 1,
        grossSales: 1,
        collectedAmount: 1,
        refundedAmount: 1,
        varianceAmount: 1,
      },
    },
  ];
}

export function createRetailReportService(repository: RetailReportRepository) {
  return {
    async summary(scope: RetailBranchScope, query: unknown, includeProfit: boolean) {
      const range = parseRetailReportRange((query || {}) as Record<string, unknown>);
      const raw = (query || {}) as Record<string, unknown>;
      const filters = Object.fromEntries(["salespersonId", "productId", "sku", "category", "brand"].map((key) => [key, String(raw[key] || "").trim()]).filter(([, value]) => value)) as ReportFilters;
      const [orders, shifts] = await Promise.all([
        repository.loadOrders(buildRetailReportOrderPipeline(scope, range, filters)),
        repository.loadShifts(buildRetailReportShiftPipeline(scope, range)),
      ]);

      return buildRetailReportModel({
        orders,
        shifts,
        days: range.days,
        today: parseRetailReportRange({}).to,
        includeProfit,
        filters,
      });
    },
  };
}

export const RetailReportService = createRetailReportService({
  loadOrders: (pipeline) => RetailOrderModel.aggregate<ReportOrder>(pipeline),
  loadShifts: (pipeline) => CashierShiftModel.aggregate<ReportShift>(pipeline),
});
