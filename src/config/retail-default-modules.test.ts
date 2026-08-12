import { describe, expect, it } from "vitest";
import { DEFAULT_MODULE_KEYS, MODULE_KEYS } from "./modules";

describe("retail opt-in defaults", () => {
  it("offers retail but never selects it by default", () => {
    expect(MODULE_KEYS).toContain("retail");
    expect(DEFAULT_MODULE_KEYS).not.toContain("retail");
  });
});
