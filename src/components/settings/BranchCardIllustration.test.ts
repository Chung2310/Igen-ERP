import { describe, expect, it } from "vitest";
import { getBranchIllustrationKind } from "./BranchCardIllustration";

describe("getBranchIllustrationKind", () => {
  it.each([
    [["hr", "student"], "student"],
    [["hr", "retail"], "retail"],
    [["hr", "worker"], "worker"],
    [["student", "retail"], "general"],
    [["student", "worker", "retail"], "general"],
    [["hr"], "general"],
    [[], "general"],
    [undefined, "general"],
  ] as const)("resolves %j to %s", (modules, expected) => {
    expect(getBranchIllustrationKind(modules)).toBe(expected);
  });
});
