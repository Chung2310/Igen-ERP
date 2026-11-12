import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { zaloMessengerController } from "../controller/zalo-messenger.controller";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { FacebookAutoReplyJobModel } from "../model/facebook-auto-reply-job.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { enqueueLeadIntakeRetry, enqueueZaloWebhook, startMessengerBackgroundWorkers } from "./messenger-background-jobs";
import { UserModel } from "../../../../model/user.model";
import { claimMessengerReply, enqueueMessengerReply, expireMessengerReplyJobs, markMessengerReplySending } from "./facebook-auto-reply-queue";
import { zaloMessengerService } from "./zalo-messenger.service";
import { assertZaloDeliveryCurrent, readZaloFollowUpMessages, ZaloReplyCancelledError } from "./zalo-reply-context";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), intake: vi.fn() }));
vi.mock("./ai-auto-reply.service.ts", () => ({
  aiAutoReplyService: { triggerAutoReply: mocks.dispatch },
  recoverZaloAutoReplyJobs: vi.fn(),
}));
vi.mock("../../shared/socket", () => ({ emitToMessengerAccount: vi.fn() }));
vi.mock("../webhook-access", () => ({ canProcessMessengerWebhook: async () => true }));
vi.mock("./chat-ordering/registry", () => ({
  chatOrderFlowRegistry: { resolveForCompanyPage: async () => ({ key: "page-intake", process: mocks.intake }) },
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
  vi.spyOn(UserModel, "findOne").mockResolvedValue({ zaloIntegration: { isMock: true } } as never);
  await Promise.all([ZaloConversationModel.deleteMany({}), ZaloMessageModel.deleteMany({}),
    MessengerBackgroundJobModel.deleteMany({}), FacebookAutoReplyJobModel.deleteMany({})]);
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
  const turn = { companyCode: "TEST", platform: "zalo" as const, pageId: "oa", conversationId: "c",
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
