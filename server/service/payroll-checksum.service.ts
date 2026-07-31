import { createHash } from "node:crypto";

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, normalize((value as Record<string, unknown>)[key])]));
  }
  return value;
}

export function canonicalizePayrollSnapshot(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function calculatePayrollChecksum(value: unknown): string {
  return createHash("sha256").update(canonicalizePayrollSnapshot(value)).digest("hex");
}
