import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversation: vi.fn(), conversationUpdate: vi.fn(), messages: vi.fn(), latest: vi.fn(),
  persist: vi.fn(), updateInbound: vi.fn(), emit: vi.fn(), send: vi.fn(), trigger: vi.fn(),
}));
vi.mock("../model/fb-messenger.model.ts", () => ({
  FBConversationModel: {
    findOne: mocks.conversation, findOneAndUpdate: mocks.conversationUpdate, findByIdAndUpdate: mocks.conversationUpdate,
  },
  FBMessageModel: {
    find: mocks.messages, findOne: mocks.latest, findOneAndUpdate: mocks.persist, updateOne: mocks.updateInbound,
    exists: async () => null,
  },
}));
vi.mock("../../../../model/user.model.ts", () => ({ UserModel: {} }));
vi.mock("../../shared/socket", () => ({ emitToMessengerAccount: mocks.emit }));
vi.mock("../../shared/service/facebook-send-request", () => ({ facebookSendRequest: mocks.send }));
vi.mock("./ai-auto-reply.service.ts", () => ({ aiAutoReplyService: { triggerAutoReply: mocks.trigger } }));
vi.mock("../webhook-access", () => ({ canProcessMessengerWebhook: async () => true }));
vi.mock("./facebook-comment.service.ts", () => ({ facebookCommentService: { processPendingComments: async () => {} } }));
vi.mock("../../shared/model/social-integration.model.ts", () => ({ SocialIntegrationModel: {} }));
vi.mock("./messenger-order.service.ts", () => ({ messengerOrderService: {} }));
vi.mock("./company-product-catalog.service.ts", () => ({ companyProductCatalogService: {} }));
vi.mock("./chat-ordering/registry", () => ({
  chatOrderFlowRegistry: {
    resolveForPage: async () => ({ isEnabled: async () => true, isActive: async () => true }),
  },
}));
import { fbMessengerService } from "./fb-messenger.service";

const inbound = { messageId: "in", direction: "inbound", timestamp: new Date("2026-11-03T08:56:00Z") };
const outbound = { messageId: "out", direction: "outbound", text: "Dạ chào mình nè, em đây ạ", timestamp: new Date("2026-11-03T08:56:20Z") };
let rows = [inbound];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.emit.mockResolvedValue(undefined);
  rows = [inbound];
  mocks.conversation.mockResolvedValue({ _id: "conversation", recipientId: "customer", unreadCount: 0 });
  mocks.messages.mockImplementation(() => ({ sort: () => ({ limit: async () => [...rows].reverse() }) }));
  vi.spyOn(fbMessengerService, "shouldSync").mockReturnValue(true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("returns the Facebook reply in the same sync response even when cached inbound messages already exist", async () => {
  vi.spyOn(fbMessengerService, "syncMessagesFromFacebook").mockImplementation(async () => {
    rows.push(outbound);
    return [];
  });
  const result = await fbMessengerService.getMessages("page", "conversation", { sync: true });
  expect(result.messages.map(message => message.messageId)).toEqual(["in", "out"]);
});

it("keeps cached chat history readable when Facebook synchronization fails", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(fbMessengerService, "syncMessagesFromFacebook").mockRejectedValue(new Error("Facebook unavailable"));
  const result = await fbMessengerService.getMessages("page", "conversation", { sync: true });
  expect(result.messages.map(message => message.messageId)).toEqual(["in"]);
});

it("does not synchronize Facebook when reading DB-only history or older pages", async () => {
  const sync = vi.spyOn(fbMessengerService, "syncMessagesFromFacebook").mockResolvedValue([]);
  await fbMessengerService.getMessages("page", "conversation", {});
  await fbMessengerService.getMessages("page", "conversation", { sync: true, before: "2026-11-03T08:56:00Z" });
  expect(sync).not.toHaveBeenCalled();
});

it.each(["text", "image"])("retains and emits an accepted Facebook %s reply when updating the conversation summary fails", async (kind) => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(fbMessengerService, "getPageAccessTokenByPageId").mockResolvedValue("test-token");
  const save = vi.fn().mockRejectedValue(new Error("conversation metadata write failed"));
  mocks.conversation.mockResolvedValue({ _id: "conversation", pageId: "page", recipientId: "customer", save });
  mocks.latest.mockReturnValue({ sort: async () => ({ timestamp: new Date() }) });
  mocks.send.mockResolvedValue(new Response(JSON.stringify({ message_id: "facebook-reply" }), { status: 200 }));
  mocks.persist.mockResolvedValue({ messageId: "facebook-reply", conversationId: "conversation", direction: "outbound" });

  const sent = kind === "text"
    ? fbMessengerService.sendReply("page", "conversation", "AI đã trả lời", "ai")
    : fbMessengerService.sendImage("page", "conversation", "https://example.com/image.png");
  await expect(sent).resolves.toMatchObject({ status: "success", messageId: "facebook-reply" });
  expect(mocks.persist).toHaveBeenCalledOnce();
  expect(mocks.emit).toHaveBeenCalledWith("facebook", "page", "new_message", expect.objectContaining({ message: expect.objectContaining({ messageId: "facebook-reply" }) }));
  expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]);
});

