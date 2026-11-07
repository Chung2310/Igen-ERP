import { describe, expect, it } from "vitest";
import type { Batch, Course, Student } from "../../modules/student-management/types";
import { buildStudentOverview, parseStudentFee } from "./studentOverviewMetrics";

const range = { from: "2026-11-01", to: "2026-11-06", previousFrom: "2026-10-01", previousTo: "2026-10-31" };
const student = (fields: Partial<Student>): Student => ({
  id: "s1", fullName: "Học viên A", phone: "", birthday: "", idCard: "", registrationDate: "02/11/2026",
  fee: "5.000.000", address: "", status: ["Đang học"], ownerId: "owner", ...fields,
});

describe("student overview metrics", () => {
  it("keeps current balances separate from period receipts and avoids counting paid history twice", () => {
    const students = [
      student({ paymentHistory: [{ id: "p1", amount: 2_000_000, date: "03/11/2026", method: "Tiền mặt", recipient: "A" }], paidAmount: 2_000_000, courseId: "c1" }),
      student({ id: "s2", fullName: "Học viên B", registrationDate: "05/10/2026", fee: "3.000.000", paidAmount: 1_000_000,
        paymentHistory: [{ id: "p2", amount: 1_000_000, date: "04/10/2026", method: "Chuyển khoản", recipient: "A" }], courseId: "c1" }),
    ];
    const courses = [{ id: "c1", title: "Tin học", code: "TH" }] as Course[];
    const batches = [{ id: "b1", code: "L01", courseId: "c1", status: "Đang học", learnerIds: ["s1"], maxLearners: 20 }] as Batch[];
    const result = buildStudentOverview(students, courses, batches, range);
    expect(result.counts).toMatchObject({ students: 2, registrations: 1, previousRegistrations: 1, activeBatches: 1, debtors: 2 });
    expect(result.tuition).toMatchObject({ totalFee: 8_000_000, totalPaid: 3_000_000, outstanding: 5_000_000, collectedInPeriod: 2_000_000, previousCollected: 1_000_000 });
    expect(result.trend.reduce((sum, row) => sum + row.collected, 0)).toBe(2_000_000);
    expect(result.tuitionByCourse).toEqual([{ name: "Tin học", total: 8_000_000, paid: 3_000_000, outstanding: 5_000_000 }]);
    expect(result.batchLoad[0]).toMatchObject({ name: "L01", learners: 1, capacity: 20 });
  });

  it("excludes malformed fees and undated payments from period totals", () => {
    const result = buildStudentOverview([student({ fee: "", paidAmount: 500_000, paymentHistory: [{ id: "p1", amount: 500_000, date: "không rõ", method: "Tiền mặt", recipient: "A" }] })], [], [], range);
    expect(parseStudentFee("")).toBeNull();
    expect(result.counts.feeKnown).toBe(0);
    expect(result.tuition).toMatchObject({ totalFee: 0, totalPaid: 0, outstanding: 0, collectedInPeriod: 0 });
    expect(result.paymentMethods).toEqual([]);
  });
});
