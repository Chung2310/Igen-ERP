import { type PipelineStage } from "mongoose";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailInvoiceModel } from "../models/retail-invoice.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { businessDateInVietnam } from "./cashier-shift.service";
import type { RetailBranchScope } from "../contracts";

const statuses = ["all", "active", "expiring", "expired", "pending", "none", "unrecorded"] as const;
const invalid = () => Object.assign(new Error("Bộ lọc bảo hành không hợp lệ."), { status: 400, statusCode: 400 });
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeOrderWarrantyQuery(query: any = {}) {
  const q = String(query.q || "").trim();
  const status = String(query.status || "all");
  const days = Number(query.days ?? 30), page = Number(query.page ?? 1), limit = Number(query.limit ?? 20);
  if (q.length > 200 || !statuses.includes(status as any) || !Number.isSafeInteger(days) || days < 1 || days > 3650
    || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) throw invalid();
  return { q, status, days, page, limit };
}

/** Warranty follows the sold order line, including goods without unit identifiers. */
export async function listOrderWarranties(scope: RetailBranchScope, query: any = {}, at = new Date()) {
  if (!scope.companyCode?.trim() || !scope.branchId?.trim()) throw Object.assign(new Error("Vui lòng chọn công ty và chi nhánh."), { status: 400, statusCode: 400 });
  const { q, status, days, page, limit } = normalizeOrderWarrantyQuery(query);
  const tenant = { companyCode: scope.companyCode.trim().toUpperCase(), branchId: scope.branchId.trim() };
  const today = new Date(`${businessDateInVietnam(at)}T00:00:00+07:00`);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const expiringBefore = new Date(tomorrow.getTime() + days * 86_400_000);
  const pipeline: PipelineStage[] = [
    { $match: { ...tenant, status: { $in: ["confirmed", "completed"] }, stockApplied: true } },
    { $lookup: { from: RetailInvoiceModel.collection.name, let: { orderId: { $toString: "$_id" } }, pipeline: [
      { $match: { ...tenant, status: "issued", $expr: { $eq: ["$orderId", "$$orderId"] } } },
      { $project: { invoiceNo: 1, _id: 0 } }, { $limit: 1 },
    ], as: "invoice" } },
    { $lookup: { from: RetailAfterSaleModel.collection.name, let: { orderId: { $toString: "$_id" } }, pipeline: [
      { $match: { ...tenant, status: "completed", type: { $in: ["return", "buyback"] }, $expr: { $eq: ["$orderId", "$$orderId"] } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.orderLineIndex", quantity: { $sum: "$items.quantity" } } },
    ], as: "returned" } },
    { $unwind: { path: "$items", includeArrayIndex: "lineIndex" } },
    { $set: { returnedQuantity: { $let: {
      vars: { line: { $arrayElemAt: [{ $filter: { input: "$returned", as: "row", cond: { $eq: ["$$row._id", "$lineIndex"] } } }, 0] } },
      in: { $ifNull: ["$$line.quantity", 0] },
    } } } },
    { $set: { quantity: { $subtract: ["$items.quantity", "$returnedQuantity"] } } },
    { $match: { quantity: { $gt: 0 } } },
  ];
  if (q) pipeline.push({ $match: { $or: ["orderCode", "invoice.invoiceNo", "customerName", "customerPhone", "customerSnapshot.name", "customerSnapshot.phone", "customerSnapshot.customerCode", "items.productName", "items.sku"]
    .map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } })) } });
  pipeline.push(
    { $set: { warrantyStatus: { $switch: { branches: [
      { case: { $eq: ["$items.customerWarrantyMonths", 0] }, then: "none" },
      { case: { $and: [{ $eq: [{ $type: "$items.customerWarrantyStartAt" }, "date"] }, { $eq: [{ $type: "$items.customerWarrantyEndAt" }, "date"] }] }, then: { $switch: { branches: [
        { case: { $gte: ["$items.customerWarrantyStartAt", tomorrow] }, then: "pending" },
        { case: { $lt: ["$items.customerWarrantyEndAt", today] }, then: "expired" },
        { case: { $lt: ["$items.customerWarrantyEndAt", expiringBefore] }, then: "expiring" },
      ], default: "active" } } },
    ], default: "unrecorded" } } } },
  );
  if (status !== "all") pipeline.push({ $match: { warrantyStatus: status } });
  pipeline.push(
    { $sort: { completedAt: -1, confirmedAt: -1, _id: -1, lineIndex: 1 } },
    { $facet: { items: [
      { $skip: (page - 1) * limit }, { $limit: limit },
      { $project: { _id: 0, id: { $concat: [{ $toString: "$_id" }, ":", { $toString: "$lineIndex" }] }, orderId: { $toString: "$_id" }, orderCode: 1,
        invoiceNo: { $ifNull: [{ $arrayElemAt: ["$invoice.invoiceNo", 0] }, ""] },
        customerName: { $ifNull: ["$customerSnapshot.name", "$customerName"] }, customerPhone: { $ifNull: ["$customerSnapshot.phone", "$customerPhone"] },
        productId: "$items.productId", sku: "$items.sku", productName: "$items.productName", quantity: 1,
        soldAt: { $ifNull: ["$items.soldAt", { $ifNull: ["$confirmedAt", "$completedAt"] }] },
        warrantyStartAt: "$items.customerWarrantyStartAt", warrantyEndAt: "$items.customerWarrantyEndAt", warrantyMonths: "$items.customerWarrantyMonths", status: "$warrantyStatus",
        daysLeft: { $cond: [{ $in: ["$warrantyStatus", ["active", "expiring"]] }, { $floor: { $divide: [{ $subtract: ["$items.customerWarrantyEndAt", today] }, 86_400_000] } }, null] },
      } },
    ], total: [{ $count: "count" }] } },
  );
  const [result] = await RetailOrderModel.aggregate(pipeline);
  return { items: result?.items || [], total: Number(result?.total?.[0]?.count || 0), page, limit };
}
