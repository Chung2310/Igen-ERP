import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RepairTicketModel } from "../repair-ticket.model";
import { RepairCareCaseModel, RepairCareEventModel } from "../repair-care.model";
import { addRepairCareMessage, changeRepairCareStatus, repairCareForCustomer, repairCareForTicket } from "./repair-care.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "REPAIRCARE", branchId: "branch-1" };
const actor = { id: "manager", name: "Quản lý" };
let ticketId: string;

describe("CSKH theo phiếu sửa chữa", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([RepairTicketModel.deleteMany({}), RepairCareCaseModel.deleteMany({}), RepairCareEventModel.deleteMany({})]);
    const ticket = await RepairTicketModel.create({ ...scope, ticketCode: "SC-CARE", customerId: "customer-1", customerName: "Khách", customerPhone: "0900000000", device: { name: "Máy", condition: "Tốt", accessories: [], imeiVerified: false }, coverage: { costBearer: "customer", checkedAt: new Date() }, symptom: "Không mở", status: "received", receivedAt: new Date(), createdBy: actor.id, createdByName: actor.name });
    ticketId = String(ticket._id);
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("records customer conversation and status once per request key", async () => {
    const input = { channel: "phone", direction: "incoming", body: "Khách hỏi tiến độ", idempotencyKey: "message-1" };
    await addRepairCareMessage(scope, ticketId, input, actor);
    await addRepairCareMessage(scope, ticketId, input, actor);
    await changeRepairCareStatus(scope, ticketId, { status: "waiting", idempotencyKey: "status-1" }, actor);
    const care = await repairCareForTicket(scope, ticketId);
    expect(care.careCase.status).toBe("waiting");
    expect(care.events).toHaveLength(2);
    expect((await repairCareForCustomer(scope, "customer-1")).events).toHaveLength(2);
    await expect(addRepairCareMessage(scope, ticketId, { ...input, body: "Nội dung khác" }, actor)).rejects.toMatchObject({ code: "REPAIR_CARE_KEY_REUSED" });
    await expect(repairCareForTicket({ ...scope, branchId: "other" }, ticketId)).rejects.toMatchObject({ code: "REPAIR_TICKET_NOT_FOUND" });
  });
});
