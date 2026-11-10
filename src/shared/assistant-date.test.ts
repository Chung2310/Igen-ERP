import { describe, expect, it } from "vitest";
import { formatAssistantTemporalValue } from "./assistant-date";

describe("assistant calendar display", () => {
  it.each([
    ["2026-11-11T07:00:00+07:00", "07:00, 11/11/2026"],
    ["2026-11-11T00:00:00.000Z", "07:00, 11/11/2026"],
    ["2026-11-10T23:30:00Z", "06:30, 11/11/2026"],
    ["2026-11-11T00:30:00+07:00", "00:30, 11/11/2026"],
    ["2026-11-10T23:30:00-04:00", "10:30, 11/11/2026"],
    ["2026-11-11T07:00", "07:00, 11/11/2026"],
    ["2026-11-11", "11/11/2026"],
    ["2024-02-29", "29/02/2024"],
  ])("formats %s without losing the calendar day or time", (value, expected) => {
    expect(formatAssistantTemporalValue(value)).toBe(expected);
  });

  it.each(["2026-02-29", "2026-02-30T07:00:00+07:00", "2026-11-11T24:00:00+07:00", "2026-11-11T07:60:00Z", "2026-11-11T07:00:00+25:00", "Nguyễn An", "Khám ngày 2026-11-11", "https://example.test/2026-11-11"])("keeps non-calendar text and invalid values untouched: %s", value => {
    expect(formatAssistantTemporalValue(value)).toBeUndefined();
  });
});
