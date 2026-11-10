import { describe, expect, it } from "vitest";
import { mayContainStableAssistantMemory } from "./auto-memory";

describe("automatic assistant memory candidate detection", () => {
  it("considers durable preferences and company terminology", () => {
    expect(mayContainStableAssistantMemory("Tôi thích câu trả lời ngắn gọn.")).toBe(true);
    expect(mayContainStableAssistantMemory("Trong công ty tôi, KT nghĩa là Kỹ thuật.")).toBe(true);
  });

  it("ignores one-off business operations and sensitive details", () => {
    expect(mayContainStableAssistantMemory("Thêm nhân sự Đỗ Đức Chung, lương 10 triệu.")).toBe(false);
    expect(mayContainStableAssistantMemory("Tôi thích trả lời ngắn gọn, mật khẩu là secret-123.")).toBe(false);
    expect(mayContainStableAssistantMemory("Tôi thích trao đổi qua email an@example.com.")).toBe(false);
  });
});
