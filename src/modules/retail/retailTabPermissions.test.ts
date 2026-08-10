import { describe, expect, it } from "vitest";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

describe("retail subtab permissions", () => {
  it("allows operators to manage customers but not settings", () => {
    expect(getAllowedRetailTabSlugs(["retail:operate"])).toEqual(["khach-hang"]);
  });

  it("allows managers to access customers and settings", () => {
    expect(getAllowedRetailTabSlugs(["retail:manager"])).toEqual(["khach-hang", "cai-dat"]);
  });

  it("treats wildcard permission as manager access", () => {
    expect(getAllowedRetailTabSlugs(["*"])).toEqual(["khach-hang", "cai-dat"]);
  });
});
