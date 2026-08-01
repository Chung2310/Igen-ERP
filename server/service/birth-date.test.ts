import { describe, expect, it } from "vitest";
import { normalizeBirthDate } from "./birth-date";

describe("normalizeBirthDate", () => {
  it("stores a calendar birth date at UTC midnight", () => {
    expect(normalizeBirthDate("1992-07-28")?.toISOString()).toBe("1992-07-28T00:00:00.000Z");
  });

  it("allows clearing an optional birth date", () => {
    expect(normalizeBirthDate("")).toBeNull();
    expect(normalizeBirthDate(null)).toBeNull();
  });

  it("rejects impossible and non-calendar dates", () => {
    expect(() => normalizeBirthDate("1992-02-31")).toThrow("Ngay sinh khong hop le");
    expect(() => normalizeBirthDate("28/07/1992")).toThrow("Ngay sinh khong hop le");
  });
});
