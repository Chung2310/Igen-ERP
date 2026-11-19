import { createHash, createHmac } from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { zaloMessengerController } from "../controller/zalo-messenger.controller";
import { fbMessengerController } from "../controller/fb-messenger.controller";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { FacebookAutoReplyJobModel } from "../model/facebook-auto-reply-job.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { enqueueLeadIntakeRetry, enqueueZaloWebhook, startMessengerBackgroundWorkers } from "./messenger-background-jobs";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { claimMessengerReply, enqueueMessengerReply, expireMessengerReplyJobs, markMessengerReplySending } from "./facebook-auto-reply-queue";
import { zaloMessengerService } from "./zalo-messenger.service";
import { fbMessengerService } from "./fb-messenger.service";
import { assertZaloDeliveryCurrent, beginZaloFollowUpDelivery, expireZaloFollowUpDeliveries,
  readZaloFollowUpMessages, ZaloReplyCancelledError } from "./zalo-reply-context";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { TelecomInvoiceSettingsModel } from "../model/telecom-invoice.model";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), intake: vi.fn(), contractOcr: vi.fn() }));
vi.mock("./ai-auto-reply.service.ts", () => ({
  aiAutoReplyService: { triggerAutoReply: mocks.dispatch },
  recoverZaloAutoReplyJobs: vi.fn(),
}));
vi.mock("../../shared/socket", () => ({ emitToMessengerAccount: vi.fn() }));
vi.mock("../webhook-access", () => ({ canProcessMessengerWebhook: async () => true }));
vi.mock("./lead-contract-ocr", async importOriginal => ({
  ...(await importOriginal<typeof import("./lead-contract-ocr")>()),
  processLeadContractMessage: mocks.contractOcr,
}));
vi.mock("./chat-ordering/registry", () => ({
  chatOrderFlowRegistry: {
    resolveForCompanyPage: async () => ({ key: "page-intake", process: mocks.intake }),
    resolveForPage: async () => undefined,
  },
}));

let mongo: MongoMemoryServer;
let stopWorkers: (() => void) | undefined;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { serverSelectionTimeoutMS: 5_000 });
  await Promise.all([ZaloConversationModel.init(), ZaloMessageModel.init(), MessengerBackgroundJobModel.init(), FacebookAutoReplyJobModel.init()]);
}, 60_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mocks.dispatch.mockReset();
  mocks.intake.mockReset();
  mocks.contractOcr.mockReset();
  vi.spyOn(UserModel, "findOne").mockResolvedValue({ zaloIntegration: { isMock: true } } as never);
  await Promise.all([ZaloConversationModel.deleteMany({}), ZaloMessageModel.deleteMany({}),
    FBConversationModel.deleteMany({}), FBMessageModel.deleteMany({}),
    MessengerBackgroundJobModel.deleteMany({}), FacebookAutoReplyJobModel.deleteMany({}), TelecomInvoiceSettingsModel.deleteMany({})]);
  vi.stubEnv("ZALO_APP_ID", "test-app");
  vi.stubEnv("ZALO_OA_SECRET_KEY", "test-secret");
});
afterEach(() => {
  stopWorkers?.();
  stopWorkers = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function webhook(timestamp = Date.now()) {
  const body = {
    app_id: "test-app", event_name: "user_send_text", recipient: { id: "oa" },
    sender: { id: "customer" }, message: { text: "Xin tư vấn" }, timestamp,
  };
  const rawBody = JSON.stringify(body);
  const signature = createHash("sha256").update(`${body.app_id}${rawBody}${timestamp}test-secret`).digest("hex");
  const req = { body, rawBody, get: () => `mac=${signature}` } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const submit = () => zaloMessengerController.receiveWebhookEvent(req, res as unknown as Response);
  return { req, res, submit };
}

it("accepts Facebook webhooks signed with an encrypted company Page secret", async () => {
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("FB_APP_SECRET", "different-environment-secret");
  const appSecret = "test-company-page-secret";
  const pageId = "company-facebook-page";
  const integration = await SocialIntegrationModel.create({
    companyCode: "ACME", platform: "Facebook", username: pageId, displayName: "Page thử", createdBy: "test",
    isConnected: true, appSecret,
  });
  try {
    const stored = await SocialIntegrationModel.collection.findOne({ _id: integration._id });
    expect(stored?.appSecret).toMatch(/^v1\./);
    const body = { object: "page", entry: [{ id: pageId, messaging: [{
      sender: { id: "test-customer" }, recipient: { id: pageId }, timestamp: Date.now(),
      message: { mid: "mid.company-secret", text: "Chào shop" },
    }] }] };
    const rawBody = JSON.stringify(body);
    const receive = async (secret: string) => {
      const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
      const req = { body, rawBody, get: () => `sha256=${signature}` } as unknown as Request;
      const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
      await fbMessengerController.receiveWebhookEvent(req, res as unknown as Response);
      return res;
    };

    const rejected = await receive("incorrect-signing-secret");
    expect(rejected.status).toHaveBeenCalledWith(401);
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "facebook-webhook" })).toBe(0);

    const accepted = await receive(appSecret);
    expect(accepted.status).toHaveBeenCalledWith(200);
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "facebook-webhook", "payload.pageId": pageId })).toBe(1);
  } finally {
    await SocialIntegrationModel.deleteOne({ _id: integration._id });
  }
});

