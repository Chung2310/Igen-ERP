import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, it } from "vitest";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { ZaloConversationModel } from "../model/zalo-messenger.model";
import { withLeadZaloIdentities } from "./lead-zalo-identity.service";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Promise.all([UserModel.init(), SocialIntegrationModel.init(), ZaloConversationModel.init()]);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

it("returns UID strings only for leads whose exact conversation and OA belong to the company", async () => {
  const companyCode = "ACME";
  const uid = "0012345678901234567";
  await SocialIntegrationModel.collection.insertMany([
    { companyCode, platform: "Zalo", username: "OA1", isConnected: true },
    { companyCode, platform: "Zalo", username: "ambiguous", isConnected: true },
    { companyCode, platform: "Zalo", username: "disconnected", isConnected: false },
    { companyCode: "OTHER", platform: "Zalo", username: "outside", isConnected: true },
  ]);
  await UserModel.collection.insertMany([
    { companyCode, zaloIntegration: { oaId: "OA2", isConnected: true } },
    { companyCode: "OTHER", zaloIntegration: { oaId: "ambiguous", isConnected: true } },
  ]);
  const oaIds = ["OA1", "OA2", "ambiguous", "disconnected", "outside"];
  const conversations = oaIds.map(oaId => ({ _id: new mongoose.Types.ObjectId(), oaId, recipientId: uid }));
  await ZaloConversationModel.collection.insertMany(conversations);
  const [first, second, ambiguous, disconnected, outside] = conversations.map(({ _id, oaId }) => ({
    sourcePlatform: "zalo", sourceAccountId: oaId, sourceConversationId: String(_id),
  }));
  const withoutIdentity = [
    { ...first, sourceAccountId: second.sourceAccountId },
    { ...first, sourcePlatform: "facebook" },
    { ...first, sourceConversationId: "legacy-invalid-id" },
    { ...first, sourceConversationId: String(new mongoose.Types.ObjectId()) },
    { sourcePlatform: "zalo", sourceAccountId: "OA1" },
    ambiguous, disconnected, outside,
  ];

  expect(await withLeadZaloIdentities(companyCode, [first, second, ...withoutIdentity])).toEqual([
    { ...first, zaloIdentity: { oaId: "OA1", uid } },
    { ...second, zaloIdentity: { oaId: "OA2", uid } },
    ...withoutIdentity,
  ]);
});
