import { SerialUnitModel } from "../inventory/serials/serial-unit.model";
import { normalizeSerialNumber } from "../inventory/serials/serial-state";

export async function requireSoldSerialForRepair(scope: { companyCode: string }, device: { serialNumber?: string; imei?: string }) {
  const serial = String(device.serialNumber || device.imei || "").trim();
  const unit = await SerialUnitModel.findOne({ companyCode: scope.companyCode, normalizedSerialNumber: normalizeSerialNumber(serial), status: "sold" }).lean();
  if (!unit) throw Object.assign(new Error("IMEI/serial không tồn tại hoặc chưa được bán."), { statusCode: 409, code: "REPAIR_SERIAL_NOT_SOLD" });
  return unit;
}