it("saves a signed Facebook webhook before acknowledging and retries an interrupted inbound write", async () => {
  vi.stubEnv("FB_APP_SECRET", "test-facebook-secret");
  vi.spyOn(fbMessengerService, "getPageAccessTokenByPageId").mockResolvedValue(null);
  mocks.dispatch.mockResolvedValue(undefined);
  const timestamp = Date.now();
  const body = { object: "page", entry: [{ id: "facebook-page", messaging: [{
    sender: { id: "facebook-customer" }, recipient: { id: "facebook-page" }, timestamp,
    message: { mid: "mid.incoming", text: "Chào shop" },
  }] }] };
  const rawBody = JSON.stringify(body);
  const signature = createHmac("sha256", "test-facebook-secret").update(rawBody).digest("hex");
  const req = { body, rawBody, get: () => `sha256=${signature}` } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const receive = () => fbMessengerController.receiveWebhookEvent(req, res as unknown as Response);
  const jobFilter = { kind: "facebook-webhook" as const };

  // When the durable write fails, Meta must receive a retriable status.
  const failedEnqueue = vi.spyOn(MessengerBackgroundJobModel, "updateOne").mockRejectedValueOnce(new Error("read ECONNRESET"));
  await receive();
  expect(res.status).toHaveBeenLastCalledWith(503);
  failedEnqueue.mockRestore();

  await receive();
  await receive();
  expect(res.status).toHaveBeenLastCalledWith(200);
  expect(await MessengerBackgroundJobModel.countDocuments({ ...jobFilter, status: "pending" })).toBe(1);
  expect(await FBMessageModel.countDocuments()).toBe(0);

  const failedInbound = vi.spyOn(FBMessageModel, "updateOne").mockRejectedValueOnce(new Error("read ECONNRESET"));
  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.findOne(jobFilter).lean()).toMatchObject({ status: "pending", attempts: 1 });
  }, { timeout: 5_000 });
  failedInbound.mockRestore();
  await MessengerBackgroundJobModel.updateOne(jobFilter, { $set: { dueAt: new Date(0) } });

  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.findOne(jobFilter).lean()).toMatchObject({ status: "completed", attempts: 2 });
    expect(await FBMessageModel.countDocuments({ messageId: "mid.incoming", direction: "inbound" })).toBe(1);
    expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith("facebook", "facebook-page",
      expect.any(String), "Chào shop", "mid.incoming", { propagateError: true });
  }, { timeout: 5_000 });
});

it("acknowledges only after persisting and deduplicates a Zalo webhook without a message ID", async () => {
  const { res, submit } = webhook();
  const failedWrite = vi.spyOn(MessengerBackgroundJobModel, "updateOne").mockRejectedValueOnce(new Error("test write failure"));
  await submit();
  expect(res.status).toHaveBeenLastCalledWith(503);
  failedWrite.mockRestore();
  await submit();
  await submit();
  expect(res.status).toHaveBeenLastCalledWith(200);
  expect(await MessengerBackgroundJobModel.countDocuments({ kind: "zalo-webhook", status: "pending" })).toBe(1);
  expect(await ZaloMessageModel.countDocuments()).toBe(0);
});

