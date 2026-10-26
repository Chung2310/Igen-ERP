import { describe, expect, it } from "vitest";
import { getAllowedRetailTabSlugs } from "./retailTabPermissions";

describe("retail subtab permissions", () => {
  it("allows retail managers to use every retail tab", () => {
    expect(getAllowedRetailTabSlugs(["retail:manage"])).toEqual([
      "ban-hang", "don-hang", "doi-tra", "hoa-don", "bao-cao", "ca-pos", "bao-hanh", "ma-uu-dai", "tai-chinh", "cai-dat",
    ]);
  });

  it("limits read-only users to read-safe retail tabs", () => {
    expect(getAllowedRetailTabSlugs(["retail:read"])).toEqual([
      "bao-hanh", "doi-tra", "hoa-don", "bao-cao",
    ]);
  });

  it("treats wildcard permission as manager access", () => {
    expect(getAllowedRetailTabSlugs(["*"])).toEqual([
      "ban-hang", "don-hang", "doi-tra", "hoa-don", "bao-cao", "ca-pos", "bao-hanh", "ma-uu-dai", "tai-chinh", "uu-dai", "cai-dat",
    ]);
  });

  it("keeps POS-only cashiers out of the ERP retail administration tabs", () => {
    expect(getAllowedRetailTabSlugs(["pos:manage"])).toEqual([]);
  });
});
