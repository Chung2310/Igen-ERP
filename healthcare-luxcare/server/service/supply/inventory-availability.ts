import { supplyBusinessDay } from "../../../shared/supply-stock";
import {
  SupplyInventoryConfigModel as Config,
  SupplyInventoryProfileModel as Profile,
  SupplyLotModel as Lot,
  SupplyStockBalanceModel as Balance,
} from "../../model/supply-inventory.model";

/** Live availability; a material's last received expiry cannot describe all its lots. */
export async function withInventoryAvailability<T extends { _id: unknown; branchId?: string; warehouseId?: string }>(
  companyCode: string,
  items: T[],
): Promise<(T & { availableQuantity?: number })[]> {
  if (!items.length) return items;
  const config = await Config.findOne({ companyCode }).lean();
  if (config?.mode !== "v2") return items;
  const ids = items.map((item) => String(item._id));
  const [profiles, lots, balances] = await Promise.all([
    Profile.find({ companyCode, supplyId: { $in: ids } }).lean(),
    Lot.find({ companyCode, supplyId: { $in: ids }, recalled: false }).lean(),
    Balance.find({ companyCode, supplyId: { $in: ids }, quality: "available", quantityScaled: { $gt: 0 } }).lean(),
  ]);
  const day = supplyBusinessDay(new Date(), config.timeZone);
  const profileMap = new Map(profiles.map((p) => [p.supplyId, p]));
  const lotMap = new Map(lots.map((l) => [String(l._id), l]));
  return items.map((item) => {
    const profile = profileMap.get(String(item._id));
    let quantity = 0;
    if (profile)
      for (const balance of balances) {
        if (
          balance.supplyId !== String(item._id) ||
          balance.branchId !== item.branchId ||
          balance.warehouseId !== item.warehouseId
        )
          continue;
        const lot = lotMap.get(balance.lotId);
        if (!lot) continue;
        if (
          profile.requiresExpiry &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(lot.expiryDay) ||
            lot.expiryDay < day ||
            !Number.isFinite(Date.parse(lot.expiryDay)) ||
            new Date(lot.expiryDay).toISOString().slice(0, 10) !== lot.expiryDay)
        )
          continue;
        quantity += balance.quantityScaled;
      }
    return { ...item, availableQuantity: profile ? quantity / 10 ** profile.precision : 0 };
  });
}
