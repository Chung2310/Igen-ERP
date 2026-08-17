import type { SerialUnitStatus } from "./serial-unit.interface";

const allowed: Record<SerialUnitStatus, SerialUnitStatus[]> = {
  in_stock: ["sold"],
  sold: ["returned", "in_stock"],
  returned: ["in_stock", "defective"],
  defective: ["repairing", "scrapped"],
  repairing: ["defective", "in_stock"],
  scrapped: [],
};

export function normalizeSerialNumber(value: string): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) throw new Error("Serial number is required");
  return normalized;
}

export function assertSerialTransition(from: SerialUnitStatus, to: SerialUnitStatus): void {
  if (!allowed[from]?.includes(to)) throw new Error(`Invalid serial transition: ${from} -> ${to}`);
}
