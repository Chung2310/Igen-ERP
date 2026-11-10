import { describe, expect, it } from "vitest";
import { requireInventoryBranch } from "./crud.service";

describe("inventory branch scope", () => {
  it("requires an authenticated branch for inventory writes", () => {
    expect(() => requireInventoryBranch("products")).toThrow(/chi nhánh/i);
    expect(() => requireInventoryBranch("categories")).toThrow(/chi nhánh/i);
    expect(() => requireInventoryBranch("stock-logs")).toThrow(/chi nhánh/i);
  });

  it("returns the authenticated branch for inventory records", () => {
    expect(requireInventoryBranch("products", "branch-a")).toBe("branch-a");
  });

  it("allows company admins to read or target inventory across branches", () => {
    expect(requireInventoryBranch("categories", undefined, "admin")).toBeUndefined();
    expect(requireInventoryBranch("products", undefined, "superadmin")).toBeUndefined();
    expect(() => requireInventoryBranch("categories", undefined, "user")).toThrow();
  });

  it("does not require a branch for unrelated CRUD models", () => {
    expect(requireInventoryBranch("training-courses")).toBeUndefined();
  });
});
