import {
  SupplyStockBalanceModel as Balance,
  SupplyStockLedgerModel as Ledger,
  SupplyCostLayerModel as Layer,
} from "../../model/supply-inventory.model";
import {
  inventoryReadFilter,
  requireInventoryPermission,
  inventoryView,
  type InventoryActor,
} from "./inventory-access";

export async function readInventoryBalances(actor: InventoryActor, page = 1, limit = 20) {
  const filter = await inventoryReadFilter(actor);
  page = Math.max(1, Math.trunc(page) || 1);
  limit = Math.min(100, Math.max(1, Math.trunc(limit) || 20));
  const [data, total] = await Promise.all([
    Balance.find(filter)
      .sort({ supplyId: 1, lotId: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Balance.countDocuments(filter),
  ]);
  return { data: inventoryView(actor, data), total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Read-only invariant check. Must be run without concurrent posting for a consistent diagnostic. */
export async function reconcileInventory(actor: InventoryActor) {
  requireInventoryPermission(actor, "supply:settings-manage");
  requireInventoryPermission(actor, "supply:cost-read");
  const filter = await inventoryReadFilter(actor);
  const groupKey = {
    companyCode: "$companyCode",
    branchId: "$branchId",
    warehouseId: "$warehouseId",
    locationId: "$locationId",
    supplyId: "$supplyId",
    lotId: "$lotId",
    containerId: "$containerId",
    quality: "$quality",
  };
  const [balances, ledger, layers] = await Promise.all([
    Balance.find(filter).lean(),
    Ledger.aggregate([
      { $match: filter },
      { $group: { _id: groupKey, quantity: { $sum: "$deltaQty" }, value: { $sum: "$deltaValue" } } },
    ]),
    Layer.aggregate([
      { $match: filter },
      { $group: { _id: groupKey, quantity: { $sum: "$remainingQty" }, value: { $sum: "$remainingValue" } } },
    ]),
  ]);
  const key = (row: any) =>
    Object.keys(groupKey)
      .map((k) => row[k] ?? "")
      .join("|");
  const state = new Map<
    string,
    {
      balanceQty: number;
      balanceValue: number;
      ledgerQty: number;
      ledgerValue: number;
      layerQty: number;
      layerValue: number;
    }
  >();
  const entry = (k: string) => {
    if (!state.has(k))
      state.set(k, { balanceQty: 0, balanceValue: 0, ledgerQty: 0, ledgerValue: 0, layerQty: 0, layerValue: 0 });
    return state.get(k)!;
  };
  for (const row of balances)
    Object.assign(entry(key(row)), { balanceQty: row.quantityScaled, balanceValue: row.valueMinor });
  for (const row of ledger) Object.assign(entry(key(row._id)), { ledgerQty: row.quantity, ledgerValue: row.value });
  for (const row of layers) Object.assign(entry(key(row._id)), { layerQty: row.quantity, layerValue: row.value });
  const differences = [...state]
    .filter(
      ([, s]) =>
        s.balanceQty !== s.ledgerQty ||
        s.balanceQty !== s.layerQty ||
        s.balanceValue !== s.ledgerValue ||
        s.balanceValue !== s.layerValue,
    )
    .map(([key, value]) => ({ key, ...value }));
  return { checkedBalances: state.size, differences, consistent: differences.length === 0 };
}
