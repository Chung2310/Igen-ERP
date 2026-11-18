import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { ChatTestMessageModel, ChatTestSessionModel } from "../model/chat-test.model";
import { FBConversationModel, FBMessageModel } from "../model/fb-messenger.model";
import { MessengerBackgroundJobModel } from "../model/messenger-background-job.model";
import { PageChatFlowStateModel } from "../model/page-chat-flow.model";
import { TikTokConversationModel, TikTokMessageModel } from "../model/tiktok-messenger.model";
import { ZaloConversationModel, ZaloMessageModel } from "../model/zalo-messenger.model";
import { resetCompanyChat } from "./company-chat-reset.service";

let mongo: MongoMemoryReplSet;
const channelFixtures = [
  { accounts: FBConversationModel, messages: FBMessageModel, field: "pageId", own: "page-a", other: "page-b" },
  { accounts: ZaloConversationModel, messages: ZaloMessageModel, field: "oaId", own: "oa-a", other: "oa-b" },
  { accounts: TikTokConversationModel, messages: TikTokMessageModel, field: "businessAccountId", own: "tiktok-a", other: "tiktok-b" },
];

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).init()));
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

afterEach(async () => {
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
});

async function seedAccounts() {
  await SocialIntegrationModel.create([
    { companyCode: "ALPHA", platform: "Facebook", username: "page-a", displayName: "Page A", createdBy: "admin", isConnected: false },
    { companyCode: "ALPHA", platform: "Zalo", username: "oa-a", displayName: "OA A", createdBy: "admin" },
    { companyCode: "BETA", platform: "Facebook", username: "page-b", displayName: "Page B", createdBy: "admin" },
    { companyCode: "BETA", platform: "Zalo", username: "oa-b", displayName: "OA B", createdBy: "admin" },
  ]);
  await UserModel.collection.insertOne({ companyCode: "ALPHA", email: "alpha@test.invalid", tiktokIntegration: { username: "tiktok-a" } });
  for (const { accounts, messages, field, own, other } of channelFixtures) {
    for (const accountId of [own, other]) {
      const { insertedId } = await accounts.collection.insertOne({ [field]: accountId, recipientId: accountId, openId: accountId });
      await messages.collection.insertOne({ conversationId: insertedId, messageId: accountId });
    }
  }
}

it("clears tenant chat histories, sandbox messages, and queued payloads while retaining other tenants and business data", async () => {
  await seedAccounts();
  const { insertedId: sessionId } = await ChatTestSessionModel.collection.insertOne({ companyCode: "ALPHA", sandboxCompanyCode: "__TEST_ALPHA" });
  const { insertedId: otherSessionId } = await ChatTestSessionModel.collection.insertOne({ companyCode: "BETA", sandboxCompanyCode: "__TEST_BETA" });
  await ChatTestMessageModel.collection.insertMany([
    { sessionId, clientMessageId: "one" }, { sessionId: otherSessionId, clientMessageId: "one" },
  ]);
  await PageChatFlowStateModel.collection.insertMany([
    { companyCode: "ALPHA", pageId: "page-a", conversationId: "a" },
    { companyCode: "__TEST_ALPHA", pageId: "page-a", conversationId: "test" },
    { companyCode: "BETA", pageId: "page-b", conversationId: "b" },
  ]);
  await CRMTicketModel.collection.insertOne({ companyCode: "ALPHA", customerName: "Lead đã lưu" });
  await MessengerBackgroundJobModel.create([
    { _id: "zalo-a", kind: "zalo-webhook", payload: { oa_id: "oa-a", message: { text: "Tin cũ" } }, status: "pending", attempts: 0, dueAt: new Date() },
    { _id: "zalo-b", kind: "zalo-webhook", payload: { oa_id: "oa-b", message: { text: "Tin của B" } }, status: "pending", attempts: 0, dueAt: new Date() },
  ]);

  await expect(resetCompanyChat("ALPHA")).resolves.toEqual({ conversationCount: 3, messageCount: 4 });
  for (const { accounts, messages, field, other } of channelFixtures) {
    expect(await accounts.collection.distinct(field)).toEqual([other]);
    expect(await messages.collection.distinct("messageId")).toEqual([other]);
  }
  expect(await ChatTestMessageModel.exists({ sessionId })).toBeNull();
  expect(await ChatTestMessageModel.exists({ sessionId: otherSessionId })).toBeTruthy();
  expect(await ChatTestSessionModel.exists({ _id: sessionId })).toBeTruthy();
  expect(await PageChatFlowStateModel.distinct("companyCode")).toEqual(["BETA"]);
  expect(await SocialIntegrationModel.countDocuments()).toBe(4);
  expect(await CRMTicketModel.exists({ companyCode: "ALPHA" })).toBeTruthy();
  const job = await MessengerBackgroundJobModel.findById("zalo-a").lean();
  expect(job?.status).toBe("completed");
  expect(job?.payload).toBeUndefined();
  expect(await MessengerBackgroundJobModel.findById("zalo-b").lean()).toMatchObject({ status: "pending", payload: { oa_id: "oa-b" } });
  await expect(resetCompanyChat("ALPHA")).resolves.toEqual({ conversationCount: 0, messageCount: 0 });
});

it("rejects ambiguous account ownership before deleting chat from any channel", async () => {
  await seedAccounts();
  await SocialIntegrationModel.create({
    companyCode: "BETA", platform: "Zalo", username: "oa-a", displayName: "Previous owner", createdBy: "admin", isConnected: false,
  });
  await expect(resetCompanyChat("ALPHA")).rejects.toMatchObject({ statusCode: 409 });
  expect(await FBConversationModel.exists({ pageId: "page-a" })).toBeTruthy();
  expect(await ZaloConversationModel.exists({ oaId: "oa-a" })).toBeTruthy();
});

it("keeps chat history when a job on the tenant's OA is already processing", async () => {
  await seedAccounts();
  await MessengerBackgroundJobModel.create({
    _id: "processing", kind: "zalo-webhook", payload: { oa_id: "oa-a" }, status: "processing", attempts: 1,
    dueAt: new Date(), leaseUntil: new Date(Date.now() + 60_000),
  });
  await expect(resetCompanyChat("ALPHA")).rejects.toMatchObject({ statusCode: 409 });
  expect(await ZaloMessageModel.exists({ messageId: "oa-a" })).toBeTruthy();
});
