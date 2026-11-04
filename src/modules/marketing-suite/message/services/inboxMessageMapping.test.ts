import { describe, expect, it } from "vitest";
import { mapInboxMessages } from "./inboxMessageMapping";

describe("inbox AI message display", () => {
  it("preserves AI authorship for both history and realtime message records", () => {
    const [ai, human, customer] = mapInboxMessages([
      { _id: "reply", direction: "outbound", senderType: "ai", text: "Shop chào bạn", conversationId: "conversation" },
      { direction: "outbound", senderType: "human", text: "Nhân viên hỗ trợ" },
      { direction: "inbound", text: "Xin chào" },
    ]);
    expect(ai).toMatchObject({ id: "reply", sender: "ai", text: "Shop chào bạn", conversationId: "conversation" });
    expect(human.sender).toBe("agent");
    expect(customer.sender).toBe("user");
  });

  it("keeps legacy outbound messages visible and maps AI image replies", () => {
    const [legacy, image] = mapInboxMessages([
      { messageId: "legacy", direction: "outbound", text: "Lịch sử Facebook" },
      { messageId: "ai-image", direction: "outbound", senderType: "ai", conversationId: { _id: "conversation" },
        attachments: [{ type: "image", url: "https://example.com/image.png" }, null, { type: "image" }] },
    ]);
    expect(legacy).toMatchObject({ id: "legacy", sender: "agent", text: "Lịch sử Facebook" });
    expect(image).toMatchObject({ sender: "ai", conversationId: "conversation",
      attachments: [{ type: "image", url: "https://example.com/image.png" }] });
  });
});