it("stores the sticker URL from the webhook attachment and dispatches the sticker turn", async () => {
  const url = "https://api.zalo.me/api/emoticon/oasticker?eid=123&size=130";
  await zaloMessengerService.handleWebhookEvent({
    event_name: "user_send_sticker", recipient: { id: "oa" }, sender: { id: "customer" }, timestamp: Date.now(),
    message: { msg_id: "sticker-1", attachments: [{ type: "sticker", payload: { url, id: "123" } }] },
  });

  const message = await ZaloMessageModel.findOne({ messageId: "sticker-1" }).lean();
  expect(message).toMatchObject({ text: "[Sticker]", attachments: [{ type: "sticker", url }] });
  expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith("zalo", "oa", String(message?.conversationId), "[Sticker]", "sticker-1", { propagateError: true });
});

it("keeps each Zalo invoice photo in order when images arrive in the same attachment batch and in separate events", async () => {
  const first = "https://s120-ava-talk.zadn.vn/image/invoice-1.jpg";
  const second = "https://s120-ava-talk.zadn.vn/image/invoice-2.jpg";
  const third = "https://s120-ava-talk.zadn.vn/image/invoice-3.jpg";
  const timestamp = Date.now();
  for (const [index, urls] of [[first, second], [third]].entries()) {
    await zaloMessengerService.handleWebhookEvent({
      event_name: "user_send_image", recipient: { id: "oa" }, sender: { id: "customer" }, timestamp: timestamp + index,
      message: { msg_id: `images-${index}`, attachments: urls.map(url => ({ type: "image", payload: { url } })) },
    });
  }
  const messages = await ZaloMessageModel.find({ recipientId: "oa", direction: "inbound" }).sort({ timestamp: 1 }).lean();
  expect(messages.flatMap(message => message.attachments.map(item => item.url))).toEqual([first, second, third]);
  expect(mocks.dispatch).toHaveBeenLastCalledWith("zalo", "oa", String(messages[0].conversationId), "[Hình ảnh]", "images-1", { propagateError: true });
});

it("dispatches the original image and question to the chatbot before the separate contract OCR job runs", async () => {
  await TelecomInvoiceSettingsModel.create({ companyCode: "TEST", pageId: "oa", zalo: {
    enabled: true, mode: "contract", contractFieldKey: "ma_hop_dong", contractProvider: "FPT",
  } });
  const body = {
    event_name: "user_send_image", recipient: { id: "oa" }, sender: { id: "customer" }, timestamp: Date.now(),
    message: { msg_id: "contract-1", text: "Gói này còn bán không?",
      attachments: [{ type: "image", payload: { url: "https://s120-ava-talk.zadn.vn/image/contract.jpg" } }] },
  };
  await zaloMessengerService.handleWebhookEvent(body);
  const message = await ZaloMessageModel.findOne({ messageId: body.message.msg_id }).lean();
  const conversationId = String(message?.conversationId);
  expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith("zalo", "oa", conversationId, body.message.text, body.message.msg_id, { propagateError: true });
  expect(mocks.contractOcr).not.toHaveBeenCalled();
  expect(await MessengerBackgroundJobModel.countDocuments({ kind: "lead-contract-ocr", status: "pending" })).toBe(1);

  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "lead-contract-ocr", status: "completed" })).toBe(1);
  }, { timeout: 6_000 });
  expect(mocks.contractOcr).toHaveBeenCalledExactlyOnceWith({ companyCode: "TEST", platform: "zalo", pageId: "oa", conversationId, messageId: body.message.msg_id });
  expect(mocks.dispatch).toHaveBeenCalledTimes(1);
}, 10_000);

