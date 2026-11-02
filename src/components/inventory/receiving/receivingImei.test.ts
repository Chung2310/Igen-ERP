import { describe, it, expect } from "vitest";

function parseImeiPaste(rawText: string) {
  if (!rawText.trim()) return { all: [], unique: [], duplicateCount: 0 };
  const tokens = rawText
    .split(/[\n,;\t]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    const upper = t.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      unique.push(t);
    }
  }
  return {
    all: tokens,
    unique,
    duplicateCount: tokens.length - unique.length,
  };
}

describe("Receiving IMEI Paste Parser", () => {
  it("parses single and multi-line IMEIs cleanly", () => {
    const input = `
      861234567890123
      861234567890124
      861234567890125
    `;
    const res = parseImeiPaste(input);
    expect(res.all).toHaveLength(3);
    expect(res.unique).toHaveLength(3);
    expect(res.unique[0]).toBe("861234567890123");
    expect(res.duplicateCount).toBe(0);
  });

  it("handles commas, semicolons and tabs from Excel copy-paste", () => {
    const input = "861111111111111\t862222222222222, 863333333333333;864444444444444";
    const res = parseImeiPaste(input);
    expect(res.unique).toEqual([
      "861111111111111",
      "862222222222222",
      "863333333333333",
      "864444444444444",
    ]);
  });

  it("detects and filters out duplicate IMEIs case-insensitively", () => {
    const input = `
      IMEI-ABC-123
      imei-abc-123
      IMEI-DEF-456
      IMEI-ABC-123
    `;
    const res = parseImeiPaste(input);
    expect(res.all).toHaveLength(4);
    expect(res.unique).toEqual(["IMEI-ABC-123", "IMEI-DEF-456"]);
    expect(res.duplicateCount).toBe(2);
  });
});
