import { assertInventoryIndexes } from "./inventory-indexes";
import { SupplyModel } from "../../model/supply.model";
import {
  SupplyInventoryProfileModel,
  SupplyStockDocumentLineModel,
  SupplyInventoryConfigModel,
} from "../../model/supply-inventory.model";
import { runSupplyAtomic } from "./atomic";
import { requireInventoryPermission, type InventoryActor } from "./inventory-access";
import { convertQuantity } from "./quantity";
import { SupplyError } from "./errors";

export interface InventoryProfileInput {
  baseUnit: string;
  precision: number;
  trackingMode: "none" | "lot";
  requiresExpiry: boolean;
  conversions: Array<{ unit: string; factor: string }>;
}
export function validateInventoryProfile(input: InventoryProfileInput) {
  if (
    !input.baseUnit?.trim() ||
    !Number.isInteger(input.precision) ||
    input.precision < 0 ||
    input.precision > 6 ||
    !["none", "lot"].includes(input.trackingMode) ||
    typeof input.requiresExpiry !== "boolean"
  )
    throw new SupplyError("INVALID_PROFILE", "Cấu hình đơn vị hoặc cách theo dõi vật tư không hợp lệ.");
  if (input.trackingMode === "none" && input.requiresExpiry)
    throw new SupplyError("INVALID_PROFILE", "Vật tư có hạn dùng cần theo dõi lô.");
  if (!Array.isArray(input.conversions) || input.conversions.length > 20)
    throw new SupplyError("INVALID_PROFILE", "Tối đa 20 đơn vị quy đổi.");
  const units = new Set([input.baseUnit.trim().toLocaleLowerCase("vi")]);
  for (const conversion of input.conversions) {
    const unit = conversion.unit?.trim().toLocaleLowerCase("vi");
    if (!unit || units.has(unit))
      throw new SupplyError("DUPLICATE_UNIT", "Đơn vị quy đổi không được trùng đơn vị cơ sở hoặc nhau.");
    convertQuantity("1", conversion.factor, 6); // Validate decimal factor; individual issues must fit base precision.
    units.add(unit);
  }
}
export async function saveInventoryProfile(
  actor: InventoryActor,
  supplyId: string,
  input: InventoryProfileInput,
  expectedVersion: number,
) {
  requireInventoryPermission(actor, "supply:catalog-manage");
  validateInventoryProfile(input);
  await assertInventoryIndexes();
  return runSupplyAtomic(async (session) => {
    const config = await SupplyInventoryConfigModel.findOne({ companyCode: actor.companyCode }).session(session);
    if (!config) throw new SupplyError("INVENTORY_NOT_CONFIGURED", "Chưa chuẩn bị cấu hình kho nhiều lô.", 503);
    if (config) {
      if (config.mode === "preparing") throw new SupplyError("INVENTORY_PREPARING", "Đang chuyển dữ liệu kho.", 409);
      config.writeVersion++;
      await config.save({ session });
    }
    const supply = await SupplyModel.findOne({
      _id: supplyId,
      companyCode: actor.companyCode,
      isActive: { $ne: false },
    }).session(session);
    if (!supply) throw new SupplyError("SUPPLY_NOT_FOUND", "Không tìm thấy vật tư.", 404);
    if (supply.unit !== input.baseUnit.trim())
      throw new SupplyError("BASE_UNIT_MISMATCH", "Đơn vị cơ sở phải khớp danh mục đã xác minh.");
    const old = await SupplyInventoryProfileModel.findOne({ companyCode: actor.companyCode, supplyId }).session(
      session,
    );
    if ((old?.version || 0) !== expectedVersion)
      throw new SupplyError("REVISION_CONFLICT", "Cấu hình đã thay đổi, cần tải lại.", 409);
    if (await SupplyStockDocumentLineModel.exists({ companyCode: actor.companyCode, supplyId }).session(session))
      throw new SupplyError(
        "PROFILE_IN_USE",
        "Đã có chứng từ dùng cấu hình này. Không đổi hồi tố đơn vị hoặc quy đổi.",
        409,
      );
    const record = {
      ...input,
      baseUnit: input.baseUnit.trim(),
      conversions: input.conversions.map((c) => ({ unit: c.unit.trim(), factor: c.factor })),
      companyCode: actor.companyCode,
      supplyId,
      version: expectedVersion + 1,
    };
    if (old) {
      old.set(record);
      await old.save({ session });
      return old.toObject();
    }
    const [created] = await SupplyInventoryProfileModel.create([record], { session });
    return created.toObject();
  });
}
