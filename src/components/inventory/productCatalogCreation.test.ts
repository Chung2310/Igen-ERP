import { describe, expect, it } from "vitest";
import { shouldCreateInitialPrice } from "./productCatalogCreation";

describe("shouldCreateInitialPrice", () => {
  it("does not create a price for a draft product", () => {
    expect(shouldCreateInitialPrice("draft")).toBe(false);
  });

  it("creates a price for an active product", () => {
    expect(shouldCreateInitialPrice("active")).toBe(true);
  });
});
