import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { CRMTicketModel } from "./crm-ticket.model";
import { upsertLeadFromIntake } from "../service/lead-intake.service";

vi.mock("../../shared/socket", () => ({ broadcastEvent: vi.fn() }));
let mongo: MongoMemoryServer;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri()); await CRMTicketModel.init();
}, 60_000);
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

it("stores creation time for manual Leads and AI upserts, and keeps it unchanged on later intake updates", async () => {
  const before = Date.now();
  const manual = await CRMTicketModel.create({ companyCode: "LEAD_TIME", customerName: "Khách nhập tay" });
  expect(manual.createdAt).toBeInstanceOf(Date);
  expect(manual.createdAt!.getTime()).toBeGreaterThanOrEqual(before);
  const turn = { companyCode: "LEAD_TIME", platform: "zalo" as const, accountId: "OA", conversationId: "REAL_PATH_TEST",
    profileId: "PROFILE", profileVersion: 1, fields: [{ key: "name", label: "Họ tên", question: "Tên?", type: "text" as const }],
    values: { name: "An" }, previousValues: {}, allowCreate: true, messageId: "FIRST", messageAt: new Date("2026-01-01T00:00:00Z") };
  const created = await upsertLeadFromIntake(turn);
  expect(created?.createdAt).toBeInstanceOf(Date);
  expect(created!.createdAt!.getTime()).toBeGreaterThanOrEqual(before);
  await upsertLeadFromIntake({ ...turn, values: { name: "Anh An" }, previousValues: { name: "An" }, messageId: "SECOND", messageAt: new Date("2026-01-02T00:00:00Z") });
  const updated = await CRMTicketModel.findById(created!._id).lean();
  expect(updated?.createdAt).toEqual(created!.createdAt);
  expect(updated?.updatedAt).toBeInstanceOf(Date);
  expect(updated?.customerName).toBe("Anh An");
});

it("does not silently invent a creation date for old Leads that lack it", async () => {
  const id = new mongoose.Types.ObjectId();
  await CRMTicketModel.collection.insertOne({ _id: id, companyCode: "LEAD_TIME", customerName: "Khách cũ" });
  expect((await CRMTicketModel.findById(id).lean())?.createdAt).toBeUndefined();
  await CRMTicketModel.findOneAndUpdate({ _id: id }, { $set: { customerName: "Khách cũ đã sửa tên" } });
  expect((await CRMTicketModel.findById(id).lean())?.createdAt).toBeUndefined();
});
