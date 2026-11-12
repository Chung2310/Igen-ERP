import { describe, expect, it } from "vitest";
import { isAssistantDocumentRequest } from "./documents";

describe("assistant document requests", () => {
  it("recognizes edits to an uploaded table as document requests", () => {
    const request = "Sua gia tri sai o cot trang thai";

    expect(isAssistantDocumentRequest(request, false)).toBe(false);
    expect(isAssistantDocumentRequest(request, true)).toBe(true);
  });
});
