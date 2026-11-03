import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ conversation: vi.fn(), messages: vi.fn() }));
vi.mock("../model/fb-messenger.model.ts", () => ({
  FBConversationModel: { findOne: mocks.conversation }, FBMessageModel: { find: mocks.messages },
}));
vi.mock("../../../../model/user.model.ts", () => ({ UserModel: {} }));
vi.mock("../../shared/socket", () => ({ emitToMessengerAccount: vi.fn() }));
vi.mock("./ai-auto-reply.service.ts", () => ({ aiAutoReplyService: {} }));
vi.mock("./facebook-comment.service.ts", () => ({ facebookCommentService: {} }));
vi.mock("../../shared/model/social-integration.model.ts", () => ({ SocialIntegrationModel: {} }));
vi.mock("./messenger-order.service.ts", () => ({ messengerOrderService: {} }));
vi.mock("./company-product-catalog.service.ts", () => ({ companyProductCatalogService: {} }));
import { fbMessengerService } from "./fb-messenger.service";

const inbound = { messageId: "in", direction: "inbound", timestamp: new Date("2026-11-03T08:56:00Z") };
const outbound = { messageId: "out", direction: "outbound", text: "Dạ chào mình nè, em đây ạ", timestamp: new Date("2026-11-03T08:56:20Z") };
let rows = [inbound];
beforeEach(() => {
  rows = [inbound];
  mocks.conversation.mockResolvedValue({ _id: "conversation", recipientId: "customer", unreadCount: 0 });
  mocks.messages.mockImplementation(() => ({ sort: () => ({ limit: async () => [...rows].reverse() }) }));
  vi.spyOn(fbMessengerService, "shouldSync").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

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
