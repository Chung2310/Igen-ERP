import { Types } from "mongoose";
import { expect, it, vi } from "vitest";
import { loadMessengerReplyMessages, olderThanMessage } from "./messenger-reply-messages";
import { splitHistoryAndPendingInboundMessages } from "./chat-image-context";

it("keeps the beginning of a burst across pages while limiting prior history", async () => {
  const timestamp = new Date("2026-11-12T09:00:00Z");
  const newestFirst = Array.from({ length: 120 }, (_, index) => ({
    _id: new Types.ObjectId((120 - index).toString(16).padStart(24, "0")),
    timestamp,
    direction: index === 65 ? "outbound" : "inbound",
    text: index === 64 ? "Số điện thoại 0912345678" : `Tin nhắn ${index}`,
  }));
  const fetchPage = vi.fn(async (cursor: { _id: Types.ObjectId; timestamp: Date } | undefined, limit: number) => {
    const start = cursor ? newestFirst.findIndex(row => row._id.equals(cursor._id)) + 1 : 0;
    return newestFirst.slice(start, start + limit);
  });
  const messages = await loadMessengerReplyMessages(fetchPage, 15);
  const grouped = splitHistoryAndPendingInboundMessages(messages);

  expect(fetchPage).toHaveBeenCalledTimes(2);
  expect(grouped.pendingMessageCount).toBe(65);
  expect(grouped.combinedText).toMatch(/^1\. Số điện thoại 0912345678/);
  expect(grouped.historyMessages).toHaveLength(15);
  expect(olderThanMessage(newestFirst[49]).$or).toContainEqual({ timestamp, _id: { $lt: newestFirst[49]._id } });
});
