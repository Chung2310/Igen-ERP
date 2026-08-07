// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getTimekeepingStatusDisplay } from "../components/dashboard/TimekeepingWidget";

describe("getTimekeepingStatusDisplay", () => {
  it("shows missing-attendance warning on working days without check-in", () => {
    const result = getTimekeepingStatusDisplay(false, false, undefined, { date: "2026-07-21", isWorkingDay: true });
    expect(result.statusText).toBe("Chưa chấm công");
    expect(result.statusColor).toBe("bg-rose-500");
  });

  it("suppresses the missing-attendance warning on non-working days without check-in", () => {
    const result = getTimekeepingStatusDisplay(false, false, undefined, {
      date: "2026-04-30",
      isWorkingDay: false,
      label: "Giỗ Tổ Hùng Vương",
    });
    expect(result.statusText).toBe("Giỗ Tổ Hùng Vương");
    expect(result.statusColor).not.toBe("bg-rose-500");
  });

  it("falls back to a generic holiday label when none is provided", () => {
    const result = getTimekeepingStatusDisplay(false, false, undefined, { date: "2026-01-04", isWorkingDay: false });
    expect(result.statusText).toBe("Ngày nghỉ");
  });

  it("still reports check-in status on a non-working day (check-in control stays available)", () => {
    const result = getTimekeepingStatusDisplay(true, false, "Late", {
      date: "2026-04-30",
      isWorkingDay: false,
      label: "Giỗ Tổ Hùng Vương",
    });
    expect(result.statusText).toBe("Đã check-in (Muộn)");
  });

  it("treats missing calendar context as a normal working day", () => {
    const result = getTimekeepingStatusDisplay(false, false, undefined, null);
    expect(result.statusText).toBe("Chưa chấm công");
  });
});
