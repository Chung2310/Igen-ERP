import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("toast.error Vietnamese normalization wiring", () => {
  it("normalizes only error toast messages", () => {
    const source = readFileSync(new URL("./Toast.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { toVietnameseErrorMessage } from "../utils/vietnameseErrorMessage";');
    expect(source).toContain("detail: { message: toVietnameseErrorMessage(message), type: 'error', duration }");
    expect(source).toContain("detail: { message, type: 'success', duration }");
  });
});
