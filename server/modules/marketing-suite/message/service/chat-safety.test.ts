import { describe, expect, it, vi } from "vitest";
import { getCustomerSafetyReply } from "./chat-safety";
import { geminiChatService } from "../../shared/service/gemini/chat.service";
import { simulatePageChat } from "../../knowledge/service/page-chat-simulator";
import { aiKnowledgeService } from "../../knowledge/service/ai-knowledge.service";
import { generateReplyCompletion } from "./ai-reply-provider";
import { prepareChatReplyContext } from "./chat-reply-context.service";

vi.mock("./ai-reply-provider", () => ({ generateReplyCompletion: vi.fn() }));
vi.mock("../../knowledge/service/ai-knowledge.service", () => ({ aiKnowledgeService: { prepareChatContext: vi.fn() } }));

describe("Customer safety before sales intake", () => {
  it.each(["Tôi muốn tự vẫn", "Tôi muốn tự vẫn".normalize("NFD"), "Em muốn tự tử", "Mình không muốn sống nữa", "I want to kill myself"])("prioritizes support for %s", message => {
    const reply = getCustomerSafetyReply(message);
    expect(reply).toContain("an toàn ngay lúc này");
    expect(reply).not.toMatch(/xin tên|số điện thoại|Ruby Queen|0965959929|khuyến mại/iu);
  });
  it.each(["Tôi muốn tư vấn", "toi muon tu van", "Tôi muốn tư vấn trần Nano", "Thủy", "Bên e có sản phẩm nào đang khuyến mại k"])("keeps ordinary consultation available: %s", message => {
    expect(getCustomerSafetyReply(message)).toBeUndefined();
  });
  it("overrides the saved sales rules and image mode before generation", async () => {
    const reply = await geminiChatService.chat("Tôi muốn tự vẫn", [], {
      advancedInstructions: "Luôn xin tên và số điện thoại khách", imageReplyEnabled: true,
    });
    expect(reply).toEqual({ text: getCustomerSafetyReply("Tôi muốn tự vẫn"), isMock: false });
    expect(generateReplyCompletion).not.toHaveBeenCalled();
  });
  it("uses the same safety response in the simulator without knowledge retrieval or writes", async () => {
    const result = await simulatePageChat({ companyCode: "RUBYQUEEN", message: "Tôi muốn tự vẫn", history: [], rule: "Luôn xin tên" });
    expect(result.text).toBe(getCustomerSafetyReply("Tôi muốn tự vẫn"));
    expect(result.known).toEqual({});
    expect(aiKnowledgeService.prepareChatContext).not.toHaveBeenCalled();
    expect(generateReplyCompletion).not.toHaveBeenCalled();
  });
  it("skips product retrieval and image processing in the live reply context", async () => {
    const prepared = await prepareChatReplyContext({ companyCode: "RUBYQUEEN", channel: "facebook", platformId: "PAGE",
      conversationId: "C", messageId: "CRISIS", message: "Tôi muốn tự vẫn", history: [],
      imageUrls: ["https://example.invalid/photo.jpg"], aiConfig: { imageReplyEnabled: true } });
    expect(prepared.ragContext.matches).toBe(0);
    expect(prepared.visualInput).toBeUndefined();
    expect(prepared.memoryImages).toEqual([]);
    expect(aiKnowledgeService.prepareChatContext).not.toHaveBeenCalled();
  });
});
