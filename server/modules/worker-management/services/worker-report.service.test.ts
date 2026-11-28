import { expect, it } from "vitest";
import { buildLaborTypeCounts, buildWorkerOverviewReport, buildWorkerReport } from "./worker-report.service";
const projects = [{ _id: "p", name: "Kho vận", quota: 3, workerIds: ["a", "b", "b"], daysOfWeek: [1, 2, 3, 4, 5], startDate: "2026-11-01", endDate: "2026-12-01" }];
const workers = [{ _id: "a", fullName: "An" }, { _id: "b", fullName: "Bình" }];
it("counts distinct scoped workers against quota", () => {
  expect(buildWorkerReport(projects, workers, [], { mode: "shortage" })).toEqual([{ projectName: "Kho vận", quota: 3, allocated: 2, gap: 1 }]);
});
it("reports projects whose staffed headcount meets a positive quota", () => {
  expect(buildWorkerReport([
    { _id: "full", name: "Đã đủ", quota: 2, workerIds: ["a", "b"] },
    { _id: "short", name: "Còn thiếu", quota: 3, workerIds: ["a", "b"] },
    { _id: "no-quota", name: "Chưa đặt chỉ tiêu", quota: 0, workerIds: ["a", "b"] },
  ], workers, [], { mode: "filled" })).toEqual([{ projectName: "Đã đủ", quota: 2, allocated: 2, gap: 0 }]);
});
it("counts labor by type and treats legacy records without a type as official", () => {
  expect(buildLaborTypeCounts([{ laborType: "official" }, { laborType: "seasonal" }, {}])).toEqual([
    { laborType: "official", workerCount: 2 },
    { laborType: "seasonal", workerCount: 1 },
    { laborType: "foreign", workerCount: 0 },
  ]);
});
it("reports GPS attendance enabled without returning project coordinates", () => {
  expect(buildWorkerReport([
    { _id: "gps", name: "Có GPS", geoLocation: { latitude: 10, longitude: 106, radiusMeters: 100 } },
    { _id: "no-gps", name: "Không GPS", geoLocation: null },
  ], workers, [], { mode: "gps-enabled" })).toEqual([{ projectName: "Có GPS", gpsAttendanceEnabled: true }]);
});
it("keeps project lateness separate from unrecorded attendance and hides IDs", () => {
  const logs = [{ projectId: "p", workerId: "a", date: "2026-11-18", status: "late", checkIn: { time: new Date("2026-11-18T02:00:00Z") } }];
  const late = buildWorkerReport(projects, workers, logs, { mode: "late", date: "2026-11-18" }, "2026-11-18");
  expect(late).toHaveLength(1); expect(late[0].workerName).toBe("An"); expect(late[0]).not.toHaveProperty("workerId");
  const absent = buildWorkerReport(projects, workers, logs, { mode: "absent", date: "2026-11-18" }, "2026-11-18");
  expect(absent).toHaveLength(1); expect(absent[0].workerName).toBe("Bình"); expect(absent[0].attendanceStatus).toContain("chưa xác nhận vắng");
});
it("counts only scheduled past days and uses a strict greater-than threshold", () => {
  const result = buildWorkerReport(projects, workers, [], { mode: "absence-threshold", from: "2026-11-12", to: "2026-11-22", threshold: 3 }, "2026-11-18");
  expect(result).toHaveLength(2); expect(result[0].absentDays).toBe(5);
});
it("calculates labor overview attendance from scheduled worker-days and summarizes expiring contracts and debt", () => {
  const result = buildWorkerOverviewReport(
    [{ _id: "p1", workerIds: ["w1", "w2"], daysOfWeek: [0, 1] }],
    [{ _id: "w1" }, { _id: "w2" }],
    [{ projectId: "p1", workerId: "w1", date: "2026-11-01", checkIn: { time: new Date("2026-11-01T01:00:00.000Z") } }],
    [{ code: "HD-1", workerName: "An", endDate: "2026-11-28" }],
    [{ partnerId: { name: "Đối tác A" }, balanceAmount: 1_800_000, status: "approved" }],
    "2026-11-01", "2026-11-30", "2026-11-02",
  );
  expect(result).toMatchObject({ projectCount: 1, workerCount: 2, attendedWorkCount: 1, scheduledWorkCount: 4, attendanceRate: 25, expiringContractCount: 1, unpaidCommissionAmount: 1_800_000 });
});
