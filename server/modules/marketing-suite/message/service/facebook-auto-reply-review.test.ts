import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { AIReplyLogModel } from "../model/ai-reply-log.model";
import { FacebookAutoReplyJobModel } from "../model/facebook-auto-reply-job.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { generateText } from "../../shared/service/gemini/core";
import { aiAutoReplyService } from "./ai-auto-reply.service";
import { reportFacebookReplyFailure } from "./facebook-reply-failure.service";
import { fbMessengerService } from "./fb-messenger.service";

vi.mock("../../shared/access", async importOriginal => ({
  ...await importOriginal<typeof import("../../shared/access")>(),
  companyModuleEnabled: async () => true,
}));
vi.mock("../../shared/service/gemini/core", async importOriginal => ({
  ...await importOriginal<typeof import("../../shared/service/gemini/core")>(),
  generateText: vi.fn(),
}));
vi.mock("../../shared/socket", () => ({ emitToMessengerAccount: vi.fn(async () => {}) }));
vi.mock("./chat-ordering/registry", () => ({
  chatOrderFlowRegistry: { resolveForCompanyPage: async () => undefined },
}));
vi.mock("./chat-reply-context.service.ts", async importOriginal => ({
  ...await importOriginal<typeof import("./chat-reply-context.service.ts")>(),
  prepareChatReplyContext: async () => ({ ragContext: { contextText: "Thông tin doanh nghiệp", matches: 1 } }),
}));
vi.mock("./telecom-invoice-flow", () => ({ processTelecomInvoiceTurn: async () => undefined }));

let mongo: MongoMemoryServer;
const companyCode = "ACME";
const pageId = "test-page";
const inboundId = "inbound-1";
const question = "Đơn của mình giao được hôm nay không?";
const uncheckedReply = "Đơn sẽ được giao hôm nay.";
const models = [FBConversationModel, FBMessageModel, FacebookAutoReplyJobModel, SocialIntegrationModel, AIReplyLogModel];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Promise.all(models.map(model => model.init()));
  await FacebookAutoReplyJobModel.createIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await Promise.all(models.map(model => model.collection.deleteMany({})));
  await SocialIntegrationModel.collection.insertOne({
    companyCode, platform: "Facebook", username: pageId, isConnected: true,
    aiAutoReplyConfig: { enabled: true, replyDelay: 0.001, advancedInstructions: "Không xác nhận giao hàng nếu chưa có lịch." },
  });
  vi.stubEnv("OPENROUTER_CHAT_MESSAGE_API_KEY", "test");
  vi.stubEnv("AI_REPLY_GROUPING_DELAY_SECONDS", "0");
  vi.spyOn(fbMessengerService, "sendSenderAction").mockResolvedValue(undefined);
  vi.spyOn(fbMessengerService, "sendReply").mockImplementation(async (senderId, conversationId, text, senderType, _token, _session, beforeSend) => {
    await beforeSend?.();
    const message = await FBMessageModel.create({ conversationId, senderId, recipientId: "test-customer", text,
      senderType, direction: "outbound", messageId: "outbound-1", timestamp: new Date() });
    return { status: "success", messageId: message.messageId };
  });
});

