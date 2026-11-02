import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RepairTicketModel } from "../repair-ticket.model";
import { RepairPaymentModel } from "../repair-payment.model";
import { collectRepairPayment, reconcileRepairPayments } from "./repair-payment-safe.service";

let replSet: MongoMemoryReplSet;
const scope = { companyCode: "REPAIRPAY", branchId: "branch-1" };
const actor = { id: "manager", name: "Quản lý" };
let ticketId: string;

describe("thu tiền sửa chữa an toàn", () => {
  beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replSet.getUri()); });
  beforeEach(async () => {
    await Promise.all([RepairTicketModel.deleteMany({}), RepairPaymentModel.deleteMany({})]);
    const ticket = await RepairTicketModel.create({ ...scope, ticketCode: "SC-1", customerId: "customer-1", customerName: "Khách", customerPhone: "0900000000", device: { name: "Máy", condition: "Tốt", accessories: [], imeiVerified: false }, coverage: { costBearer: "customer", checkedAt: new Date() }, symptom: "Không mở", status: "done", totalAmount: 250_000, paidAmount: 50_000, dueAmount: 200_000, paymentStatus: "partial", receivedAt: new Date(), createdBy: actor.id, createdByName: actor.name });
    ticketId = String(ticket._id);
  });
  afterAll(async () => { await mongoose.disconnect(); await replSet.stop(); });

  it("keeps legacy paid baseline and returns the same receipt on retry", async () => {
    const first = await collectRepairPayment(scope, ticketId, 100_000, "request-1", actor);
    const retry = await collectRepairPayment(scope, ticketId, 100_000, "request-1", actor);
    expect(first.payment.afterPaid).toBe(150_000);
    expect(retry.replayed).toBe(true);
    expect(await RepairPaymentModel.countDocuments({ ...scope })).toBe(1);
    expect(await reconcileRepairPayments(scope, ticketId)).toMatchObject({ baseline: 50_000, ledgerPaid: 150_000, currentPaid: 150_000, currentDue: 100_000, balanced: true });
    await expect(collectRepairPayment(scope, ticketId, 80_000, "request-1", actor)).rejects.toMatchObject({ code: "REPAIR_PAYMENT_KEY_REUSED" });
    await expect(collectRepairPayment({ ...scope, branchId: "branch-2" }, ticketId, 100_000, "request-1", actor)).rejects.toMatchObject({ code: "REPAIR_PAYMENT_KEY_REUSED" });
    await RepairTicketModel.updateOne({ _id: ticketId }, { $set: { paidAmount: 160_000 } });
    expect((await reconcileRepairPayments(scope, ticketId)).balanced).toBe(false);
  });

  it("never collects more than the remaining amount under concurrent requests", async () => {
    const results = await Promise.allSettled([collectRepairPayment(scope, ticketId, 150_000, "request-a", actor), collectRepairPayment(scope, ticketId, 150_000, "request-b", actor)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await RepairTicketModel.findById(ticketId).lean())?.paidAmount).toBe(200_000);
    expect(await RepairPaymentModel.countDocuments({ ...scope })).toBe(1);
  });
});
