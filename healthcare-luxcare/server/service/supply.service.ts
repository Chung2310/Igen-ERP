import { withInventoryAvailability } from "./supply/inventory-availability";
import { supplyStockStatus, supplyBusinessDay } from "../../shared/supply-stock";
import {
  createLegacySupply,
  updateLegacySupply,
  archiveLegacySupply,
  postLegacyStock,
  supplyScope,
  type SupplyActor,
  type LegacyStockPayload,
} from "./supply/legacy-write.service";
import { SupplyModel } from "../model/supply.model";
import { SupplyTransactionModel } from "../model/supply-transaction.model";
import { SupplyVoucherModel } from "../model/supply-voucher.model";
import type { ISupply, SupplyStatus } from "../interface/supply.interface";

export const calculateSupplyStatus = supplyStockStatus;

export function supplyToday(now = new Date()) {
  return new Date(supplyBusinessDay(now) + "T00:00:00.000Z");
}
function withCurrentStatus<
  T extends { quantity: number; minQuantity: number; expiryDate?: Date | string | null; requiresExpiry?: boolean },
>(item: T) {
  return {
    ...item,
    status: supplyStockStatus(item.quantity, item.minQuantity, item.expiryDate, item.requiresExpiry !== false),
  };
}
export function supplyStatusExpression() {
  return {
    $switch: {
      branches: [
        {
          case: { $and: [{ $eq: [{ $ifNull: ["$expiryDate", null] }, null] }, { $ne: ["$requiresExpiry", false] }] },
          then: "quarantined",
        },
        {
          case: {
            $and: [{ $ne: [{ $ifNull: ["$expiryDate", null] }, null] }, { $lt: ["$expiryDate", supplyToday()] }],
          },
          then: "expired",
        },
        { case: { $lte: ["$quantity", 0] }, then: "out-of-stock" },
        { case: { $lte: ["$quantity", "$minQuantity"] }, then: "low-stock" },
      ],
      default: "in-stock",
    },
  };
}
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildSupplyFilter(
  companyCode: string,
  query: {
    search?: string;
    category?: string;
    status?: string;
    expiryStatus?: string;
    branchId?: string;
    supplier?: string;
    supplierId?: string;
    warehouseId?: string;
    warehouse?: string;
    archived?: boolean;
  },
) {
  const filter: any = { ...supplyScope(companyCode), isActive: query.archived === true ? false : { $ne: false } };

  if (query.branchId) filter.branchId = query.branchId;
  if (query.status) filter.$expr = { $eq: [supplyStatusExpression(), query.status] };
  if (query.supplierId) filter.supplierId = query.supplierId;
  if (query.warehouseId) filter.warehouseId = query.warehouseId;

  const category = String(query.category || "").trim();
  if (category) filter.category = { $regex: escapeRegex(category), $options: "i" };

  const supplier = String(query.supplier || "").trim();
  if (supplier) filter.supplier = { $regex: escapeRegex(supplier), $options: "i" };

  const warehouse = String(query.warehouse || "").trim();
  if (warehouse) filter.warehouseLocation = { $regex: escapeRegex(warehouse), $options: "i" };

  const now = supplyToday();
  if (query.expiryStatus === "expired") {
    filter.expiryDate = { $lt: now };
  } else if (query.expiryStatus === "expiring_soon_30") {
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    filter.expiryDate = { $gte: now, $lte: in30Days };
  } else if (query.expiryStatus === "expiring_soon_60") {
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    filter.expiryDate = { $gte: now, $lte: in60Days };
  } else if (query.expiryStatus === "valid") {
    filter.expiryDate = { $gte: now };
  }

  if (query.search) {
    const s = escapeRegex(query.search.trim());
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { code: { $regex: s, $options: "i" } },
      { batchNumber: { $regex: s, $options: "i" } },
      { warehouseLocation: { $regex: s, $options: "i" } },
      { supplier: { $regex: s, $options: "i" } },
    ];
  }

  return filter;
}

