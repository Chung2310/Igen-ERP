import { expect, it } from "vitest";
import { quoteCreatedRange } from "./created-range";
it("keeps the last Vietnamese day and excludes adjacent months", () => {
  const range = quoteCreatedRange("2026-11-01", "2026-11-30")!;
  expect(range.$gte.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  expect(range.$lt.toISOString()).toBe("2026-11-30T17:00:00.000Z");
});
it.each([["2026-02-30", "2026-03-01"], ["2026-12-01", "2026-11-01"], ["2026-11-01", undefined], [undefined, "2026-11-30"], ["", ""]])("rejects invalid or incomplete range %s %s", (from, to) => {
  expect(() => quoteCreatedRange(from, to)).toThrow();
});
it("preserves unfiltered API calls and accepts leap days", () => {
  expect(quoteCreatedRange(undefined, undefined)).toBeUndefined();
  expect(quoteCreatedRange("2028-02-29", "2028-02-29")!.$lt.toISOString()).toBe("2028-02-29T17:00:00.000Z");
});
