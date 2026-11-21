import type { Db } from "mongodb";
import type { Supply } from "../../../../shared/healthcare-logistics";
import { atomic, collection, conflict, find, replace, scope, type Actor } from "./store";
import { ValidationError } from "../../../errors/app-error";
export type Profile = {
  precision: number;
  trackingMode: "none" | "lot";
  requiresExpiry: boolean;
  conversions: { unit: string; factor: string }[];
};
function decimal(value: string) {
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(value))
    throw new ValidationError("VALIDATION_FAILED", "Số quy đổi phải là số dương, tối đa 6 chữ số thập phân.");
  const [whole, frac = ""] = value.split(".");
  return { value: BigInt(whole + frac), scale: 10n ** BigInt(frac.length) };
}
export function convertedQuantity(quantity: number, factor: string, precision: number) {
  const q = decimal(String(quantity)),
    f = decimal(factor);
  if (q.value <= 0n || f.value <= 0n)
    throw new ValidationError("VALIDATION_FAILED", "Số lượng và hệ số phải lớn hơn 0.");
  const numerator = q.value * f.value * 10n ** BigInt(precision),
    denominator = q.scale * f.scale;
  if (numerator % denominator)
    throw new ValidationError("VALIDATION_FAILED", "Quy đổi vượt số chữ số thập phân của đơn vị cơ sở.");
  const scaled = numerator / denominator;
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER))
    throw new ValidationError("VALIDATION_FAILED", "Số lượng quy đổi vượt giới hạn.");
  return Number(scaled) / 10 ** precision;
}
export function baseQuantity(supply: Supply, quantity: number, unit?: string) {
  const factor = !unit || unit === supply.unit ? "1" : supply.conversions?.find((row) => row.unit === unit)?.factor;
  if (!factor) throw new ValidationError("VALIDATION_FAILED", "Đơn vị không thuộc cấu hình quy đổi của vật tư.");
  return convertedQuantity(quantity, factor, supply.precision ?? 3);
}
export async function saveProfile(db: Db, actor: Actor, id: string, revision: number, profile: Profile) {
  return atomic(async (session) => {
    const supply = await find(db, "supplies", actor, id, session);
    if (!supply.active) conflict("Vật tư đã ngừng sử dụng.");
    if (profile.trackingMode === "none" && profile.requiresExpiry) conflict("Vật tư có hạn dùng phải theo dõi lô.");
    const units = new Set([supply.unit.toLocaleLowerCase("vi")]);
    for (const row of profile.conversions) {
      const name = row.unit.toLocaleLowerCase("vi");
      if (units.has(name)) conflict("Đơn vị quy đổi không được trùng nhau hoặc trùng đơn vị cơ sở.");
      units.add(name);
      convertedQuantity(1, row.factor, profile.precision);
    }
    if (await collection(db, "supply_documents").findOne({ ...scope(actor), "lines.supplyId": id }, { session }))
      conflict("Vật tư đã có chứng từ, không thể đổi cấu hình quy đổi hồi tố.");
    return replace(db, "supplies", actor, { ...supply, ...profile }, revision, session);
  });
}
