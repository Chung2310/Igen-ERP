import { describe, expect, it } from "vitest";
import { cosineSimilarity, embeddingProvider } from "./knowledge-embedding";

describe("knowledge embedding", () => {
  it("is deterministic and unit-normalized", () => {
    const first = embeddingProvider.embed("Nghỉ phép năm");
    const second = embeddingProvider.embed("Nghỉ phép năm");
    expect(first).toEqual(second);
    expect(first).toHaveLength(512);
    expect(Math.hypot(...first)).toBeCloseTo(1, 8);
  });

  it("scores unrelated text below identical text", () => {
    const leave = embeddingProvider.embed("Quy định nghỉ phép năm");
    expect(cosineSimilarity(leave, leave)).toBeCloseTo(1, 8);
    expect(cosineSimilarity(leave, embeddingProvider.embed("Báo cáo tồn kho sản phẩm"))).toBeLessThan(0.8);
  });
});
