import { createHash } from "node:crypto";
import mongoose from "mongoose";

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    if (typeof (value as any).toHexString === "function") {
      return (value as any).toHexString();
    }
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

