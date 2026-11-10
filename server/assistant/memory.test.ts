import { describe, expect, it } from "vitest";
import { parseExplicitMemoryForgetCommand, rankAssistantMemories } from "./memory";

describe("assistant memory relevance", () => {
  it("ranks query-relevant memories before newer unrelated memories", () => {
    const ranked = rankAssistantMemories([
      { content: "Tôi thích câu trả lời ngắn gọn, có các bước rõ ràng.", source: "automatic", updatedAt: new Date("2026-10-01T00:00:00.000Z") },
      { content: "Tôi làm việc tại chi nhánh Hà Nội.", source: "manual", updatedAt: new Date() },
    ], "Cách trình bày câu trả lời?");

    expect(ranked[0].content).toContain("câu trả lời ngắn gọn");
  });

  it("parses Vietnamese and English forget commands without matching ordinary requests", () => {
    expect(parseExplicitMemoryForgetCommand("Quên ghi nhớ rằng tôi thích câu trả lời ngắn gọn.")).toBe("tôi thích câu trả lời ngắn gọn");
    expect(parseExplicitMemoryForgetCommand("Xóa ghi nhớ: tôi làm việc ở Hà Nội.")).toBe("tôi làm việc ở Hà Nội");
    expect(parseExplicitMemoryForgetCommand("forget: I prefer short answers.")).toBe("I prefer short answers");
    expect(parseExplicitMemoryForgetCommand("Tôi quên gửi báo cáo rồi.")).toBeNull();
  });
});
