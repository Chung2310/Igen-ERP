import { afterEach, describe, expect, it, vi } from "vitest";
import { answerAssistantConversation, isAssistantDocumentRequest } from "./documents";
import { AssistantDocumentModel } from "./models";
import { answerAssistantGeneralQuestion } from "./general-answer";
import { createAssistantVisualIllustration, createAssistantVisualIllustrations, recommendAssistantVisualCreation } from "./assistant-visual-creation";
import { enhanceStudioImagePrompt } from "./studio-images";

vi.mock("./general-answer", async importOriginal => {
  const actual = await importOriginal<typeof import("./general-answer")>();
  return { ...actual, answerAssistantGeneralQuestion: vi.fn() };
});
vi.mock("./assistant-visual-creation", () => ({
  createAssistantVisualIllustration: vi.fn(),
  createAssistantVisualIllustrations: vi.fn(),
  recommendAssistantVisualCreation: vi.fn(),
}));
vi.mock("./studio-images", () => ({ enhanceStudioImagePrompt: vi.fn() }));

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

  it("generates an image directly in the conversation when the user explicitly asks for one", async () => {
    mockEmptyDocumentHistory();
    const question = "Hãy tạo hình ảnh một chú mèo đang ngồi bên cửa sổ, khung 16:9";
    const conversation = [
      { role: "user" as const, content: "Tôi muốn làm poster giới thiệu quán cà phê tên Mộc." },
      { role: "assistant" as const, content: "Bạn muốn phong cách nào?" },
    ];
    const interpretedPrompt = "Poster giới thiệu quán cà phê Mộc, mèo ngồi bên cửa sổ, ánh sáng buổi sáng, khung ngang rộng.";
    const illustration = { alt: question, url: "data:image/webp;base64,YQ==", generatedByAi: true };
    vi.mocked(enhanceStudioImagePrompt).mockResolvedValue({ prompt: interpretedPrompt });
    vi.mocked(createAssistantVisualIllustrations).mockResolvedValue([illustration]);

    const result = await answerAssistantConversation({ user: { id: "user-1", companyCode: "COMPANY-1" } } as never, {
      conversationId: "conversation-1",
      requestId: "request-image-1",
      question,
      messages: conversation,
    });

    expect(enhanceStudioImagePrompt).toHaveBeenCalledWith(question, conversation, 1);
    expect(createAssistantVisualIllustrations).toHaveBeenCalledWith({
      shouldGenerate: true,
      prompt: interpretedPrompt,
      alt: question,
      aspectRatio: "16:9",
    }, undefined, 1);
    expect(recommendAssistantVisualCreation).not.toHaveBeenCalled();
    expect(answerAssistantGeneralQuestion).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "completed",
      reply: "Mình đã tạo hình ảnh theo yêu cầu.",
      illustrations: [illustration],
      pendingDocumentRequest: null,
    });
  });

  it("creates multiple requested conversation images in one parallel batch", async () => {
    mockEmptyDocumentHistory();
    const question = "Tạo 3 ảnh poster cho quán cà phê";
    const illustrations = [1, 2, 3].map(index => ({
      alt: `Ảnh ${index}: ${question}`,
      url: `data:image/webp;base64,Y${index}==`,
      generatedByAi: true,
    }));
    vi.mocked(enhanceStudioImagePrompt).mockResolvedValue({ prompt: "Poster quảng cáo cho quán cà phê." });
    vi.mocked(createAssistantVisualIllustrations).mockResolvedValue(illustrations);

    const result = await answerAssistantConversation({ user: { id: "user-1", companyCode: "COMPANY-1" } } as never, {
      conversationId: "conversation-1",
      requestId: "request-image-batch-1",
      question,
      messages: [],
    });

    expect(enhanceStudioImagePrompt).toHaveBeenCalledWith(question, [], 3);
    expect(createAssistantVisualIllustrations).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Poster quảng cáo cho quán cà phê." }), undefined, 3);
    expect(result).toMatchObject({
      status: "completed",
      reply: "Mình đã tạo 3 ảnh theo yêu cầu.",
      illustrations,
    });
  });

  it("keeps the original request when image prompt analysis is unavailable", async () => {
    mockEmptyDocumentHistory();
    const question = "Tạo ảnh một chú mèo bên cửa sổ";
    vi.mocked(enhanceStudioImagePrompt).mockRejectedValue(new Error("Prompt model unavailable"));
    vi.mocked(createAssistantVisualIllustrations).mockResolvedValue([{
      alt: question,
      url: "data:image/webp;base64,YQ==",
      generatedByAi: true,
    }]);

    const result = await answerAssistantConversation({ user: { id: "user-1", companyCode: "COMPANY-1" } } as never, {
      conversationId: "conversation-1",
      requestId: "request-image-fallback-1",
      question,
      messages: [],
    });

    expect(createAssistantVisualIllustrations).toHaveBeenCalledWith(expect.objectContaining({ prompt: question }), undefined, 1);
    expect(result).toMatchObject({ status: "completed", illustrations: [{ generatedByAi: true }] });
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
