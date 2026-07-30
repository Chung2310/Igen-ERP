import { describe, expect, it } from "vitest";
import {
  canChangeEntityPreset,
  ENTITY_LABEL_PRESETS,
  ENTITY_PRESET_OPTIONS,
  getEntityPresetOptions,
} from "./entityLabels";

describe("entity preset options", () => {
  it("offers recruitment workers and no longer offers recruitment candidates", () => {
    expect(ENTITY_PRESET_OPTIONS).toContainEqual(
      expect.objectContaining({ value: "worker", label: "Tuyển dụng — Lao động" }),
    );
    expect(ENTITY_PRESET_OPTIONS.some((option) => option.value === "candidate")).toBe(false);
  });

  it("labels every option from the same source the module renders", () => {
    for (const option of ENTITY_PRESET_OPTIONS) {
      expect(option.entityLabel).toBe(ENTITY_LABEL_PRESETS[option.value].tabLabel);
      expect(option.label).toBe(`${option.sector} — ${option.entityLabel}`);
    }
  });

  it("still shows a legacy preset when the tenant is on it", () => {
    const options = getEntityPresetOptions("candidate");
    expect(options).toHaveLength(ENTITY_PRESET_OPTIONS.length + 1);
    expect(options[0]).toMatchObject({
      value: "candidate",
      entityLabel: ENTITY_LABEL_PRESETS.candidate.tabLabel,
      legacy: true,
    });
  });

  it("keeps the selectable list untouched for a supported preset", () => {
    expect(getEntityPresetOptions("worker")).toBe(ENTITY_PRESET_OPTIONS);
    expect(getEntityPresetOptions(null)).toBe(ENTITY_PRESET_OPTIONS);
  });

  it("allows only superadmin to change the entity preset", () => {
    expect(canChangeEntityPreset("superadmin")).toBe(true);
    expect(canChangeEntityPreset("admin")).toBe(false);
    expect(canChangeEntityPreset("manager")).toBe(false);
    expect(canChangeEntityPreset("user")).toBe(false);
  });
});
