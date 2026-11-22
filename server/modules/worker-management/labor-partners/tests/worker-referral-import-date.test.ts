import { describe, expect, it } from "vitest";
import { importDateToIso } from "../services/worker-referral.service";

describe("labor partner referral import dates", () => {
  it("normalizes Vietnamese and ISO dates", () => {
    expect(importDateToIso("4/3/2026")).toBe("2026-03-04");
    expect(importDateToIso("2026-03-04")).toBe("2026-03-04");
  });

  it("rejects unrecognized non-empty dates instead of replacing them with today", () => {
    expect(() => importDateToIso("not-a-date")).toThrow(/DD\/MM\/YYYY/);
  });
});
