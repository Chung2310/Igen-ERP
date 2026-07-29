import { describe, expect, it } from "vitest";
import { canChangeEntityPreset, ENTITY_PRESET_OPTIONS } from "./entityLabels";

describe("entity preset options", () => {
  it("offers recruitment workers and no longer offers recruitment candidates", () => {
    expect(ENTITY_PRESET_OPTIONS).toContainEqual({
      value: "worker",
      label: "Tuyển dụng — Lao động",
    });
    expect(ENTITY_PRESET_OPTIONS.some((option) => option.value === "candidate")).toBe(false);
  });

  it("allows only company admin to change the entity preset", () => {
    expect(canChangeEntityPreset("superadmin")).toBe(false);
    expect(canChangeEntityPreset("admin")).toBe(true);
    expect(canChangeEntityPreset("manager")).toBe(false);
    expect(canChangeEntityPreset("user")).toBe(false);
  });
});
