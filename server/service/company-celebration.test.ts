import { describe, expect, it } from "vitest";
import { isCompanySendTime, renderCelebrationTemplate } from "./company-celebration";

describe("renderCelebrationTemplate", () => {
  it("renders supported variables and escapes employee data", () => {
    expect(renderCelebrationTemplate("Chao {{employeeName}} - {{companyName}}", {
      employeeName: "<Admin>", companyName: "iGen", holidayName: "",
    })).toBe("Chao &lt;Admin&gt; - iGen");
  });

  it("rejects unsupported variables", () => {
    expect(() => renderCelebrationTemplate("{{password}}", {
      employeeName: "A", companyName: "iGen", holidayName: "",
    })).toThrow("Bien mau khong duoc ho tro");
  });
});

describe("isCompanySendTime", () => {
  it("uses Vietnam local time", () => {
    expect(isCompanySendTime(new Date("2026-07-28T01:00:30.000Z"), "08:00")).toBe(true);
    expect(isCompanySendTime(new Date("2026-07-28T00:59:30.000Z"), "08:00")).toBe(false);
  });
});
