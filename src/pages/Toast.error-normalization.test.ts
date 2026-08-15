import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("toast.error Vietnamese normalization wiring", () => {
  it("normalizes only error toast messages", () => {
    const source = readFileSync(new URL("./Toast.tsx", import.meta.url), "utf8");

    expect(source).toContain('import { getApiErrorMessage } from "../utils/errorMessage";');
    expect(source).toContain("detail: { message: getApiErrorMessage(message, \"Đã xảy ra lỗi. Vui lòng thử lại.\"), type: 'error', duration }");
    expect(source).toContain("detail: { message, type: 'success', duration }");
  });
});
