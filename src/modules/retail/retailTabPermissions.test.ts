import { describe, expect, it } from "vitest";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

describe("retail subtab permissions", () => {
  it("allows retail managers to use every retail tab", () => {
    expect(getAllowedRetailTabSlugs(["retail:manage"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "cai-dat",
    ]);
  });

  it("limits read-only users to read-safe retail tabs", () => {
    expect(getAllowedRetailTabSlugs(["retail:read"])).toEqual([
      "hoa-don", "bao-cao",
    ]);
  });

  it("treats wildcard permission as manager access", () => {
    expect(getAllowedRetailTabSlugs(["*"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "cai-dat",
    ]);
  });
});
