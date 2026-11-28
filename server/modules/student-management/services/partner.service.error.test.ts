import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../../../errors/app-error";
import { Partner } from "../models/partner.model";
import { Student } from "../models/student.model";
import { CommissionLevel } from "../models/commission-level.model";
import { PartnerService } from "./partner.service";

test("createPartner reports a stable conflict when phone already exists in branch", async () => {
  const originalFindOne = Partner.findOne;
  const originalWrites = PartnerService.customFieldWrites;
  let query: unknown;
  (Partner as any).findOne = async (value: unknown) => { query = value; return { _id: "existing" }; };
  PartnerService.customFieldWrites = {
    prepareCreate: async (_context: unknown, data: unknown) => data,
  } as any;

  try {
    await assert.rejects(
      () => PartnerService.createPartner("owner-1", {
        name: "Đối tác A",
        phone: "0123456750",
        commissionType: "fixed",
        commissionValue: 0,
        branchId: "branch-1",
      } as any, { tenantId: "tenant-1", moduleKey: "partners", actorRole: "admin" } as any),
      (error: unknown) => error instanceof ConflictError
        && error.code === "PARTNER_PHONE_ALREADY_EXISTS"
        && error.status === 409
        && error.details?.field === "phone",
    );
    assert.deepEqual(query, { ownerId: "owner-1", phone: "0123456750", branchId: "branch-1" });
  } finally {
    (Partner as any).findOne = originalFindOne;
    PartnerService.customFieldWrites = originalWrites;
  }
});

function stubPartnerPayoutReads() {
  const id = "partner-1";
  const partner: any = {
    _id: { toString: () => id }, ownerId: "owner-1", branchId: "branch-1", __v: 4,
    payoutHistory: [], toObject() { return { _id: this._id, ownerId: this.ownerId, branchId: this.branchId, payoutHistory: this.payoutHistory }; },
  };
  const originals = {
    partnerFindOne: Partner.findOne,
    partnerFindOneAndUpdate: Partner.findOneAndUpdate,
    studentFind: Student.find,
    commissionFind: CommissionLevel.find,
  };
  (Partner as any).findOne = async () => partner;
  (Student as any).find = () => ({ select: async () => [{ _id: "student-1", partnerId: id, fee: "10000" }] });
  (CommissionLevel as any).find = () => ({ sort: async () => [] });
  return { partner, originals, restore() {
    (Partner as any).findOne = originals.partnerFindOne;
    (Partner as any).findOneAndUpdate = originals.partnerFindOneAndUpdate;
    (Student as any).find = originals.studentFind;
    (CommissionLevel as any).find = originals.commissionFind;
  } };
}

test("partner payout cannot exceed the currently unpaid commission", async () => {
  const stub = stubPartnerPayoutReads();
  let writeCalled = false;
  (Partner as any).findOneAndUpdate = async () => { writeCalled = true; return stub.partner; };

  try {
    await assert.rejects(
      () => PartnerService.addPayout("owner-1", "partner-1", { amount: 501, date: "20/11/2026", method: "Chuyển khoản" }, "branch-1"),
      (error: any) => error.code === "PARTNER_PAYOUT_EXCEEDS_UNPAID" && error.details?.unpaidBalance === 500,
    );
    assert.equal(writeCalled, false);
  } finally { stub.restore(); }
});

test("partner payout rejects a stale balance write instead of overwriting a concurrent payout", async () => {
  const stub = stubPartnerPayoutReads();
  let filter: any;
  (Partner as any).findOneAndUpdate = async (query: unknown) => { filter = query; return null; };

  try {
    await assert.rejects(
      () => PartnerService.addPayout("owner-1", "partner-1", { amount: 300, date: "20/11/2026", method: "Chuyển khoản" }, "branch-1"),
      (error: any) => error.code === "PARTNER_PAYOUT_CONFLICT" && error.status === 409,
    );
    assert.equal(filter.__v, 4);
    assert.equal(filter.branchId, "branch-1");
  } finally { stub.restore(); }
});

test("partner payout report groups in-range cash and transfer payouts using Vietnam's stored date format", async () => {
  const originalFind = Partner.find;
  let query: unknown;
  (Partner as any).find = (filter: unknown) => {
    query = filter;
    return { select: () => ({ lean: async () => [
      { name: "Đối tác A", payoutHistory: [
        { amount: 1_200_000, date: "25/11/2026", method: "Chuyển khoản" },
        { amount: 500_000, date: "10/11/2026", method: "Tiền mặt" },
        { amount: 900_000, date: "31/10/2026", method: "Tiền mặt" },
      ] },
    ] }) };
  };
  try {
    const report = await PartnerService.getPayoutReport(["owner-a", "owner-b"], "branch-hn", "2026-11-01", "2026-11-30");
    assert.deepEqual(query, { ownerId: { $in: ["owner-a", "owner-b"] }, branchId: "branch-hn" });
    assert.equal(report.payoutCount, 2);
    assert.equal(report.totalAmount, 1_700_000);
    assert.deepEqual(report.methodTotals, [
      { method: "Chuyển khoản", payoutCount: 1, totalAmount: 1_200_000 },
      { method: "Tiền mặt", payoutCount: 1, totalAmount: 500_000 },
    ]);
    assert.equal(report.payouts[0].date, "2026-11-10");
  } finally { (Partner as any).find = originalFind; }
});
