// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DateTimeInput24 } from "./TimeInput24";

afterEach(cleanup);

test("selecting a date in the Vietnamese calendar preserves the chosen time", () => {
  const onChange = vi.fn();
  render(<DateTimeInput24 value="2026-10-16T09:30" onChange={onChange} />);

  expect(screen.getByText("16/10/2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày" }));
  const calendar = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
  expect(within(calendar).getByText("tháng 10 năm 2026")).toBeTruthy();
  fireEvent.click(within(calendar).getByRole("button", { name: "Chọn ngày 18/10/2026" }));

  expect(onChange).toHaveBeenCalledWith("2026-10-18T09:30");
  expect(screen.queryByRole("dialog", { name: "Lịch chọn ngày" })).toBeNull();
});
