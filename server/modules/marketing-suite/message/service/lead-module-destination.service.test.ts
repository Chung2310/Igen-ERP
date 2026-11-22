import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { clearModuleCache } from "../../../../middleware/require-module";
import { CompanyModel } from "../../../../model/company.model";
import { UserModel } from "../../../../model/user.model";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { CRMTicketModel } from "../model/crm-ticket.model";
import { LeadModuleDestinationModel } from "../model/lead-module-destination.model";
import { readLeadDestinationSettings, resolveLeadDestination, saveLeadDestination } from "./lead-module-destination.service";
import type { LeadDestinationPlatform } from "../../../../../shared/marketing-suite/lead-module-destination";

let mongo: MongoMemoryServer;
const models = [CompanyModel, UserModel, SocialIntegrationModel, CRMTicketModel, LeadModuleDestinationModel];
const companyCode = "ACME";
const zalo = { platform: "zalo", accountId: "acme-shared-id" } as const;
const facebook = { platform: "facebook", accountId: "acme-shared-id" } as const;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { autoIndex: false });
  await Promise.all(models.map(model => model.init()));
  await LeadModuleDestinationModel.createIndexes();
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await CompanyModel.collection.insertMany([
    { code: companyCode, businessType: "general", enabledModules: ["omni-inbox", "student", "healthcare"] },
    { code: "OTHER", businessType: "general", enabledModules: ["omni-inbox", "worker"] },
  ]);
  await SocialIntegrationModel.collection.insertMany([
    { companyCode, platform: "Zalo", username: zalo.accountId, displayName: "OA Phòng khám", isConnected: true },
    { companyCode: "OTHER", platform: "Zalo", username: "outside", displayName: "OA công ty khác", isConnected: true },
    { companyCode, platform: "Facebook", username: "off", displayName: "Page đã ngắt", isConnected: false },
  ]);
  await UserModel.collection.insertOne({
    companyCode, email: "local@test.invalid",
    facebookIntegration: { pageId: facebook.accountId, pageName: "Page Tuyển sinh", isConnected: true },
    zaloIntegration: { oaId: zalo.accountId, oaName: "Tên cũ", isConnected: true },
  });
});

afterEach(async () => {
  clearModuleCache();
  for (const model of models) await model.collection.deleteMany({});
});

async function createLead(source: { platform: LeadDestinationPlatform; accountId: string }, owner = companyCode) {
  const lead = await CRMTicketModel.create({
    companyCode: owner, customerName: "Khách thử", sourcePlatform: source.platform, sourceAccountId: source.accountId,
  });
  return String(lead._id);
}

it("lists connected company and legacy channels and resolves the configured destination for each exact source", async () => {
  await saveLeadDestination(companyCode, { ...zalo, targetModule: "healthcare" });
  await saveLeadDestination(companyCode, { ...facebook, targetModule: "students" });
  const settings = await readLeadDestinationSettings(companyCode);
  expect(settings).toEqual({
    availableModules: ["students", "healthcare"],
    channels: [
      { ...zalo, displayName: "OA Phòng khám", targetModule: "healthcare" },
      { ...facebook, displayName: "Page Tuyển sinh", targetModule: "students" },
    ],
  });
  const zaloLead = await createLead(zalo);
  const facebookLead = await createLead(facebook);
  expect(await resolveLeadDestination(companyCode, zaloLead)).toMatchObject({ targetModule: "healthcare" });
  expect(await resolveLeadDestination(companyCode, facebookLead)).toMatchObject({ targetModule: "students" });
  expect(await resolveLeadDestination("OTHER", zaloLead)).toBeNull();
});

it("uses manual selection after clearing a preference, disabling a module or disconnecting the channel", async () => {
  const leadId = await createLead(zalo);
  const manual = { targetModule: null, availableModules: ["students", "healthcare"] };
  expect(await resolveLeadDestination(companyCode, leadId)).toEqual(manual);
  await saveLeadDestination(companyCode, { ...zalo, targetModule: "healthcare" });
  await saveLeadDestination(companyCode, { ...zalo, targetModule: null });
  expect(await resolveLeadDestination(companyCode, leadId)).toEqual(manual);
  await saveLeadDestination(companyCode, { ...zalo, targetModule: "healthcare" });
  await CompanyModel.updateOne({ code: companyCode }, { $pull: { enabledModules: "healthcare" } });
  clearModuleCache(companyCode);
  expect(await resolveLeadDestination(companyCode, leadId)).toEqual({ targetModule: null, availableModules: ["students"] });
  await saveLeadDestination(companyCode, { ...zalo, targetModule: "students" });
  await SocialIntegrationModel.updateOne({ companyCode, username: zalo.accountId }, { $set: { isConnected: false } });
  await UserModel.updateOne({ companyCode }, { $set: { "zaloIntegration.isConnected": false } });
  expect(await resolveLeadDestination(companyCode, leadId)).toMatchObject({ targetModule: null });
});

it("rejects unknown, cross-company and ambiguously owned channels and unavailable destinations", async () => {
  await expect(saveLeadDestination(companyCode, { ...zalo, accountId: "outside", targetModule: "students" })).rejects.toMatchObject({ statusCode: 404 });
  await expect(saveLeadDestination(companyCode, { ...zalo, targetModule: "workers" })).rejects.toMatchObject({ statusCode: 400 });
  await expect(saveLeadDestination(companyCode, { platform: "tiktok", accountId: "mock", targetModule: "students" })).rejects.toMatchObject({ statusCode: 400 });
  await UserModel.collection.insertOne({
    companyCode: "OTHER", email: "other@test.invalid", zaloIntegration: { oaId: zalo.accountId, isConnected: true },
  });
  await expect(saveLeadDestination(companyCode, { ...zalo, targetModule: "students" })).rejects.toMatchObject({ statusCode: 409 });
  expect(await LeadModuleDestinationModel.countDocuments()).toBe(0);
});
