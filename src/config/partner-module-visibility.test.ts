import { describe, expect, it } from "vitest";
import type { TabType } from "../types";
import { filterEnabledTabs, resolveEnabledTab } from "./modules";

const partnerTabs: TabType[] = ["ĐỐI TÁC", "ĐỐI TÁC LAO ĐỘNG"];

describe("partner module visibility", () => {
  it.each([
    { modules: ["partner", "student"], visible: ["ĐỐI TÁC"] },
    { modules: ["partner", "worker"], visible: ["ĐỐI TÁC LAO ĐỘNG"] },
    { modules: ["partner"], visible: [] },
    { modules: ["student", "worker"], visible: [] },
    { modules: ["partner", "student", "worker"], visible: partnerTabs },
    { modules: undefined, visible: partnerTabs },
    { modules: [], visible: partnerTabs },
  ])("keeps menu and navigation consistent for $modules", ({ modules, visible }) => {
    expect(filterEnabledTabs(partnerTabs, modules)).toEqual(visible);
    for (const tab of partnerTabs) {
      expect(resolveEnabledTab(tab, modules)).toBe(visible.includes(tab) ? tab : "TỔNG QUAN");
    }
  });
});
