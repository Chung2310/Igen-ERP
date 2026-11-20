import { supplyBusinessDay } from "../../../shared/supply-stock";
import { SupplyInventoryConfigModel } from "../../model/supply-inventory.model";
import { SupplyModel } from "../../model/supply.model";
import { WarehouseModel } from "../../model/warehouse.model";
import {
  SupplyInventoryProfileModel as Profile,
  SupplyLotModel as Lot,
  SupplyWarehouseAccessModel as Access,
  SupplyInventoryAuditModel as Audit,
  SupplyStockLedgerModel as Ledger,
} from "../../model/supply-inventory.model";
import {
  inventoryReadFilter,
  inventoryView,
  requireInventoryPermission,
  type InventoryActor,
} from "./inventory-access";
import { getInventoryDocument } from "./inventory-document.service";
import { readInventoryBalances } from "./inventory-read.service";

export async function inventoryCatalog(actor: InventoryActor, search = "", page = 1) {
  requireInventoryPermission(actor, "supply:read");
  const escaped = search.slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    companyCode: actor.companyCode,
    isActive: { $ne: false },
    ...(escaped
      ? { $or: [{ name: { $regex: escaped, $options: "i" } }, { code: { $regex: escaped, $options: "i" } }] }
      : {}),
  };
  const currentPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const [items, total] = await Promise.all([
    SupplyModel.find(filter)
      .select("name code unit requiresExpiry")
      .sort({ name: 1, _id: 1 })
      .skip((currentPage - 1) * 50)
      .limit(50)
      .lean(),
    SupplyModel.countDocuments(filter),
  ]);
  const profiles = await Profile.find({
    companyCode: actor.companyCode,
    supplyId: { $in: items.map((i) => String(i._id)) },
  }).lean();
  return {
    data: items.map((item) => ({ ...item, profile: profiles.find((p) => p.supplyId === String(item._id)) || null })),
    total,
    page: currentPage,
    totalPages: Math.ceil(total / 50),
  };
}
export async function inventoryWarehouses(actor: InventoryActor) {
  const filter = await inventoryReadFilter(actor);
  const grants = actor.permissions.has("*")
    ? null
    : await Access.find({ companyCode: actor.companyCode, userId: actor.uid }).lean();
  const warehouses = await WarehouseModel.find({
    companyCode: actor.companyCode,
    ...(actor.branchId ? { branchId: { $in: [actor.branchId, "", null] } } : {}),
    ...(filter.warehouseId ? { _id: filter.warehouseId } : {}),
  })
    .select("name code isActive")
    .sort({ name: 1 })
    .lean();
  return warehouses.map((w) => ({
    ...w,
    canWrite: Boolean(w.isActive && (!grants || grants.some((g) => g.warehouseId === String(w._id) && g.canWrite))),
  }));
}
export async function inventoryBalanceView(actor: InventoryActor, page: number, limit: number) {
  const result = await readInventoryBalances(actor, page, limit);
  const ids = result.data.map((row) => row.supplyId);
  const config = await SupplyInventoryConfigModel.findOne({ companyCode: actor.companyCode }).lean();
  const businessDay = supplyBusinessDay(new Date(), config?.timeZone || "Asia/Ho_Chi_Minh");
  const [items, profiles, lots, warehouses] = await Promise.all([
    SupplyModel.find({ companyCode: actor.companyCode, _id: { $in: ids } })
      .select("name code")
      .lean(),
    Profile.find({ companyCode: actor.companyCode, supplyId: { $in: ids } }).lean(),
    Lot.find({ companyCode: actor.companyCode, _id: { $in: result.data.map((row) => row.lotId) } }).lean(),
    inventoryWarehouses(actor),
  ]);
  return {
    ...result,
    businessDay,
    data: result.data.map((row) => ({
      ...row,
      supply: items.find((i) => String(i._id) === row.supplyId),
      profile: profiles.find((p) => p.supplyId === row.supplyId),
      lot: lots.find((l) => String(l._id) === row.lotId),
      warehouseName: warehouses.find((w) => String(w._id) === row.warehouseId)?.name,
    })),
  };
}
export async function inventoryDocumentView(actor: InventoryActor, id: string) {
  const doc = await getInventoryDocument(actor, id); // Scope checked before fetching history.
  const filter = { companyCode: actor.companyCode, branchId: actor.branchId, documentId: id };
  const [history, movements] = await Promise.all([
    Audit.find(filter).sort({ createdAt: 1, _id: 1 }).lean(),
    Ledger.find(filter).sort({ allocationNo: 1 }).lean(),
  ]);
  const lots = await Lot.find({ companyCode: actor.companyCode, _id: { $in: movements.map((m) => m.lotId) } }).lean();
  return inventoryView(actor, {
    ...doc,
    history,
    movements: movements.map((m) => ({
      ...m,
      lotNumber: lots.find((l) => String(l._id) === m.lotId)?.lotNumber || "—",
    })),
  });
}
