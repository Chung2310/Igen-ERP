import type { Schema } from "mongoose";
import { decryptSecret, encryptSecret } from "../../../security/crypto";

function sealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("v1.") && value.split(".").length === 4;
}
export function protectMarketingSecrets(schema: Schema, paths: string[], options: { revealLean?: boolean } = {}) {
  for (const path of paths) {
    const field = schema.path(path);
    if (!field) throw new Error(`Unknown managed secret path: ${path}`);
    field.set((value: unknown) => typeof value === "string" && value && !sealed(value) ? encryptSecret(value) : value);
    field.get((value: unknown) => sealed(value) ? decryptSecret(value) : value);
  }
  function reveal(value: unknown) {
    if (!value || typeof value !== "object" || "$__" in value) return;
    const record = value as Record<string, unknown>;
    for (const path of paths) {
      const parts = path.split(".");
      let owner = record;
      for (const part of parts.slice(0, -1)) {
        const nested = owner[part];
        if (!nested || typeof nested !== "object") { owner = {}; break; }
        owner = nested as Record<string, unknown>;
      }
      const key = parts[parts.length - 1];
      if (sealed(owner[key])) owner[key] = decryptSecret(owner[key] as string);
    }
  }
  if (options.revealLean === false) return;
  schema.post("find", function (rows: unknown[]) { for (const row of rows || []) reveal(row); });
  schema.post("findOne", function (row: unknown) { reveal(row); });
  schema.post("findOneAndUpdate", function (row: unknown) { reveal(row); });
}
