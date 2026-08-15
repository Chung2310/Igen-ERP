// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftScheduleNotice } from "./ShiftScheduleNotice";
import { ApiClientError } from "../../../services/apiClientError";

const scheduleError = (details: Record<string, unknown>) => new ApiClientError({
  status: 409,
  code: "SHIFT_OUTSIDE_WORK_SCHEDULE",
  message: "Chưa đến giờ làm việc của ca Hành chính (08:00–17:00).",
  details,
  requestId: "req-1",
});

describe("ShiftScheduleNotice", () => {
  afterEach(cleanup);
  const alertText = () => screen.getByRole("alert").textContent ?? "";

  it("renders nothing without an error", () => {
    const { container } = render(<ShiftScheduleNotice error={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("explains the applicable shift and window instead of echoing the raw message", () => {
    render(<ShiftScheduleNotice error={scheduleError({
      reason: "before_shift", workDate: "2026-08-13", workShiftCode: "HC", workShiftName: "Hành chính",
      scheduledStartAt: "2026-08-13T01:00:00.000Z", scheduledEndAt: "2026-08-13T10:00:00.000Z",
    })} />);

    expect(alertText()).toContain("Chưa đến giờ làm việc của bạn");
    expect(alertText()).toContain("Hành chính (HC)");
    expect(alertText()).toContain("08:00 – 17:00");
    expect(alertText()).toContain("Bạn có thể mở ca bán hàng từ 08:00.");
    expect(alertText()).not.toContain("SHIFT_OUTSIDE_WORK_SCHEDULE");
  });

  it("omits the window on a non-working day and points at the manager", () => {
    render(<ShiftScheduleNotice error={scheduleError({
      reason: "non_working_day", workDate: "2026-08-16", workShiftCode: "HC", workShiftName: "Hành chính",
    })} />);

    expect(alertText()).toContain("Hôm nay không phải ngày làm việc của bạn");
    expect(alertText()).not.toContain("Khung giờ");
    expect(alertText()).toContain("Liên hệ quản lý");
  });

  it("falls back to the plain message for any other failure", () => {
    render(<ShiftScheduleNotice error={new Error("Bạn chưa mở ca bán hàng.")} />);
    expect(alertText()).toContain("Bạn chưa mở ca bán hàng.");
  });
});