it("recovers Zalo jobs across an expired lease and a failed message write without double-counting unread", async () => {
  const eventTimestamp = Math.floor(Date.now() / 1000);
  const { submit } = webhook(eventTimestamp);
  await submit();
  await MessengerBackgroundJobModel.updateOne({ kind: "zalo-webhook" }, {
    $set: { status: "processing", leaseUntil: new Date(0), leaseToken: "expired" },
  });
  const failOnce = vi.spyOn(ZaloMessageModel, "create").mockRejectedValueOnce(new Error("test message write failure"));
  mocks.dispatch.mockRejectedValueOnce(new Error("test reply scheduling failure"));
  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.exists({ kind: "zalo-webhook", status: "pending", attempts: 1 })).toBeTruthy();
  }, { timeout: 5_000 });
  failOnce.mockRestore();
  await MessengerBackgroundJobModel.updateOne({ kind: "zalo-webhook" }, { $set: { dueAt: new Date(0) } });
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.exists({ kind: "zalo-webhook", status: "pending", attempts: 2 })).toBeTruthy();
  }, { timeout: 5_000 });
  await MessengerBackgroundJobModel.updateOne({ kind: "zalo-webhook" }, { $set: { dueAt: new Date(0) } });
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.exists({ kind: "zalo-webhook", status: "completed", attempts: 3 })).toBeTruthy();
  }, { timeout: 5_000 });
  expect(await ZaloMessageModel.countDocuments()).toBe(1);
  expect(await ZaloConversationModel.findOne().lean()).toMatchObject({ unreadCount: 1, lastMessageAt: new Date(eventTimestamp * 1000) });
  expect(mocks.dispatch).toHaveBeenCalledTimes(2);
  await submit();
  expect(await MessengerBackgroundJobModel.countDocuments({ kind: "zalo-webhook", status: "completed" })).toBe(1);
}, 20_000);

it("deduplicates a Lead retry and processes only intake in the worker", async () => {
  const conversation = await ZaloConversationModel.create({ oaId: "oa", recipientId: "customer" });
  const conversationId = String(conversation._id);
  await ZaloMessageModel.create({ conversationId, senderId: "customer", recipientId: "oa", direction: "inbound",
    messageId: "m1", timestamp: new Date(), text: "Xin tư vấn" });
  const turn = { companyCode: "TEST", platform: "zalo" as const, pageId: "oa", conversationId,
    messageId: "m1", messageAt: new Date(), message: "Xin tư vấn", imageUrls: ["not-required"] };
  await enqueueLeadIntakeRetry(turn);
  await enqueueLeadIntakeRetry(turn);
  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "lead-intake", status: "completed" })).toBe(1);
  }, { timeout: 6_000 });
  expect(mocks.intake).toHaveBeenCalledExactlyOnceWith({ ...turn, imageUrls: [], retryIntake: true });
  expect(mocks.dispatch).not.toHaveBeenCalled();
}, 10_000);

it.each([
  ["facebook", "message"], ["facebook", "conversation"], ["zalo", "message"], ["zalo", "conversation"],
] as const)("skips pending %s Lead processing after the %s has been deleted", async (platform, deleted) => {
  const conversation = platform === "zalo"
    ? await ZaloConversationModel.create({ oaId: "account", recipientId: "customer" })
    : await FBConversationModel.create({ pageId: "account", recipientId: "customer" });
  const conversationId = String(conversation._id);
  const inbound = { conversationId, senderId: "customer", recipientId: "account", direction: "inbound" as const,
    messageId: "deleted-source", timestamp: new Date(), text: "Xin tư vấn" };
  if (platform === "zalo") {
    await ZaloMessageModel.create(inbound);
    if (deleted === "message") await ZaloMessageModel.deleteMany({ conversationId });
    else await ZaloConversationModel.deleteOne({ _id: conversationId });
  } else {
    await FBMessageModel.create(inbound);
    if (deleted === "message") await FBMessageModel.deleteMany({ conversationId });
    else await FBConversationModel.deleteOne({ _id: conversationId });
  }
  await enqueueLeadIntakeRetry({ companyCode: "TEST", platform, pageId: "account", conversationId,
    messageId: inbound.messageId, message: inbound.text, imageUrls: [] });
  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.countDocuments({ kind: "lead-intake", status: "completed" })).toBe(1);
  }, { timeout: 6_000 });
  expect(mocks.intake).not.toHaveBeenCalled();
  expect(mocks.dispatch).not.toHaveBeenCalled();
}, 10_000);

