import { describe, expect, it } from "vitest";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

describe("retail subtab permissions", () => {
  it("allows operators to run every operational tab but not settings", () => {
    expect(getAllowedRetailTabSlugs(["retail:operate"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "khach-hang",
    ]);
  });

  it("allows managers to access customers and settings", () => {
    expect(getAllowedRetailTabSlugs(["retail:manager"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "khach-hang", "cai-dat",
    ]);
  });

  it("treats wildcard permission as manager access", () => {
    expect(getAllowedRetailTabSlugs(["*"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "khach-hang", "cai-dat",
    ]);
  });
});
