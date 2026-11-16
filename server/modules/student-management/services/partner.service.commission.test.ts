import { afterEach, expect, it, vi } from "vitest";
import { CommissionLevel } from "../models/commission-level.model";
import { Partner } from "../models/partner.model";
import { Student } from "../models/student.model";
import { PartnerService } from "./partner.service";

afterEach(() => vi.restoreAllMocks());

it("uses the effective tier rate for both partner total and student detail", async () => {
  const partner = {
    _id: { toString: () => "partner-a" },
    ownerId: "admin-a",
    commissionType: "fixed",
    commissionValue: 0,
    payoutHistory: [],
    toObject() { return { ownerId: this.ownerId, commissionType: this.commissionType, commissionValue: this.commissionValue }; },
  };
  const student = {
    _id: { toString: () => "student-a" },
    partnerId: "partner-a",
    fullName: "Học viên thử",
    phone: "0392611137",
    status: ["Đang học"],
    fee: "10000000",
    registrationDate: "13/11/2026",
  };
  vi.spyOn(Partner, "findOne").mockResolvedValue(partner as never);
  vi.spyOn(CommissionLevel, "find").mockReturnValue({ sort: async () => [] } as never);
  vi.spyOn(Student, "find").mockReturnValue({
    select: async () => [student],
    sort: async () => [student],
  } as never);

  const result = await PartnerService.getPartnerById(["admin-a"], "partner-a", "branch-a");

  expect(result?.commissionValue).toBe(5);
  expect(result?.totalCommission).toBe(500000);
  expect(result?.referredStudents[0].commission).toBe(500000);
});
