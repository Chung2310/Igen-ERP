import { SupplyError } from "./errors";
const max = BigInt(Number.MAX_SAFE_INTEGER);
export function safeQuantity(value: bigint): number {
  if (value < 0n || value > max)
    throw new SupplyError("QUANTITY_RANGE", "Số lượng hoặc giá trị vượt phạm vi lưu trữ an toàn.");
  return Number(value);
}
function scaled(value: string, precision: number): bigint {
  if (
    !Number.isInteger(precision) ||
    precision < 0 ||
    precision > 6 ||
    typeof value !== "string" ||
    !/^\d{1,16}(?:\.\d{1,6})?$/.test(value)
  )
    throw new SupplyError("INVALID_DECIMAL", "Số lượng phải là số thập phân không âm, tối đa 6 chữ số lẻ.");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > precision)
    throw new SupplyError("QUANTITY_PRECISION", "Số lượng vượt độ chính xác của đơn vị cơ sở.");
  return BigInt(whole) * 10n ** BigInt(precision) + BigInt(fraction.padEnd(precision, "0") || "0");
}
export function parseQuantity(value: string, precision: number) {
  return safeQuantity(scaled(value, precision));
}
export function convertQuantity(value: string, factor: string, precision: number) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6)
    throw new SupplyError("QUANTITY_PRECISION", "Độ chính xác phải từ 0 đến 6.");
  const multiplier = scaled(factor, 6);
  if (multiplier <= 0n) throw new SupplyError("INVALID_CONVERSION", "Hệ số quy đổi phải lớn hơn 0.");
  const product = scaled(value, 6) * multiplier * 10n ** BigInt(precision);
  const divisor = 10n ** 12n;
  if (product % divisor !== 0n)
    throw new SupplyError("QUANTITY_PRECISION", "Quy đổi tạo số lượng không biểu diễn chính xác bằng đơn vị cơ sở.");
  return safeQuantity(product / divisor);
}
export function checkedAdd(a: number, b: number) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b))
    throw new SupplyError("INVALID_INTEGER", "Số lượng hoặc giá trị phải là số nguyên an toàn.");
  return safeQuantity(BigInt(a) + BigInt(b));
}
export function allocateValue(remainingValue: number, take: number, remainingQty: number) {
  for (const value of [remainingValue, take, remainingQty])
    if (!Number.isSafeInteger(value) || value < 0) throw new SupplyError("INVALID_VALUE", "Lớp giá không hợp lệ.");
  if (take <= 0 || take > remainingQty) throw new SupplyError("INVALID_ALLOCATION", "Số lượng phân bổ không hợp lệ.");
  return safeQuantity((BigInt(remainingValue) * BigInt(take)) / BigInt(remainingQty));
}
