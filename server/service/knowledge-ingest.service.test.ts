import { describe, expect, it } from "vitest";
import { chunkKnowledgeText } from "./knowledge-ingest.service";
describe("knowledge ingestion", () => {
  it("keeps overlap between paragraph chunks", () => {
    const text = `${"a".repeat(800)}\n\n${"b".repeat(800)}`;
    const chunks = chunkKnowledgeText(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("a");
    expect(chunks[1]).toContain("b");
  });
  it("repeats spreadsheet headers in each chunk", () => {
    const chunks = chunkKnowledgeText("Tên,Số ngày\nAn,12\nBình,10", "spreadsheet", 20);
    expect(chunks.every((chunk) => chunk.startsWith("Tên,Số ngày"))).toBe(true);
  });
});
