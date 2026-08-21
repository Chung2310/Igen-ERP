import { describe, expect, it, vi } from "vitest";

vi.mock("../model/knowledge.model", () => ({ KnowledgeChunkModel: { find: vi.fn() } }));
import { KnowledgeChunkModel } from "../model/knowledge.model";
import { knowledgeSearchService } from "./knowledge-search.service";

describe("knowledge search", () => {
  it("filters by company and ACL in Mongo before ranking", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ limit });
    (KnowledgeChunkModel.find as any).mockReturnValue({ sort });
    await knowledgeSearchService.search({ companyCode: "ACME", user: { id: "u1", role: "manager" }, query: "nghỉ phép", topK: 5 });
    expect(KnowledgeChunkModel.find).toHaveBeenCalledWith(expect.objectContaining({
      companyCode: "ACME",
      $or: [{ visibility: "company" }, { allowedUserIds: "u1" }, { allowedRoles: "manager" }],
    }));
  });
});
