import { createHash } from "node:crypto";
import mongoose from "mongoose";

export function normalizePayrollSnapshotForPersistence(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((item) => normalizePayrollSnapshotForPersistence(item) ?? null);
  }
  if (value instanceof Map) {
    return normalizePayrollSnapshotForPersistence(Object.fromEntries(value.entries()));
  }
  if (value && typeof value === "object") {
    if (typeof (value as any).toHexString === "function") {
      return (value as any).toHexString();
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, normalizePayrollSnapshotForPersistence(item)]),
    );
  }
  return value;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function canonicalizePayrollSnapshot(value: unknown): string {
  return JSON.stringify(sortKeys(normalizePayrollSnapshotForPersistence(value)));
}

export function calculatePayrollChecksum(value: unknown): string {
  return createHash("sha256").update(canonicalizePayrollSnapshot(value)).digest("hex");
}

