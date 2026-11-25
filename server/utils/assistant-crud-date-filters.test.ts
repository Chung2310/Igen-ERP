import { describe, expect, it } from "vitest";
import { applyAssistantCrudDateFilters } from "./assistant-crud-date-filters";

describe("assistant CRUD date range filters", () => {
  it('filters submission dates using Vietnam day boundaries, independently of leave dates', () => {
    const result = applyAssistantCrudDateFilters('hr-leave-applications', { createdFrom: '2026-11-23', createdTo: '2026-11-23', requestKind: 'leave' });
    expect(result).toEqual({ requestKind: 'leave', createdAt: { $gte: new Date('2026-11-22T17:00:00Z'), $lte: new Date('2026-11-23T16:59:59.999Z') } });
    expect(result).not.toHaveProperty('startDate');
    expect(result).not.toHaveProperty('createdFrom');
  });
  it.each([{ createdFrom: '2026-02-30' }, { createdTo: 'yesterday' }, { createdFrom: '2026-11-24', createdTo: '2026-11-23' }])('fails closed on invalid created-date bounds %j', bounds => {
    expect(() => applyAssistantCrudDateFilters('hr-leave-applications', bounds)).toThrow('Khoảng ngày gửi không hợp lệ');
  });
  it('intersects an existing creation-date restriction instead of replacing it', () => {
    const result = applyAssistantCrudDateFilters('hr-leave-applications', { createdFrom: '2026-11-23', createdAt: { $lt: new Date('2026-11-23T12:00:00Z') } });
    expect(result.$and).toEqual([{ createdAt: { $lt: new Date('2026-11-23T12:00:00Z') } }, { createdAt: { $gte: new Date('2026-11-22T17:00:00Z') } }]);
  });
  it("filters calendar and leave records by interval overlap", () => {
    const result = applyAssistantCrudDateFilters("hr-calendar-events", {
      rangeStart: "2026-11-01", rangeEnd: "2026-11-30", type: "event",
    });
    expect(result).toMatchObject({
      type: "event",
      startDate: { $lte: new Date("2026-11-30T16:59:59.999Z") },
      endDate: { $gte: new Date("2026-10-31T17:00:00.000Z") },
    });
    expect(result).not.toHaveProperty("rangeStart");
    expect(result).not.toHaveProperty("rangeEnd");
  });

  it("includes early morning Vietnam events and excludes the next local day", () => {
    const result = applyAssistantCrudDateFilters("hr-calendar-events", { rangeStart: "2028-03-01", rangeEnd: "2028-03-01" });
    const overlaps = (start: string, end = start) => new Date(start) <= (result.startDate as { $lte: Date }).$lte
      && new Date(end) >= (result.endDate as { $gte: Date }).$gte;
    expect(overlaps("2028-02-29T17:00:00.000Z")).toBe(true);
    expect(overlaps("2028-03-01T16:59:59.999Z")).toBe(true);
    expect(overlaps("2028-03-01T17:00:00.000Z")).toBe(false);
    expect(overlaps("2028-02-29T16:00:00.000Z", "2028-02-29T18:00:00.000Z")).toBe(true);
  });

  it("preserves the date-only convention for leave applications", () => {
    expect(applyAssistantCrudDateFilters("hr-leave-applications", { rangeStart: "2028-03-01", rangeEnd: "2028-03-01" })).toMatchObject({
      startDate: { $lte: new Date("2028-03-01T23:59:59.999Z") }, endDate: { $gte: new Date("2028-03-01T00:00:00.000Z") },
    });
  });

  it("leaves unrelated CRUD models and invalid date ranges unchanged", () => {
    const unrelated = { rangeStart: "2026-11-01", rangeEnd: "2026-11-30" };
    expect(applyAssistantCrudDateFilters("projects", unrelated)).toBe(unrelated);
    expect(applyAssistantCrudDateFilters("hr-leave-applications", { rangeStart: "bad", type: "leave" })).toEqual({ type: "leave" });
  });
});
