import { expect, test } from "vitest";
import { RepairPartModel } from "./repair-part.model";

test("repair part schema enforces idempotent issuance", () => {
  expect(RepairPartModel.schema.path("idempotencyKey")).toBeTruthy();
  expect(RepairPartModel.schema.indexes().some(([fields, options]) => fields.companyCode && fields.idempotencyKey && options?.unique)).toBe(true);
});
