import { afterEach, describe, expect, it, vi } from "vitest";
import { answerAssistantConversation, isAssistantDocumentRequest } from "./documents";
import { AssistantDocumentModel } from "./models";
import { answerAssistantGeneralQuestion } from "./general-answer";
import { createAssistantVisualIllustration, recommendAssistantVisualCreation } from "./assistant-visual-creation";

vi.mock("./general-answer", async importOriginal => {
  const actual = await importOriginal<typeof import("./general-answer")>();
  return { ...actual, answerAssistantGeneralQuestion: vi.fn() };
});
vi.mock("./assistant-visual-creation", () => ({
  createAssistantVisualIllustration: vi.fn(),
  recommendAssistantVisualCreation: vi.fn(),
}));

afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

function mockEmptyDocumentHistory() {
  const query = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  vi.spyOn(AssistantDocumentModel, "find").mockReturnValue(query as never);
}

const imagePlan = {
  shouldGenerate: true,
  prompt: "A clear infographic showing the handoff between three teams.",
  alt: "Sơ đồ bàn giao giữa ba nhóm",
  aspectRatio: "16:9" as const,
};

describe("assistant document requests", () => {
  it("recognizes edits to an uploaded table as document requests", () => {
    const request = "Sua gia tri sai o cot trang thai";

    expect(isAssistantDocumentRequest(request, false)).toBe(false);
    expect(isAssistantDocumentRequest(request, true)).toBe(true);
  });

  it("adds an inline image only when AI recommends it after reading the answer", async () => {
    mockEmptyDocumentHistory();
    vi.mocked(answerAssistantGeneralQuestion).mockResolvedValue("Nhóm A chuyển hồ sơ cho nhóm B, sau đó nhóm C kiểm tra kết quả.");
    vi.mocked(recommendAssistantVisualCreation).mockResolvedValue(imagePlan);
    const illustration = { alt: imagePlan.alt, url: "https://images.example.com/workflow.webp", generatedByAi: true };
    vi.mocked(createAssistantVisualIllustration).mockResolvedValue(illustration);

    const question = "Giải thích quy trình phối hợp giữa ba nhóm";
    const result = await answerAssistantConversation({ user: { id: "user-1", companyCode: "COMPANY-1" } } as never, {
      conversationId: "conversation-1",
      requestId: "request-1",
      question,
      messages: [],
      documentContext: { title: "Quy trình", version: 1, content: "Nội dung nguồn." },
    });

    expect(recommendAssistantVisualCreation).toHaveBeenCalledWith(expect.objectContaining({
      question,
      answer: "Nhóm A chuyển hồ sơ cho nhóm B, sau đó nhóm C kiểm tra kết quả.",
    }));
    expect(createAssistantVisualIllustration).toHaveBeenCalledWith(imagePlan, undefined);
    expect(result).toMatchObject({ status: "completed", reply: "Nhóm A chuyển hồ sơ cho nhóm B, sau đó nhóm C kiểm tra kết quả.", illustrations: [illustration] });
  });

  it("keeps the text answer when AI decides an image would not help", async () => {
    mockEmptyDocumentHistory();
    vi.mocked(answerAssistantGeneralQuestion).mockResolvedValue("Logo là biểu tượng nhận diện của một thương hiệu.");
    vi.mocked(recommendAssistantVisualCreation).mockResolvedValue({ shouldGenerate: false, prompt: "", alt: "", aspectRatio: "1:1" });

    const result = await answerAssistantConversation({ user: { id: "user-1", companyCode: "COMPANY-1" } } as never, {
      conversationId: "conversation-1",
      requestId: "request-2",
      question: "Cách tạo logo?",
      messages: [],
      documentContext: { title: "Ghi chú", version: 1, content: "Nguồn." },
    });

    expect(result).toMatchObject({ status: "completed", reply: "Logo là biểu tượng nhận diện của một thương hiệu." });
    expect(result.illustrations).toBeUndefined();
    expect(createAssistantVisualIllustration).not.toHaveBeenCalled();
  });
});
