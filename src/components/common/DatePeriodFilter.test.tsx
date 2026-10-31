// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePeriodFilter } from "./DatePeriodFilter";
import { emptyDatePeriodFilter, getCurrentMonthString, getTodayDateString } from "../../utils/datePeriodFilter";

afterEach(cleanup);

describe("DatePeriodFilter component", () => {
  it("renders preset buttons and indicates 'Tất cả' when empty", () => {
    const onChange = vi.fn();
    render(
      <DatePeriodFilter
        label="thời gian phiếu nhập"
        value={emptyDatePeriodFilter()}
        onChange={onChange}
      />,
    );

    const allBtn = screen.getByRole("button", { name: "Tất cả" });
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");

    const todayBtn = screen.getByRole("button", { name: "Hôm nay" });
    expect(todayBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with today when clicking 'Hôm nay'", () => {
    const onChange = vi.fn();
    render(
      <DatePeriodFilter
        label="thời gian phiếu nhập"
        value={emptyDatePeriodFilter()}
        onChange={onChange}
      />,
    );

    const todayBtn = screen.getByRole("button", { name: "Hôm nay" });
    fireEvent.click(todayBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "day",
        day: getTodayDateString(),
      }),
    );
  });

  it("calls onChange with current month when clicking 'Tháng này'", () => {
    const onChange = vi.fn();
    render(
      <DatePeriodFilter
        label="thời gian phiếu nhập"
        value={emptyDatePeriodFilter()}
        onChange={onChange}
      />,
    );

    const thisMonthBtn = screen.getByRole("button", { name: "Tháng này" });
    fireEvent.click(thisMonthBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "month",
        month: getCurrentMonthString(),
      }),
    );
  });

  it("opens popover dialog when clicking 'Tùy chọn'", () => {
    const onChange = vi.fn();
    render(
      <DatePeriodFilter
        label="thời gian phiếu nhập"
        value={emptyDatePeriodFilter()}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Tùy chọn thời gian/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const dialog = screen.getByRole("dialog");
    expect(dialog).not.toBeNull();
    expect(screen.getByText("Khoảng ngày")).not.toBeNull();
    expect(screen.getByText("Chọn theo tháng")).not.toBeNull();
  });
});