export const supplyService = {
  async list(
    companyCode: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      status?: string;
      expiryStatus?: string;
      branchId?: string;
      supplier?: string;
      archived?: boolean;
    },
  ) {
    const filter = buildSupplyFilter(companyCode, query);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SupplyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupplyModel.countDocuments(filter),
    ]);

    return {
      data: await withInventoryAvailability(companyCode, data.map(withCurrentStatus)),
      total,
      page,
      limit,
    };
  },

  async getStats(companyCode: string, branchId?: string) {
    const baseFilter: any = { ...supplyScope(companyCode), isActive: { $ne: false } };
    if (branchId) baseFilter.branchId = branchId;

    const now = supplyToday();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalItems, totalQuantityAgg, lowStockCount, outOfStockCount, expiredCount, expiringSoonCount] =
      await Promise.all([
        SupplyModel.countDocuments(baseFilter),
        SupplyModel.aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: null,
              totalQty: { $sum: "$quantity" },
              totalValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$unitPrice", 0] }] } },
            },
          },
        ]),
        SupplyModel.countDocuments({ ...baseFilter, $expr: { $eq: [supplyStatusExpression(), "low-stock"] } }),
        SupplyModel.countDocuments({ ...baseFilter, $expr: { $eq: [supplyStatusExpression(), "out-of-stock"] } }),
        SupplyModel.countDocuments({ ...baseFilter, expiryDate: { $lt: now } }),
        SupplyModel.countDocuments({ ...baseFilter, expiryDate: { $gte: now, $lte: in30Days } }),
      ]);

    return {
      totalItems,
      totalQuantity: totalQuantityAgg[0]?.totalQty || 0,
      totalValue: totalQuantityAgg[0]?.totalValue || 0,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      expiringSoonCount,
    };
  },

  async get(companyCode: string, id: string, branchId?: string) {
    const item = await SupplyModel.findOne({ _id: id, ...supplyScope(companyCode, branchId) }).lean();
    return item ? (await withInventoryAvailability(companyCode, [withCurrentStatus(item)]))[0] : null;
  },

  create: createLegacySupply,
  update: updateLegacySupply,
  remove: archiveLegacySupply,
  async restore(companyCode: string, id: string, actor: SupplyActor, branchId?: string) {
    return archiveLegacySupply(companyCode, id, actor, branchId, true);
  },
  async stockIn(companyCode: string, id: string, actor: SupplyActor, data: any, branchId?: string, key?: string) {
    const result = await postLegacyStock(
      companyCode,
      actor,
      { type: "in", reason: data.reason || "Nhập thêm vào kho", items: [{ ...data, supplyId: id }] },
      branchId,
      key,
    );
    return { supply: result.supplies[0], transaction: result.transactions[0] };
  },
  async stockOut(companyCode: string, id: string, actor: SupplyActor, data: any, branchId?: string, key?: string) {
    const result = await postLegacyStock(
      companyCode,
      actor,
      {
        type: "out",
        reason: data.reason,
        recipientDepartment: data.recipientDepartment,
        items: [{ supplyId: id, quantity: data.quantity }],
      },
      branchId,
      key,
    );
    return { supply: result.supplies[0], transaction: result.transactions[0] };
  },
  batchStockTransaction: postLegacyStock,
  async listTransactions(companyCode: string, supplyId: string, limit = 50, branchId?: string) {
    return SupplyTransactionModel.find({ ...supplyScope(companyCode, branchId), supplyId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  },

  async listAllForExport(companyCode: string, query: any) {
    const filter = buildSupplyFilter(companyCode, query);
    return (await SupplyModel.find(filter).sort({ createdAt: -1 }).lean()).map(withCurrentStatus);
  },

  async listAllTransactions(
    companyCode: string,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      search?: string;
      supplyId?: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const filter: any = { companyCode };

    if (query.branchId) {
      filter.branchId = query.branchId;
    }
    if (query.type && (query.type === "in" || query.type === "out")) {
      filter.type = query.type;
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const documentMatch: any = {};
    if (query.status === "draft" || query.status === "completed") documentMatch.status = query.status;
    if (query.supplyId) documentMatch["items.supplyId"] = query.supplyId;
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      documentMatch.$or = [
        { batchCode: regex },
        { performerName: regex },
        { recipientDepartment: regex },
        { supplier: regex },
        { reason: regex },
        { items: { $elemMatch: { supplyName: regex } } },
        { items: { $elemMatch: { supplyCode: regex } } },
        { items: { $elemMatch: { batchNumber: regex } } },
      ];
    }

    const pipeline: any[] = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ["$batchCode", ""] } }, 0] },
              { $concat: ["batch:", "$batchCode"] },
              { $concat: ["transaction:", { $toString: "$_id" }] },
            ],
          },
          batchCode: { $first: "$batchCode" },
          type: { $first: "$type" },
          createdAt: { $first: "$createdAt" },
          performerId: { $first: "$performerId" },
          performerName: { $first: "$performerName" },
          recipientDepartment: { $first: "$recipientDepartment" },
          reason: { $first: "$reason" },
          supplier: { $first: "$supplier" },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$unitPrice", 0] }] } },
          items: { $push: "$$ROOT" },
        },
      },
      { $set: { status: "completed" } },
      {
        $unionWith: {
          coll: SupplyVoucherModel.collection.collectionName,
          pipeline: [
            { $match: { ...filter, status: "draft" } },
            {
              $project: {
                _id: { $concat: ["draft:", { $toString: "$_id" }] },
                voucherId: { $toString: "$_id" },
                batchCode: 1,
                type: 1,
                status: 1,
                createdAt: 1,
                performerId: 1,
                performerName: 1,
                recipientDepartment: 1,
                reason: 1,
                supplier: 1,
                warehouseLocation: 1,
                totalQuantity: { $sum: "$items.quantity" },
                totalValue: {
                  $sum: {
                    $map: {
                      input: "$items",
                      as: "item",
                      in: { $multiply: ["$$item.quantity", { $ifNull: ["$$item.unitPrice", 0] }] },
                    },
                  },
                },
                items: {
                  $map: {
                    input: "$items",
                    as: "item",
                    in: {
                      $mergeObjects: [
                        "$$item",
                        {
                          type: "$type",
                          performerId: "$performerId",
                          performerName: "$performerName",
                          batchCode: "$batchCode",
                          createdAt: "$createdAt",
                        },
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      },
      ...(Object.keys(documentMatch).length ? [{ $match: documentMatch }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "value" }],
          stats: [
            {
              $group: {
                _id: "$type",
                totalQty: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$totalQuantity", 0] } },
                count: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ];

    const [result] = await SupplyTransactionModel.aggregate(pipeline);
    const data = result?.data || [];
    const total = result?.total?.[0]?.value || 0;
    const statsAgg = result?.stats || [];

    let totalInQty = 0;
    let totalInCount = 0;
    let totalOutQty = 0;
    let totalOutCount = 0;

    for (const stat of statsAgg) {
      if (stat._id === "in") {
        totalInQty = stat.totalQty;
        totalInCount = stat.count;
      } else if (stat._id === "out") {
        totalOutQty = stat.totalQty;
        totalOutCount = stat.count;
      }
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalInQty,
        totalInCount,
        totalOutQty,
        totalOutCount,
      },
    };
  },

  async listAllTransactionsForExport(
    companyCode: string,
    query: {
      type?: string;
      search?: string;
      supplyId?: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const filter: any = { companyCode };

    if (query.branchId) {
      filter.branchId = query.branchId;
    }
    if (query.type && (query.type === "in" || query.type === "out")) {
      filter.type = query.type;
    }
    if (query.supplyId) {
      filter.supplyId = query.supplyId;
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { supplyName: regex },
        { supplyCode: regex },
        { performerName: regex },
        { recipientDepartment: regex },
        { batchNumber: regex },
        { batchCode: regex },
        { reason: regex },
      ];
    }

    return SupplyTransactionModel.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
  },
};
