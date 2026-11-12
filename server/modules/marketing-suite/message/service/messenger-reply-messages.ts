import type { Types } from "mongoose";

type ReplyMessage = { _id: Types.ObjectId; timestamp: Date; createdAt?: Date; direction: string };
type MessageCursor = Pick<ReplyMessage, "_id" | "timestamp" | "createdAt">;

export const facebookMessageOrder = { timestamp: -1, createdAt: -1, _id: -1 } as const;

export function olderThanMessage(cursor?: MessageCursor, useCreatedAt = false) {
  if (!cursor) return {};
  return { $or: [
    { timestamp: { $lt: cursor.timestamp } },
    ...(useCreatedAt && cursor.createdAt ? [
      { timestamp: cursor.timestamp, createdAt: { $lt: cursor.createdAt } },
      { timestamp: cursor.timestamp, createdAt: null },
    ] : []),
    { timestamp: cursor.timestamp, ...(useCreatedAt ? { createdAt: cursor.createdAt ?? null } : {}), _id: { $lt: cursor._id } },
  ] };
}

export async function loadMessengerReplyMessages<T extends ReplyMessage>(
  fetchPage: (cursor: MessageCursor | undefined, limit: number) => Promise<T[]>,
  historyLimit: number,
) {
  const pageSize = 50;
  const messages: T[] = [];
  let cursor: MessageCursor | undefined;
  let historyCount = 0;
  for (;;) {
    const page = await fetchPage(cursor, pageSize);
    for (const message of page) {
      if (historyCount > 0 || message.direction !== "inbound") historyCount++;
      if (historyCount > historyLimit) return messages.reverse();
      messages.push(message);
    }
    if (page.length < pageSize || historyCount >= historyLimit) return messages.reverse();
    cursor = page[page.length - 1];
  }
}