afterEach(() => {
  vi.mocked(generateText).mockReset();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function createConversation() {
  const conversation = await FBConversationModel.create({ pageId, recipientId: "test-customer" });
  await FBMessageModel.create({ conversationId: conversation._id, direction: "inbound", messageId: inboundId,
    senderId: "test-customer", recipientId: pageId, text: question, timestamp: new Date() });
  return conversation._id;
}

function rejectBusinessReply(onLastCheck?: () => Promise<unknown>) {
  const proposedCorrection = { text: JSON.stringify({ compliant: false, correctedParts: [uncheckedReply] }) };
  const rejected = { text: JSON.stringify({ compliant: false, violations: ["Chưa có lịch giao"] }) };
  vi.mocked(generateText)
    .mockResolvedValueOnce({ text: uncheckedReply })
    .mockResolvedValueOnce(proposedCorrection)
    .mockResolvedValueOnce(rejected)
    .mockResolvedValueOnce(proposedCorrection)
    .mockImplementationOnce(async () => {
      await onLastCheck?.();
      return rejected;
    });
}

it("acknowledges a Facebook message once and makes the rejected reply available for staff review", async () => {
  const conversationId = await createConversation();
  rejectBusinessReply();
  await aiAutoReplyService.triggerAutoReply("facebook", pageId, String(conversationId), question, inboundId, { propagateError: true });

  const job = await vi.waitFor(async () => {
    const current = await FacebookAutoReplyJobModel.findOne({ conversationId }).lean();
    expect(current).toMatchObject({ status: "failed", attempts: 1, deliveryStartedAt: expect.any(Date),
      lastError: "Business-rule review could not confirm a compliant reply." });
    return current!;
  }, { timeout: 5_000 });
  expect(fbMessengerService.sendReply).toHaveBeenCalledExactlyOnceWith(
    pageId, String(conversationId), "Dạ, bên em đã nhận được tin nhắn ạ.", "ai", expect.any(Object), undefined, expect.any(Function),
  );
  await reportFacebookReplyFailure(job, companyCode);
  expect(await FBConversationModel.findById(conversationId).lean()).toMatchObject({
    tags: ["AI cần kiểm tra"], unreadCount: 1, lastSender: "user", followUpStatus: "responded",
  });
  await aiAutoReplyService.triggerAutoReply("facebook", pageId, String(conversationId), question, inboundId, { propagateError: true });
  expect(fbMessengerService.sendReply).toHaveBeenCalledTimes(1);
});

it("sends the substantive reply when the repair resolves the verifier's specific violation", async () => {
  const conversationId = await createConversation();
  const corrected = "Hôm nay mình muốn nhận vào khung giờ nào ạ?";
  const violation = "Lời xác nhận giao hôm nay chưa có lịch làm căn cứ.";
  const proposedCorrection = { text: JSON.stringify({ compliant: false, correctedParts: [uncheckedReply] }) };
  vi.mocked(generateText)
    .mockResolvedValueOnce({ text: uncheckedReply })
    .mockResolvedValueOnce(proposedCorrection)
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: false, violations: [violation] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: true, correctedParts: [corrected] }) })
    .mockResolvedValueOnce({ text: JSON.stringify({ compliant: true, violations: [] }) });
  await aiAutoReplyService.triggerAutoReply("facebook", pageId, String(conversationId), question, inboundId, { propagateError: true });

  await vi.waitFor(async () => {
    expect(await FacebookAutoReplyJobModel.findOne({ conversationId }).lean()).toMatchObject({ status: "completed", attempts: 1 });
  }, { timeout: 5_000 });
  expect(vi.mocked(generateText).mock.calls[2][2]?.responseSchema?.required).toEqual(["compliant", "violations"]);
  expect(JSON.parse(String(vi.mocked(generateText).mock.calls[3][1])).verificationViolations).toEqual([violation]);
  expect(fbMessengerService.sendReply).toHaveBeenCalledExactlyOnceWith(
    pageId, String(conversationId), corrected, "ai", expect.any(Object), undefined, expect.any(Function),
  );
  expect(await FBConversationModel.findById(conversationId).lean()).toMatchObject({
    tags: [], lastSender: "assistant", followUpStatus: "pending",
  });
});

it("skips the acknowledgement when an employee replied during review", async () => {
  const conversationId = await createConversation();
  rejectBusinessReply(() => FBMessageModel.create({ conversationId, direction: "outbound", messageId: "outbound-human",
    senderId: pageId, recipientId: "test-customer", senderType: "human", text: "Em kiểm tra lịch giao cho mình nhé.", timestamp: new Date() }));
  await aiAutoReplyService.triggerAutoReply("facebook", pageId, String(conversationId), question, inboundId, { propagateError: true });

  await vi.waitFor(async () => {
    expect(await FacebookAutoReplyJobModel.findOne({ conversationId }).lean())
      .toMatchObject({ status: "cancelled", lastError: "outbound_during_generation" });
  }, { timeout: 5_000 });
  expect(fbMessengerService.sendReply).not.toHaveBeenCalled();
});
