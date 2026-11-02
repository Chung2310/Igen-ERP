// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HrScheduleTab from "./HrScheduleTab";

vi.mock("./CalendarTab", () => ({ default: () => <div>Chấm công</div> }));
vi.mock("../settings/WorkShiftsTab", () => ({ default: () => <div>Danh sách ca</div> }));
vi.mock("../settings/CompanyWorkCalendarTab", () => ({ default: () => <div>Ngày nghỉ lễ</div> }));
vi.mock("../settings/EmployeeWorkHoursTab", () => ({ default: () => <div>Giờ riêng</div> }));

const props = { userProfile: null, selectedCompanyCode: "ACME", usersList: [], employees: [], isManager: false, canManageAttendance: false, canEditAttendance: false, canManageTimekeeping: false, canManageCalendar: false };

describe("HR schedule navigation", () => {
  it("keeps configuration tabs hidden for employees and available to authorized managers", () => {
    const { rerender } = render(<HrScheduleTab {...props} />);
    expect(screen.getByText("Chấm công")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ca làm việc" })).toBeNull();
    rerender(<HrScheduleTab {...props} canManageTimekeeping canManageCalendar />);
    fireEvent.click(screen.getByRole("button", { name: "Ca làm việc" }));
    expect(screen.getByText("Danh sách ca")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lịch nghỉ lễ" }));
    expect(screen.getByText("Ngày nghỉ lễ")).toBeTruthy();
  });
});
