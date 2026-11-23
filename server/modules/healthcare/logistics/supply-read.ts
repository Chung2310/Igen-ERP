import type { Db } from "mongodb";
import { scope, type Actor } from "./store";
export type SupplyQuery = {
  page: number;
  pageSize: number;
  q: string;
  active?: string;
  category?: string;
  supplierId?: string;
  warehouseId?: string;
  stockStatus?: string;
  expiry?: string;
};
function pipeline(actor: Actor, query: Partial<SupplyQuery>) {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  const match: Record<string, unknown> = { ...scope(actor) };
  if (query.active !== "all") match.active = query.active !== "false";
  if (query.q) {
    const r = { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    match.$or = [{ name: r }, { code: r }];
  }
  for (const key of ["category", "supplierId"] as const) if (query[key]) match[key] = query[key];
  return [
    { $match: match },
    {
      $lookup: {
        from: "healthcare_supply_balances",
        let: { id: "$_id" },
        pipeline: [
          {
            $match: {
              ...scope(actor),
              ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
              $expr: { $eq: ["$supplyId", "$$id"] },
            },
          },
        ],
        as: "balances",
      },
    },
    ...(query.warehouseId
      ? [{ $match: { $or: [{ "balances.0": { $exists: true } }, { warehouseId: query.warehouseId }] } }]
      : []),
    {
      $set: {
        quantity: { $sum: "$balances.quantity" },
        stockValue: { $sum: "$balances.value" },
        expired: {
          $anyElementTrue: {
            $map: {
              input: "$balances",
              as: "b",
              in: {
                $and: [{ $gt: ["$$b.quantity", 0] }, { $ne: ["$$b.expiryDay", ""] }, { $lt: ["$$b.expiryDay", today] }],
              },
            },
          },
        },
        expiringSoon: {
          $anyElementTrue: {
            $map: {
              input: "$balances",
              as: "b",
              in: {
                $and: [
                  { $gt: ["$$b.quantity", 0] },
                  { $gte: ["$$b.expiryDay", today] },
                  { $lte: ["$$b.expiryDay", soon] },
                ],
              },
            },
          },
        },
      },
    },
    {
      $set: {
        stockStatus: {
          $cond: [
            { $lte: ["$quantity", 0] },
            "out-of-stock",
            { $cond: [{ $lt: ["$quantity", "$minQuantity"] }, "low-stock", "in-stock"] },
          ],
        },
      },
    },
    ...(query.stockStatus ? [{ $match: { stockStatus: query.stockStatus } }] : []),
    ...(query.expiry === "expired"
      ? [{ $match: { expired: true } }]
      : query.expiry === "soon"
        ? [{ $match: { expiringSoon: true } }]
        : []),
    { $project: { balances: 0, companyCode: 0, branchId: 0, createdBy: 0, updatedBy: 0 } },
  ];
}
export async function listSupplies(db: Db, actor: Actor, query: SupplyQuery) {
  const [result] = await db
    .collection("healthcare_supplies")
    .aggregate([
      ...pipeline(actor, query),
      {
        $facet: {
          items: [
            { $sort: { name: 1, _id: 1 } },
            { $skip: (query.page - 1) * query.pageSize },
            { $limit: query.pageSize },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();
  return { items: result.items, total: result.total[0]?.count || 0, page: query.page, pageSize: query.pageSize };
}
export async function supplyStats(db: Db, actor: Actor) {
  const [result] = await db
    .collection("healthcare_supplies")
    .aggregate([
      ...pipeline(actor, {}),
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          totalValue: { $sum: "$stockValue" },
          lowStock: { $sum: { $cond: [{ $ne: ["$stockStatus", "in-stock"] }, 1, 0] } },
          expired: { $sum: { $cond: ["$expired", 1, 0] } },
          expiringSoon: { $sum: { $cond: ["$expiringSoon", 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ])
    .toArray();
  return result || { totalItems: 0, totalQuantity: 0, totalValue: 0, lowStock: 0, expired: 0, expiringSoon: 0 };
}
