import { UnitBarcodeCounterModel } from "./unit-barcode-counter.model";
import { SerialUnitModel } from "./serial-unit.model";

const COUNTER_ID = "global-unit-barcode-v1";
const PREFIX = "DVU";

export async function ensureInternalBarcodeCounterAtLeast(sequence: number) {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("Mốc bộ đếm barcode không hợp lệ.");
  await UnitBarcodeCounterModel.updateOne(
    { _id: COUNTER_ID },
    { $max: { sequence } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

async function reserveInternalBarcodeRange(count: number): Promise<string[]> {
  let counter: { sequence?: number } | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      counter = await UnitBarcodeCounterModel.findOneAndUpdate(
        { _id: COUNTER_ID },
        { $inc: { sequence: count } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ).lean();
      break;
    } catch (error: unknown) {
      const isDuplicateKey = typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (!isDuplicateKey || attempt === 3) throw error;
    }
  }

  const last = Number(counter?.sequence);
  const first = last - count + 1;
  if (!Number.isSafeInteger(first) || first < 1 || !Number.isSafeInteger(last)) {
    throw Object.assign(new Error("Bộ đếm barcode đã vượt giới hạn an toàn."), { statusCode: 503 });
  }

  return Array.from({ length: count }, (_, index) => `${PREFIX}${String(first + index).padStart(12, "0")}`);
}

export async function allocateInternalBarcodes(count: number): Promise<string[]> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 5000) {
    throw Object.assign(new Error("Số lượng mã barcode cần cấp không hợp lệ."), { statusCode: 400 });
  }

  const allocated: string[] = [];
  let reservationSize = count;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidates = await reserveInternalBarcodeRange(reservationSize);
    const occupiedRows = await SerialUnitModel.find({
      $or: [
        { normalizedInternalBarcode: { $in: candidates } },
        { normalizedBarcodeAliases: { $in: candidates } },
        { normalizedSerialNumber: { $in: candidates } },
        { normalizedImeis: { $in: candidates } },
      ],
    }).select("normalizedInternalBarcode normalizedBarcodeAliases normalizedSerialNumber normalizedImeis").lean();
    const occupied = new Set(occupiedRows.flatMap((unit) => [
      unit.normalizedInternalBarcode,
      ...(unit.normalizedBarcodeAliases || []),
      unit.normalizedSerialNumber,
      ...(unit.normalizedImeis || []),
    ].filter((value): value is string => Boolean(value))));
    const available = candidates.filter((barcode) => !occupied.has(barcode));
    allocated.push(...available.slice(0, count - allocated.length));
    if (allocated.length === count) return allocated;
    const collisions = candidates.length - available.length;
    reservationSize = Math.max(count - allocated.length + collisions, count - allocated.length + 1);
  }
  throw Object.assign(new Error("Không thể cấp barcode chưa sử dụng sau nhiều lần thử."), { statusCode: 503 });
}
