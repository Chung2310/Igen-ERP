import { describe, expect, it } from "vitest";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

describe("retail subtab permissions", () => {
  it("allows retail managers to use every retail tab", () => {
    expect(getAllowedRetailTabSlugs(["retail:manage"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "khach-hang", "cai-dat",
    ]);
  });

  it("allows managers to access customers and settings", () => {
    expect(getAllowedRetailTabSlugs(["retail:manage"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "khach-hang", "cai-dat",
    ]);
  });

  it("treats wildcard permission as manager access", () => {
    expect(getAllowedRetailTabSlugs(["*"])).toEqual([
      "ban-hang", "don-hang", "ca-ban-hang", "hoa-don", "bao-cao", "khach-hang", "cai-dat",
    ]);
  });
});
