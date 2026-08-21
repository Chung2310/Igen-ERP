import { describe, expect, it } from "vitest";
import { KnowledgeChunkModel, KnowledgeDocumentModel } from "./knowledge.model";

describe("knowledge schemas", () => {
  it("requires company isolation fields and a unique document chunk index", () => {
    expect(new KnowledgeDocumentModel({ sourceType: "drive", sourceTitle: "A", contentHash: "hash" }).validateSync()).toBeTruthy();
    expect(new KnowledgeChunkModel({ companyCode: "ACME", chunkIndex: 0, text: "text", embedding: [1] }).validateSync()).toBeTruthy();
    expect(KnowledgeChunkModel.schema.indexes()).toContainEqual([
      { companyCode: 1, documentId: 1, chunkIndex: 1 },
      { unique: true },
    ]);
  });
});
