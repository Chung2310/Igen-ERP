import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { relay, integrations, owners } = vi.hoisted(() => ({ relay: vi.fn(), integrations: vi.fn(), owners: vi.fn() }));
vi.mock("./event-relay", () => ({ relayMarketingEvent: relay }));
vi.mock("./model/social-integration.model", () => ({ SocialIntegrationModel: { find: integrations } }));
vi.mock("../../../model/user.model", () => ({ UserModel: { find: owners } }));
vi.mock("./model/ai-media.model", () => ({ AIMediaModel: {} }));
import { emitToMessengerAccount } from "./socket";

describe("Messenger events for AI replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    integrations.mockReturnValue({ select: () => ({ lean: async () => [{ companyCode: "COMPANY" }] }) });
  });

  it("publishes public conversation fields from a real Mongoose document", async () => {
    const Model = mongoose.models.MessengerEventTest || mongoose.model("MessengerEventTest", new mongoose.Schema({
      lastMessageText: String, pageId: String,
    }));
    const conversation = new Model({ lastMessageText: "AI đã trả lời", pageId: "page" });
    await emitToMessengerAccount("facebook", "page", "conversation_updated", conversation);
    const [audience, event, payload] = relay.mock.calls[0];
    expect(audience).toEqual({ kind: "account", id: "marketing:messenger:COMPANY:facebook:page" });
    expect(event).toBe("conversation_updated");
    expect(String(payload._id)).toBe(String(conversation._id));
    expect(payload).toMatchObject({ lastMessageText: "AI đã trả lời", channel: "facebook", accountId: "page" });
    expect(payload).not.toHaveProperty("_doc");
    expect(payload).not.toHaveProperty("$__");
  });

  it("keeps outbound AI message data in the realtime envelope", async () => {
    const message = { _id: "reply", conversationId: "conversation", direction: "outbound", senderType: "ai", text: "AI đã trả lời" };
    await emitToMessengerAccount("facebook", "page", "new_message", { message, conversation: { _id: "conversation" } });
    expect(relay.mock.calls[0][2]).toMatchObject({ message, channel: "facebook", accountId: "page" });
  });

  it("does not broadcast a reply to an ambiguous company mapping", async () => {
    integrations.mockReturnValue({ select: () => ({ lean: async () => [{ companyCode: "A" }, { companyCode: "B" }] }) });
    await emitToMessengerAccount("facebook", "page", "new_message", { message: { senderType: "ai" } });
    expect(relay).not.toHaveBeenCalled();
  });
});
