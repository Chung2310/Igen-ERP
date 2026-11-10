import { afterEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => vi.fn());
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

import { answerAssistantGeneralQuestion, assistantConversationContext } from "./general-answer";

afterEach(() => provider.mockReset());

describe("assistant general answers", () => {
  it("keeps earlier conversation details and complete messages within a bounded context", () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: index === 0 ? "Mục tiêu: kế hoạch cho lớp IELTS." : `Tin ${index}` }));
    expect(assistantConversationContext(messages)[0].content).toContain("IELTS");
    const context = assistantConversationContext([{ role: "user", content: "a".repeat(20000) }, { role: "assistant", content: "b".repeat(10000) }]);
    expect(context.reduce((sum, item) => sum + item.content.length, 0)).toBe(24000);
    expect(context.at(-1)?.content).toHaveLength(10000);
  });
  it("answers in the requested conversation context without claiming ERP access", async () => {
    provider.mockResolvedValueOnce({ text: "Phòng ban là một nhóm nhân sự được tổ chức theo chuyên môn hoặc chức năng." });
    const reply = await answerAssistantGeneralQuestion({
      question: "Phòng ban là gì?",
      messages: [{ role: "user", content: "Mình đang tìm hiểu về tổ chức doanh nghiệp." }],
      instructions: "Trả lời ngắn gọn và thân thiện.",
      memories: ["Người dùng thích câu trả lời ngắn gọn."],
      sessionMemory: "Đang tìm hiểu cách tổ chức nhân sự.",
    });
    expect(reply).toContain("nhóm nhân sự");
    const request = provider.mock.calls[0][0];
    expect(request.messages[0].content).toContain("không có quyền truy cập dữ liệu tài khoản");
    expect(request.messages[1].content).toContain("Phòng ban là gì?");
    expect(request.messages[1].content).toContain("Trả lời ngắn gọn và thân thiện.");
  });
});