it("loads the newest Zalo follow-up history and aborts delivery if the customer replies during token lookup", async () => {
  const conversation = await ZaloConversationModel.create({
    oaId: "oa", recipientId: "customer", lastSender: "assistant",
    lastAssistantMessageAt: new Date(14_000), lastAssistantMessageId: "m14", followUpStatus: "pending",
  });
  const conversationId = String(conversation._id);
  await ZaloMessageModel.insertMany(Array.from({ length: 14 }, (_, index) => ({
    conversationId, senderId: index === 13 ? "oa" : "customer",
    recipientId: index === 13 ? "customer" : "oa", direction: index === 13 ? "outbound" : "inbound",
    messageId: `m${index + 1}`, timestamp: new Date((index + 1) * 1000),
  })));

  const messages = await readZaloFollowUpMessages(conversationId);
  expect(messages.map(message => message.messageId)).toEqual(["m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13", "m14"]);
  await expect(assertZaloDeliveryCurrent(conversationId, "oa", "m14", conversation)).resolves.toBeUndefined();

  await enqueueZaloWebhook({ event_name: "user_send_text", oa_id: "oa", sender: { id: "other-customer" }, message: { msg_id: "other" } });
  await expect(assertZaloDeliveryCurrent(conversationId, "oa", "m14", conversation)).resolves.toBeUndefined();
  await enqueueZaloWebhook({ event_name: "user_send_text", oa_id: "oa", sender: { id: "customer" }, message: { msg_id: "m15" } });
  await expect(assertZaloDeliveryCurrent(conversationId, "oa", "m14", conversation)).rejects.toBeInstanceOf(ZaloReplyCancelledError);
  await MessengerBackgroundJobModel.deleteMany({});

  vi.mocked(UserModel.findOne).mockResolvedValue(null);
  vi.spyOn(zaloMessengerService, "getAccessTokenByOAId").mockImplementationOnce(async () => {
    await ZaloMessageModel.create({
      conversationId, senderId: "customer", recipientId: "oa", direction: "inbound",
      messageId: "m15", timestamp: new Date(15_000),
    });
    return "mock-token";
  });
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  await expect(zaloMessengerService.sendReply("oa", conversationId, "Bạn còn cần hỗ trợ?", "ai",
    () => assertZaloDeliveryCurrent(conversationId, "oa", "m14", conversation))).rejects.toBeInstanceOf(ZaloReplyCancelledError);
  expect(send).not.toHaveBeenCalled();
  expect(await ZaloMessageModel.countDocuments({ conversationId, direction: "outbound" })).toBe(1);
});

it("allows multiple manual Leads in one account while keeping linked conversations unique", async () => {
  await CRMTicketModel.init();
  const scope = { companyCode: "LEAD-TEST", sourcePlatform: "zalo" as const, sourceAccountId: "OA", createdBy: "test" };
  await CRMTicketModel.create({ ...scope, customerName: "An", sourceConversationId: "" });
  await CRMTicketModel.create({ ...scope, customerName: "Bình" });
  await CRMTicketModel.create({ ...scope, customerName: "Chi" });
  await CRMTicketModel.create({ ...scope, customerName: "Dũng", sourceConversationId: "CONV" });
  await expect(CRMTicketModel.create({ ...scope, customerName: "Trùng", sourceConversationId: "CONV" }))
    .rejects.toMatchObject({ code: 11000 });
  expect(await CRMTicketModel.countDocuments({ companyCode: scope.companyCode })).toBe(4);
});

