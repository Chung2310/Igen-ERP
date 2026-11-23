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

test("allows jumping directly to a year via the quick year input", () => {
  const onChange = vi.fn();
  render(<AdminDatePicker label="Ngày sinh" value="" onChange={onChange} />);

  fireEvent.click(screen.getByRole("button", { name: "Ngày sinh" }));
  const calendar = screen.getByRole("dialog", { name: "Chọn ngày sinh" });
  fireEvent.change(within(calendar).getByRole("textbox", { name: "Nhập năm sinh" }), { target: { value: "1995" } });
  fireEvent.click(within(calendar).getByRole("button", { name: /Chọn ngày 15\/\d+\/1995/ }));

  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^1995-\d{2}-15$/));
});

test("shows an inline alert when a required date is submitted empty", () => {
  render(
    <form>
      <AdminDatePicker label="Thời hạn" value="" required onChange={vi.fn()} />
    </form>,
  );

  const hiddenInput = document.querySelector<HTMLInputElement>('input[type="date"]');
  expect(hiddenInput).toBeTruthy();
  fireEvent.invalid(hiddenInput!);

  expect(screen.getByRole("alert").textContent).toContain("Vui lòng chọn thời hạn.");
});
