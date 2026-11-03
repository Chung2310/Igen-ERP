import type { ChatMessage } from "../../shared/types/index";

export type RawInboxMessage = {
  _id?: string;
  messageId?: string;
  direction?: "inbound" | "outbound";
  senderType?: "human" | "ai";
  text?: string;
  timestamp?: string | Date;
  attachments?: unknown[];
  conversationId?: string | Record<string, string>;
  senderId?: string;
  recipientId?: string;
};

export function mapInboxMessages(messages: RawInboxMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message._id || message.messageId || "",
    sender: message.direction === "inbound" ? "user" : message.senderType === "ai" ? "ai" : "agent",
    text: message.text || "",
    timestamp: new Date(message.timestamp || Date.now()),
    attachments: Array.isArray(message.attachments)
      ? message.attachments.filter((item): item is { type: string; url: string } => {
        if (!item || typeof item !== "object") return false;
        const attachment = item as { type?: unknown; url?: unknown };
        return typeof attachment.type === "string" && typeof attachment.url === "string";
      })
      : [],
    conversationId: typeof message.conversationId === "string"
      ? message.conversationId
      : message.conversationId?._id || "",
  }));
}
