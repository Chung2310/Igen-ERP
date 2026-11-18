import { describe, expect, it } from "vitest";
import { applyAssistantCrudDateFilters } from "./assistant-crud-date-filters";

describe("assistant CRUD date range filters", () => {
  it("filters calendar and leave records by interval overlap", () => {
    const result = applyAssistantCrudDateFilters("hr-calendar-events", {
      rangeStart: "2026-11-01", rangeEnd: "2026-11-30", type: "event",
    });
    expect(result).toMatchObject({
      type: "event",
      startDate: { $lte: new Date("2026-11-30T23:59:59.999Z") },
      endDate: { $gte: new Date("2026-11-01T00:00:00.000Z") },
    });
    expect(result).not.toHaveProperty("rangeStart");
    expect(result).not.toHaveProperty("rangeEnd");
  });

  it("leaves unrelated CRUD models and invalid date ranges unchanged", () => {
    const unrelated = { rangeStart: "2026-11-01", rangeEnd: "2026-11-30" };
    expect(applyAssistantCrudDateFilters("projects", unrelated)).toBe(unrelated);
    expect(applyAssistantCrudDateFilters("hr-leave-applications", { rangeStart: "bad", type: "leave" })).toEqual({ type: "leave" });
  });
});
