// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AdminDatePicker } from "./AdminDatePicker";

afterEach(cleanup);

test("shows a Vietnamese calendar and enforces the selected date range", () => {
  const onChange = vi.fn();
  render(<AdminDatePicker label="Từ ngày" value="2026-10-16" min="2026-10-15" max="2026-10-20" onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Từ ngày" }));
  const calendar = screen.getByRole("dialog", { name: "Chọn từ ngày" });
  expect(within(calendar).getByText("tháng 10 năm 2026")).toBeTruthy();
  expect(within(calendar).getByRole("button", { name: "Chọn ngày 14/10/2026" }).hasAttribute("disabled")).toBe(true);

  fireEvent.click(within(calendar).getByRole("button", { name: "Chọn ngày 18/10/2026" }));
  expect(onChange).toHaveBeenCalledWith("2026-10-18");
  expect(screen.queryByRole("dialog", { name: "Chọn từ ngày" })).toBeNull();
});
