import { describe, expect, it } from "vitest";
import { canManageCustomFields } from "./permissions";
import { createMaxSizeMb, DYNAMIC_FIELD_TYPES, MODULE_KEYS } from "./types";

describe("custom field frontend contracts", () => {
  it("exposes exactly the six supported module keys", () => {
    expect(MODULE_KEYS).toEqual(["students", "courses", "batches", "exams", "resources", "partners"]);
  });

  it("exposes every backend dynamic field type", () => {
    expect(DYNAMIC_FIELD_TYPES).toEqual([
      "text", "email", "phone", "url", "percent",
      "currency", "dateTime",
      "checkbox", "file", "image",
    ]);
  });

  it("allows only field-management roles", () => {
    expect(canManageCustomFields(["*"])).toBe(true);
    expect(canManageCustomFields(["settings:manage"])).toBe(true);
    expect(canManageCustomFields(["people:manage"])).toBe(false);
    expect(canManageCustomFields(["people:read"])).toBe(false);
    expect(canManageCustomFields([])).toBe(false);
    expect(canManageCustomFields(null)).toBe(false);
    expect(canManageCustomFields()).toBe(false);
  });

  it("only creates canonical file-size limits from 1 through 100 MB", () => {
    expect(createMaxSizeMb(1)).toBe(1);
    expect(createMaxSizeMb(100)).toBe(100);
    expect(() => createMaxSizeMb(0.5)).toThrow(/1.*100/);
    expect(() => createMaxSizeMb(101)).toThrow(/1.*100/);
  });
});
