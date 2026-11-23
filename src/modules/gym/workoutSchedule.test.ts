import { describe, expect, it } from "vitest";
import { hasScheduleOverlap, nextAvailableMinute, validSchedule } from "./workoutSchedule";

describe("lịch Studio giáo án", () => {
  it("xếp bài vào khoảng trống đầu tiên khi cuối ngày đã kín", () => {
    const items = [
      { key: "morning", weekNumber: 1, dayNumber: 1, startMinute: 0, durationMinutes: 60 },
      { key: "night", weekNumber: 1, dayNumber: 1, startMinute: 1380, durationMinutes: 60 },
    ];
    expect(nextAvailableMinute(items, 1, 1)).toBe(60);
    expect(hasScheduleOverlap(items, { key: "new", weekNumber: 1, dayNumber: 1, startMinute: 30, durationMinutes: 60 })).toBe(true);
    expect(validSchedule(items)).toBe(true);
    expect(validSchedule([...items, { key: "overlap", weekNumber: 1, dayNumber: 1, startMinute: 30, durationMinutes: 60 }])).toBe(false);
  });

  it("không lẫn giờ giữa hai ngày hoặc hai tuần và chặn vượt quá 24 giờ", () => {
    const items = [{ key: "first", weekNumber: 1, dayNumber: 1, startMinute: 1380, durationMinutes: 60 }];
    expect(nextAvailableMinute(items, 2, 1)).toBe(0);
    expect(nextAvailableMinute(items, 1, 2)).toBe(0);
    expect(validSchedule([{ key: "late", weekNumber: 1, dayNumber: 1, startMinute: 1400, durationMinutes: 60 }])).toBe(false);
  });
});
