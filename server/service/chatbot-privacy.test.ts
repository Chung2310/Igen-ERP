import { describe, expect, it, vi } from "vitest";
vi.mock("./openrouter.service", () => ({ openrouterChat: vi.fn() }));
vi.mock("./knowledge-search.service", () => ({ knowledgeSearchService: { search: vi.fn().mockResolvedValue([{ title: "Quy định", text: "Nghỉ phép 12 ngày", url: "https://drive.test/a" }] ) }, formatKnowledgeCitations: (hits: any[]) => hits[0].text }));
import { openrouterChat } from "./openrouter.service";
import { ChatbotService } from "./chatbot.service";
describe("chatbot strict privacy", () => {
  it("never calls OpenRouter in strict mode", async () => {
    const previous = process.env.AI_PRIVACY_MODE; process.env.AI_PRIVACY_MODE = "strict";
    await expect(ChatbotService.getResponse({ id: "u", email: "u@test", role: "user", companyCode: "ACME" }, [{ role: "user", content: "nghỉ phép" }])).resolves.toContain("Nghỉ phép");
    expect(openrouterChat).not.toHaveBeenCalled(); process.env.AI_PRIVACY_MODE = previous;
  });
});
