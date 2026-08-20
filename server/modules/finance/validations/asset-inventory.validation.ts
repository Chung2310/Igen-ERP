import { ValidationError } from "../../../errors/app-error";
import { ASSET_INVENTORY_RESULTS } from "../interfaces/asset.interface";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
/** Results a counter may report; "pending" is the opening state and "missing" is derived at finalization. */
const COUNTABLE_RESULTS = ASSET_INVENTORY_RESULTS.filter((result) => result !== "pending" && result !== "missing");

function text(value: unknown, code: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new ValidationError("VALIDATION_FAILED", code);
  return result;
}

function isoDate(value: unknown, code: string) {
  const raw = String(value ?? "");
  if (!ISO_DATE.test(raw)) throw new ValidationError("VALIDATION_FAILED", code);
  const date = new Date(raw);
  const normalized = raw.includes(".") ? raw : raw.replace("Z", ".000Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== normalized) throw new ValidationError("VALIDATION_FAILED", code);
  return date;
}

export function validateInventoryOpening(input: any) {
  const scope = String(input?.scope ?? "branch");
  if (scope !== "company" && scope !== "branch") throw new ValidationError("VALIDATION_FAILED", "INVALID_INVENTORY_SCOPE");
  const branchIds = Array.isArray(input?.branchIds) ? input.branchIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean) : [];
  if (scope === "branch" && !branchIds.length) throw new ValidationError("VALIDATION_FAILED", "BRANCH_REQUIRED");
  return {
    sessionCode: text(input?.sessionCode, "SESSION_CODE_REQUIRED"),
    name: text(input?.name, "SESSION_NAME_REQUIRED"),
    scope,
    branchIds: [...new Set<string>(branchIds)],
    inventoryDate: isoDate(input?.inventoryDate, "INVALID_DATE"),
  };
}

export function validateInventoryCount(input: any) {
  const result = String(input?.result ?? "");
  if (!(COUNTABLE_RESULTS as readonly string[]).includes(result)) throw new ValidationError("VALIDATION_FAILED", "INVALID_INVENTORY_RESULT");
  const note = String(input?.note ?? "").trim();
  return { barcode: text(input?.barcode, "BARCODE_REQUIRED"), result, ...(note ? { note } : {}) };
}
