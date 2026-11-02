import { describe, expect, it } from "vitest";
import { taskActivityUpdate, taskProgress } from "./kanban-task-progress";
import { aggregateMonthlyKpiRows } from "./kanban-monthly-kpi.service";

const owner = { uid: "owner", name: "An", manager: false };
const helper = { uid: "helper", name: "Bình", manager: false };
const task = { assigneeUid: "owner", status: "Not Started", dueDate: "2026-09-30T10:00:00Z" };
const now = "2026-09-16T08:00:00.000Z";
describe("task progress and support", () => {
  it.each([[0, "Not Started"], [1, "In Progress"], [99, "In Progress"], [100, "Done"]])("maps %s percent to %s", (progress, status) => {
    const result = taskActivityUpdate(task, { action: "progress", progress, note: "Đã kiểm tra bo mạch" }, owner, now);
    expect(result.update.status).toBe(status);
    expect(result.history.action).toContain("Đã kiểm tra bo mạch");
    if (progress === 100) expect(result.update).toMatchObject({ completedAt: now, endTime: now, helpRequested: false });
  });
  it.each([-1, 101, 1.5, "50", null, NaN])("rejects invalid progress %s", progress => {
    expect(() => taskActivityUpdate(task, { action: "progress", progress, note: "Report" }, owner)).toThrow();
  });
  it("requires a report and prevents coworkers changing progress", () => {
    expect(() => taskActivityUpdate(task, { action: "progress", progress: 30, note: " " }, owner)).toThrow();
    expect(() => taskActivityUpdate(task, { action: "progress", progress: 30, note: "Report" }, helper)).toThrow();
  });
  it("preserves the primary assignee and awards KPI only to them after help", () => {
    const help = { ...task, ...taskActivityUpdate(task, { action: "help", note: "Quá tải" }, owner, now).update };
    const joined = { ...help, ...taskActivityUpdate(help, { action: "join", assigneeUid: "helper" }, helper, now).update };
    expect(joined.assigneeUid).toBe("owner");
    expect((joined as any).helpers).toEqual([{ uid: "helper", name: "Bình" }]);
    const done = { ...joined, ...taskActivityUpdate(joined, { action: "progress", progress: 100, note: "Đã xong" }, owner, now).update };
    const rows = aggregateMonthlyKpiRows([owner, helper].map(user => ({ employeeId: user.uid, employeeName: user.name, employeeAvatar: "" })), [done], "2026-09");
    expect(rows.map(row => row.completedTasks)).toEqual([1, 0]);
    expect((done as any).helpRequested).toBe(false);
  });
  it("does not turn a nominated helper into a participant before they join", () => {
    const update = taskActivityUpdate(task, { action: "help", note: "Cần hỗ trợ", helper: { uid: "other", name: "Other" } }, owner, now).update;
    expect(update).toMatchObject({ helpRequested: true });
    expect(update).not.toHaveProperty("helpers");
  });
  it("clears completion on reopening and retains original timestamp for repeated completion reports", () => {
    const done = { ...task, status: "Done", completedAt: now, endTime: now };
    expect(taskActivityUpdate(done, { action: "progress", progress: 50, note: "Cần kiểm tra lại" }, owner).update.completedAt).toBe("");
    expect(taskActivityUpdate(done, { action: "progress", progress: 100, note: "Bổ sung báo cáo" }, owner).update.completedAt).toBe(now);
  });
  it("guards archived tasks, duplicate joins, completed help and unauthorized closure", () => {
    expect(() => taskActivityUpdate({ ...task, status: "Archived" }, { action: "help", note: "Help" }, owner)).toThrow();
    expect(() => taskActivityUpdate({ ...task, status: "Done" }, { action: "help", note: "Help" }, owner)).toThrow();
    expect(() => taskActivityUpdate({ ...task, helpRequested: true, helpers: [{ uid: helper.uid }] }, { action: "join" }, helper)).toThrow();
    expect(() => taskActivityUpdate({ ...task, helpRequested: true }, { action: "resolve" }, helper)).toThrow();
    expect(taskActivityUpdate({ ...task, helpRequested: true }, { action: "resolve" }, owner).update).toEqual({ helpRequested: false });
  });
  it("normalizes legacy task progress", () => {
    expect(taskProgress({ status: "done" })).toBe(100);
    expect(taskProgress({ status: "doing" })).toBe(1);
    expect(taskProgress({ status: "todo" })).toBe(0);
  });
});