it("ingests outbound echoes through webhook and emits them without triggering AI", async () => {
  const conversation = { _id: "conversation", pageId: "page", recipientId: "customer" };
  mocks.conversationUpdate.mockResolvedValue(conversation);
  mocks.persist.mockResolvedValue({ ...outbound, senderType: "ai", conversationId: "conversation" });
  await fbMessengerService.handleWebhookEvent({ object: "page", entry: [{ id: "page", messaging: [{
    sender: { id: "page" }, recipient: { id: "customer" }, timestamp: Date.now(),
    message: { is_echo: true, mid: "out", text: outbound.text, metadata: "igen-erp:ai" },
  }] }] });
  expect(mocks.persist).toHaveBeenCalledWith({ messageId: "out" }, { $setOnInsert: expect.objectContaining({
    direction: "outbound", senderType: "ai", conversationId: "conversation", text: outbound.text,
  }) }, expect.objectContaining({ upsert: true }));
  expect(mocks.emit).toHaveBeenCalledWith("facebook", "page", "new_message", expect.objectContaining({ message: expect.objectContaining({ messageId: "out" }) }));
  expect(mocks.trigger).not.toHaveBeenCalled();
});

it("preserves existing AI attribution on duplicate external echoes and guards the newer conversation preview", async () => {
  mocks.conversationUpdate.mockResolvedValue({ _id: "conversation" });
  mocks.persist.mockResolvedValue({ ...outbound, senderType: "ai" });
  const timestamp = new Date("2026-11-03T08:56:20Z");
  const echo = { sender: { id: "page" }, recipient: { id: "customer" }, timestamp: timestamp.getTime(), message: { is_echo: true, mid: "out", text: outbound.text } };
  await fbMessengerService.processMessageEcho(echo, "page");
  await fbMessengerService.processMessageEcho(echo, "page");
  for (const [filter, update] of mocks.persist.mock.calls) {
    expect(filter).toEqual({ messageId: "out" });
    expect(update.$setOnInsert).not.toHaveProperty("senderType");
    expect(update).not.toHaveProperty("$set");
  }
  expect(mocks.conversationUpdate).toHaveBeenCalledWith({ _id: "conversation", pageId: "page", lastMessageAt: { $lte: timestamp } }, expect.anything(), expect.anything());
  expect(mocks.trigger).not.toHaveBeenCalled();
});

it("ignores echoes with a mismatched Page sender", async () => {
  await fbMessengerService.processMessageEcho({ sender: { id: "other-page" }, recipient: { id: "customer" },
    message: { is_echo: true, mid: "out", text: "wrong page" } }, "page");
  expect(mocks.persist).not.toHaveBeenCalled();
});

it("subscribes to outbound echoes once per Page/token instead of on every history refresh", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await fbMessengerService.subscribePageWebhooks("subscription-page", "token");
  await fbMessengerService.subscribePageWebhooks("subscription-page", "token");
  expect(fetch).toHaveBeenCalledOnce();
  expect(new URL(fetch.mock.calls[0][0]).searchParams.get("subscribed_fields")?.split(",")).toContain("message_echoes");
});

it("makes a failed inbound dispatch eligible for recovery before its original lease expires", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(fbMessengerService, "getPageAccessTokenByPageId").mockResolvedValue("test-token");
  mocks.latest.mockResolvedValue(inbound);
  mocks.conversationUpdate.mockResolvedValue({ _id: "conversation" });
  mocks.updateInbound.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValueOnce({ matchedCount: 1 });
  mocks.trigger.mockRejectedValueOnce(new Error("Temporary scheduling failure"));

  await fbMessengerService.processIncomingMessage({
    sender: { id: "customer" }, recipient: { id: "page" },
    timestamp: Date.now(), message: { mid: "in", text: "Xin tư vấn" },
  }, "page");

  await vi.waitFor(() => expect(mocks.updateInbound).toHaveBeenCalledTimes(2));
  const originalLease = mocks.updateInbound.mock.calls[0][1].$setOnInsert.autoReplyDispatchAfter;
  const [filter, update] = mocks.updateInbound.mock.calls[1];
  expect(filter).toMatchObject({
    messageId: "in", conversationId: "conversation", autoReplyDispatchPending: true, autoReplyDispatchAfter: originalLease,
  });
  expect(update.$set.autoReplyDispatchAfter.getTime() - Date.now()).toBeGreaterThan(25_000);
  expect(update.$set.autoReplyDispatchAfter.getTime()).toBeLessThan(originalLease.getTime());
});

it("cancels a typing indicator that is still in progress when delivery starts", async () => {
  vi.spyOn(fbMessengerService, "getPageAccessTokenByPageId").mockResolvedValue("test-token");
  const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();

  const typing = fbMessengerService.sendSenderAction("page", "conversation", "typing_on", undefined, controller.signal);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  controller.abort();
  await expect(typing).resolves.toBeUndefined();
  expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true);
});
