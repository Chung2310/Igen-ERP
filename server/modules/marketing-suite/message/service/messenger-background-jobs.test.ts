import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { zaloMessengerController } from "../controller/zalo-messenger.controller";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { enqueueLeadIntakeRetry, startMessengerBackgroundWorkers } from "./messenger-background-jobs";
import { UserModel } from "../../../../model/user.model";

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), intake: vi.fn() }));
vi.mock("./ai-auto-reply.service.ts", () => ({ aiAutoReplyService: { triggerAutoReply: mocks.dispatch } }));
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
  await Promise.all([ZaloConversationModel.init(), ZaloMessageModel.init(), MessengerBackgroundJobModel.init()]);
}, 60_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mocks.dispatch.mockReset();
  mocks.intake.mockReset();
  vi.spyOn(UserModel, "findOne").mockResolvedValue({ zaloIntegration: { isMock: true } } as never);
  await Promise.all([ZaloConversationModel.deleteMany({}), ZaloMessageModel.deleteMany({}), MessengerBackgroundJobModel.deleteMany({})]);
  vi.stubEnv("ZALO_APP_ID", "test-app");
  vi.stubEnv("ZALO_OA_SECRET_KEY", "test-secret");
});
afterEach(() => {
  stopWorkers?.();
  stopWorkers = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
