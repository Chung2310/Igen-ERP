import { describe, expect, it } from "vitest";
import { pathToTab, tabToPath } from "./seo-config";

describe("Legal Reference navigation path", () => {
  it("round-trips the module tab through its URL", () => {
    expect(tabToPath("VĂN BẢN PHÁP LUẬT")).toBe("/van-ban-phap-luat");
    expect(pathToTab("/van-ban-phap-luat")).toBe("VĂN BẢN PHÁP LUẬT");
  });
});
