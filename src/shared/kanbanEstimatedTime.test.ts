import { describe, expect, it } from "vitest";
import { calculateEstimatedTimeProgress } from "./kanbanEstimatedTime";
import { calculateTaskDeadlineKpi } from "./kanbanDeadlineKpi";

describe("calculateEstimatedTimeProgress", () => {
  it("keeps the actual versus estimated hours comparison separate from the deadline", () => {
    expect(calculateEstimatedTimeProgress({ startTime: "2026-11-12T08:00", endTime: "2026-11-12T09:00", estTime: 2 })?.status).toBe("withinEstimate");
    expect(calculateEstimatedTimeProgress({ startTime: "2026-11-12T08:00", endTime: "2026-11-12T11:00", estTime: 2 })).toMatchObject({ status: "overEstimate", diff: 1 });
  });

  it("can be within estimated hours while failing the deadline KPI", () => {
    const task = { status: "Done", dueDate: "2026-11-12T08:30", startTime: "2026-11-12T08:00", endTime: "2026-11-12T09:00", estTime: 2 };
    expect(calculateEstimatedTimeProgress(task)?.status).toBe("withinEstimate");
    expect(calculateTaskDeadlineKpi(task)?.status).toBe("late");
  });

  it("requires valid working times and an estimate", () => {
    expect(calculateEstimatedTimeProgress({ startTime: "2026-11-12T11:00", endTime: "2026-11-12T08:00", estTime: 2 })).toBeNull();
    expect(calculateEstimatedTimeProgress({ startTime: "2026-11-12T08:00", endTime: "2026-11-12T09:00" })).toBeNull();
  });
});
