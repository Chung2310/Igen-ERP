import type { ClientSession } from "mongoose";
import { WarehouseModel } from "../../model/warehouse.model";
import { SupplyInventoryConfigModel, SupplyWarehouseAccessModel } from "../../model/supply-inventory.model";
import { SupplyError } from "./errors";

export interface InventoryActor {
  companyCode: string;
  branchId: string;
  uid: string;
  name?: string;
  permissions: ReadonlySet<string>;
}
export function requireInventoryPermission(actor: InventoryActor, permission: string) {
  if (!actor.companyCode || !actor.branchId || !actor.uid)
    throw new SupplyError("INVENTORY_SCOPE_REQUIRED", "Cần chọn công ty và chi nhánh để thao tác kho.", 403);
  if (!actor.permissions.has("*") && !actor.permissions.has(permission))
    throw new SupplyError("INVENTORY_FORBIDDEN", "Không có quyền thực hiện nghiệp vụ kho này.", 403);
}
export async function assertInventoryWarehouse(
  actor: InventoryActor,
  warehouseId: string,
  write: boolean,
  session?: ClientSession,
) {
  const branchCondition = actor.branchId ? { branchId: { $in: [actor.branchId, "", null] } } : {};
  const filter = {
    _id: warehouseId,
    companyCode: actor.companyCode,
    ...branchCondition,
    ...(write ? { isActive: true } : {}),
  };
  const warehouse =
    write && session
      ? await WarehouseModel.findOneAndUpdate(filter, { $inc: { __v: 1 } }, { session, returnDocument: "after" }).lean()
      : await WarehouseModel.findOne(filter)
          .session(session || null)
          .lean();
  if (!warehouse)
    throw new SupplyError("WAREHOUSE_SCOPE", "Kho không thuộc chi nhánh được chọn hoặc không còn hoạt động.", 403);
  if (
    !actor.permissions.has("*") &&
    !actor.permissions.has("supply:manage") &&
    !actor.permissions.has("warehouse:manage")
  ) {
    const grant = await SupplyWarehouseAccessModel.findOne({
      companyCode: actor.companyCode,
      userId: actor.uid,
      warehouseId,
      ...(write ? { canWrite: true } : {}),
    })
      .session(session || null)
      .lean();
    if (!grant) throw new SupplyError("WAREHOUSE_SCOPE", "Chưa được phân công truy cập kho này.", 403);
  }
  return warehouse;
}
export interface InventoryReadFilter {
  companyCode: string;
  branchId?: string | { $in: (string | null)[] };
  warehouseId?: { $in: string[] };
}

export async function inventoryReadFilter(actor: InventoryActor): Promise<InventoryReadFilter> {
  requireInventoryPermission(actor, "supply:read");
  const branchCondition = actor.branchId ? { branchId: { $in: [actor.branchId, "", null] } } : {};
  if (
    actor.permissions.has("*") ||
    actor.permissions.has("supply:manage") ||
    actor.permissions.has("warehouse:manage")
  ) {
    return { companyCode: actor.companyCode, ...branchCondition };
  }
  const grants = await SupplyWarehouseAccessModel.find({ companyCode: actor.companyCode, userId: actor.uid }).lean();
  return {
    companyCode: actor.companyCode,
    ...branchCondition,
    warehouseId: { $in: grants.map((g) => g.warehouseId) },
  };
}
/** Serializes company inventory writes, including mode switches and future quality/period operations. */
export async function lockInventory(actor: InventoryActor, session: ClientSession) {
  const config = await SupplyInventoryConfigModel.findOneAndUpdate(
    { companyCode: actor.companyCode, mode: "v2" },
    { $inc: { writeVersion: 1 } },
    { session, returnDocument: "after", runValidators: true },
  );
  if (!config)
    throw new SupplyError("INVENTORY_NOT_ACTIVE", "Kho nhiều lô chưa được chuyển dữ liệu và kích hoạt.", 409);
  return config;
}
export async function assertLegacyInventoryMode(companyCode: string, session: ClientSession | null) {
  const config = await SupplyInventoryConfigModel.findOne({ companyCode }).session(session);
  if (!config) return; // Migration creates the mode record while all legacy writers are drained.
  if (config.mode !== "legacy")
    throw new SupplyError(
      "LEGACY_INVENTORY_DISABLED",
      "Công ty đang chuyển dữ liệu hoặc đã dùng kho nhiều lô. Không ghi vào số tồn cũ.",
      409,
    );
  if (!session) return; // Catalog-only creation does not change stock.
  config.writeVersion++;
  await config.save({ session });
}
const costKeys = new Set([
  "valueMinor",
  "totalValueMinor",
  "remainingValue",
  "deltaValue",
  "valueBefore",
  "valueAfter",
]);
export function inventoryView<T>(actor: InventoryActor, value: T): T {
  if (actor.permissions.has("*") || actor.permissions.has("supply:cost-read")) return value;
  const hide = (node: any): any => {
    if (node instanceof Date || node?.toHexString) return node;
    if (Array.isArray(node)) return node.map(hide);
    if (node && typeof node === "object")
      return Object.fromEntries(
        Object.entries(node)
          .filter(([key]) => !costKeys.has(key))
          .map(([key, child]) => [key, hide(child)]),
      );
    return node;
  };
  return hide(value);
}
