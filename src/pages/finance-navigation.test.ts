import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { filterEnabledTabs } from "../config/modules";

describe("Finance navigation registration", () => {
  it("keeps Finance only for tenants that enable it", () => {
    expect(filterEnabledTabs(["TÀI CHÍNH"], [], "general")).toEqual([]);
    expect(filterEnabledTabs(["TÀI CHÍNH"], ["finance"], "general")).toEqual(["TÀI CHÍNH"]);
  });

  it("registers Finance in both Sidebar and Header catalogs", () => {
    const sidebar = fs.readFileSync("src/pages/Sidebar.tsx", "utf8");
    const header = fs.readFileSync("src/pages/Header.tsx", "utf8");
    expect(sidebar).toContain('label: "TÀI CHÍNH"');
    expect(header).toContain('"TÀI CHÍNH": { title: "Tài chính"');
    expect(header).toContain('"TÀI CHÍNH",');
  });
});