it("clears an exhausted webhook marker and processes the customer's next message", async () => {
  const { submit } = webhook();
  await submit();
  await MessengerBackgroundJobModel.updateOne({ kind: "zalo-webhook" }, { $set: { attempts: 7 } });
  const failedWrite = vi.spyOn(ZaloMessageModel, "create").mockRejectedValueOnce(new Error("test message write failure"));
  stopWorkers = startMessengerBackgroundWorkers();
  await vi.waitFor(async () => {
    expect(await MessengerBackgroundJobModel.exists({ kind: "zalo-webhook", status: "failed" })).toBeTruthy();
  }, { timeout: 5_000 });
  failedWrite.mockRestore();
  expect(await ZaloConversationModel.findOne().select("+pendingInboundMessageIds").lean())
    .toMatchObject({ pendingInboundMessageIds: [], unreadCount: 0 });
  await webhook(Date.now() + 1).submit();
  await vi.waitFor(async () => expect(mocks.dispatch).toHaveBeenCalledTimes(1), { timeout: 5_000 });
  expect(await ZaloConversationModel.findOne().lean()).toMatchObject({ unreadCount: 1 });
}, 15_000);

it("allows a single worker to start a follow-up and never replays an interrupted delivery", async () => {
  const conversation = await ZaloConversationModel.create({ oaId: "oa", recipientId: "customer",
    lastSender: "assistant", followUpStatus: "pending", lastAssistantMessageAt: new Date(1000) });
  await ZaloMessageModel.create({ conversationId: conversation._id, senderId: "oa", recipientId: "customer",
    direction: "outbound", messageId: "anchor", timestamp: new Date(1000), status: "delivered" });
  const results = await Promise.allSettled([
    beginZaloFollowUpDelivery(conversation, "anchor"), beginZaloFollowUpDelivery(conversation, "anchor"),
  ]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  await expireZaloFollowUpDeliveries(Date.now() + 61_000);
  expect(await ZaloConversationModel.findById(conversation._id).lean()).toMatchObject({ followUpStatus: "failed" });
  await expect(beginZaloFollowUpDelivery(conversation, "anchor")).rejects.toBeInstanceOf(ZaloReplyCancelledError);
});

it("reclaims an interrupted Zalo reply once, without replaying a send of unknown outcome", async () => {
  const conversationId = new mongoose.Types.ObjectId().toString();
  const input = {
    conversationId, pageId: "oa", companyCode: "TEST", messageId: "m1", text: "Xin tư vấn",
    messageTimestamp: new Date(1000), messageCreatedAt: new Date(1000), nextAttemptAt: new Date(0),
    messageObjectId: "000000000000000000000001",
  };
  await enqueueMessengerReply(input, "zalo");
  const original = await claimMessengerReply(conversationId, "m1", "zalo");
  expect(original?.job.attempts).toBe(1);
  expect(await enqueueMessengerReply(input, "zalo")).toBeNull();
  expect(await claimMessengerReply(conversationId, "m1")).toBeNull();
  await FacebookAutoReplyJobModel.updateOne({ channel: "zalo", conversationId }, { $set: { leaseUntil: new Date(0) } });

  const claims = await Promise.all([
    claimMessengerReply(conversationId, "m1", "zalo"),
    claimMessengerReply(conversationId, "m1", "zalo"),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const reclaimed = claims.find(Boolean)!;
  expect(reclaimed.job.attempts).toBe(2);
  expect(await markMessengerReplySending(conversationId, "m1", original!.leaseToken, "zalo")).toBe(false);
  expect(await markMessengerReplySending(conversationId, "m1", reclaimed.leaseToken, "zalo")).toBe(true);
  await FacebookAutoReplyJobModel.updateOne({ channel: "zalo", conversationId }, { $set: { leaseUntil: new Date(0) } });
  await expireMessengerReplyJobs(new Date(), "zalo");
  expect(await claimMessengerReply(conversationId, "m1", "zalo")).toBeNull();
  expect(await FacebookAutoReplyJobModel.exists({ channel: "zalo", conversationId, status: "failed" })).toBeTruthy();

  // Zalo can deliver a later turn even if the preceding send outcome is unknown.
  const newer = { ...input, messageId: "m2", messageObjectId: "000000000000000000000002" };
  expect(await enqueueMessengerReply(newer, "zalo")).toEqual(input.nextAttemptAt);
  expect(await enqueueMessengerReply(input, "zalo")).toBeNull();
  expect((await claimMessengerReply(conversationId, "m2", "zalo"))?.job.attempts).toBe(1);
});
