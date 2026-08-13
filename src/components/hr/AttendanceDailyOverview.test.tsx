// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AttendanceDailyOverview from "./AttendanceDailyOverview";
import type { AttendanceDailyOverviewResult } from "../../utils/attendanceDailyOverview";

afterEach(cleanup);

const onTime = { uid: "u1", displayName: "Nguyễn An", email: "an@igen.vn", category: "on_time" as const, checkIn: "08:00", checkOut: "17:30", status: "Đúng giờ" };
const late = { uid: "u2", displayName: "Trần Bình", email: "binh@igen.vn", category: "late" as const, checkIn: "08:45", checkOut: "--:--", status: "Đi muộn" };
const emptyGroups = { on_time: [], late: [], early: [], late_early: [], leave: [], wfh: [], absent: [], incomplete: [] };
const result: AttendanceDailyOverviewResult = {
  all: [onTime, late],
  groups: { ...emptyGroups, on_time: [onTime], late: [late] },
  counts: { all: 2, on_time: 1, late: 1, early: 0, late_early: 0, leave: 0, wfh: 0, absent: 0, incomplete: 0 },
};

describe("AttendanceDailyOverview", () => {
  it("shows daily metrics and filters employees by clicking a metric", () => {
    render(<AttendanceDailyOverview date="2026-08-13" onDateChange={vi.fn()} result={result} loading={false} />);

    expect((screen.getByLabelText("Ngày tổng quan") as HTMLInputElement).value).toBe("2026-08-13");
    expect(screen.getByText("Nguyễn An")).toBeTruthy();
    expect(screen.getByText("Trần Bình")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Đi muộn: 1/ }));
    expect(screen.queryByText("Nguyễn An")).toBeNull();
    expect(screen.getByText("Trần Bình")).toBeTruthy();
    expect(screen.getByText("--:--")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Đi muộn: 1/ }));
    expect(screen.getByText("Nguyễn An")).toBeTruthy();
  });

  it("changes dates with previous and next controls", () => {
    const onDateChange = vi.fn();
    render(<AttendanceDailyOverview date="2026-08-13" onDateChange={onDateChange} result={result} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Ngày trước" }));
    fireEvent.click(screen.getByRole("button", { name: "Ngày sau" }));
    expect(onDateChange).toHaveBeenNthCalledWith(1, "2026-08-12");
    expect(onDateChange).toHaveBeenNthCalledWith(2, "2026-08-14");
  });

  it("renders loading and empty states", () => {
    const { rerender } = render(<AttendanceDailyOverview date="2026-08-13" onDateChange={vi.fn()} result={result} loading />);
    expect(screen.getByText("Đang tải dữ liệu chấm công...")).toBeTruthy();
    rerender(<AttendanceDailyOverview date="2026-08-13" onDateChange={vi.fn()} result={{ ...result, all: [], counts: { ...result.counts, all: 0 } }} loading={false} />);
    expect(screen.getByText("Không có nhân viên phù hợp.")).toBeTruthy();
  });
});
