import { describe, expect, it } from "vitest";
import { calculateTaskDeadlineKpi } from "./kanbanDeadlineKpi";

describe("calculateTaskDeadlineKpi", () => {
  it("awards KPI for a completed task before or exactly at the deadline regardless of estimated hours", () => {
    expect(calculateTaskDeadlineKpi({ status: "Done", dueDate: "2026-11-12T16:00", endTime: "2026-11-12T15:59" })?.status).toBe("ontime");
    expect(calculateTaskDeadlineKpi({ status: "Done", dueDate: "2026-11-12T16:00", endTime: "2026-11-12T16:00" })?.status).toBe("ontime");
  });

  it("fails a task completed after the deadline even if it took less than the estimated time", () => {
    expect(calculateTaskDeadlineKpi({ status: "Done", dueDate: "2026-11-12T16:00", endTime: "2026-11-12T16:01" })).toMatchObject({ status: "late", diff: 0.1 });
  });

  it("uses the stored completion instant and ignores tasks that are not Done", () => {
    expect(calculateTaskDeadlineKpi({ status: "done", dueDate: "2026-11-12T16:00", completedAt: "2026-11-12T08:59:00Z" })?.status).toBe("ontime");
    expect(calculateTaskDeadlineKpi({ status: "In Progress", dueDate: "2026-11-12T16:00", endTime: "2026-11-12T15:00" })).toBeNull();
  });
});
