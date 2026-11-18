import { expect, it } from "vitest";
import { buildWorkerReport } from "./worker-report.service";
const projects = [{ _id: "p", name: "Kho vận", quota: 3, workerIds: ["a", "b", "b"], daysOfWeek: [1, 2, 3, 4, 5], startDate: "2026-11-01", endDate: "2026-12-01" }];
const workers = [{ _id: "a", fullName: "An" }, { _id: "b", fullName: "Bình" }];
it("counts distinct scoped workers against quota", () => {
  expect(buildWorkerReport(projects, workers, [], { mode: "shortage" })).toEqual([{ projectName: "Kho vận", quota: 3, allocated: 2, gap: 1 }]);
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
