// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DateInput24, DateTimeInput24 } from "./TimeInput24";

afterEach(cleanup);

test("selecting a date in the Vietnamese calendar preserves the chosen time", () => {
  const onChange = vi.fn();
  render(<DateTimeInput24 value="2026-10-16T09:30" onChange={onChange} />);

  expect(screen.getByText("16/10/2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Chọn ngày giờ - ngày" }));
  const calendar = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
  expect(within(calendar).getByText("tháng 10 năm 2026")).toBeTruthy();
  fireEvent.click(within(calendar).getByRole("button", { name: "Chọn ngày 18/10/2026" }));

  expect(onChange).toHaveBeenCalledWith("2026-10-18T09:30");
  expect(screen.queryByRole("dialog", { name: "Lịch chọn ngày" })).toBeNull();
});

test("birth date can jump directly to an earlier year", () => {
  const onChange = vi.fn();
  render(<DateInput24 ariaLabel="Ngày sinh" value="" onChange={onChange} showYearSelect />);

  fireEvent.click(screen.getByRole("button", { name: "Ngày sinh" }));
  const calendar = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
  fireEvent.change(within(calendar).getByRole("combobox", { name: "Chọn năm sinh" }), { target: { value: "1990" } });
  fireEvent.click(within(calendar).getByRole("button", { name: /Chọn ngày 15\/\d+\/1990/ }));

  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^1990-\d{2}-15$/));
});

test("date and time menus stay inside their parent modal", () => {
  render(<dialog open aria-label="Tạo chính sách"><DateTimeInput24 ariaLabel="Hiệu lực" value="" onChange={vi.fn()} /></dialog>);
  const modal = screen.getByRole("dialog", { name: "Tạo chính sách" });

  fireEvent.click(screen.getByRole("button", { name: "Hiệu lực - ngày" }));
  const calendar = screen.getByRole("dialog", { name: "Lịch chọn ngày" });
  expect(modal.contains(calendar)).toBe(true);
  fireEvent.keyDown(calendar, { key: "Escape", cancelable: true });
  expect(screen.queryByRole("dialog", { name: "Lịch chọn ngày" })).toBeNull();
  expect(modal.hasAttribute("open")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Hiệu lực - giờ" }));
  expect(modal.contains(screen.getByRole("dialog", { name: "Chọn hiệu lực - giờ" }))).toBe(true);
});
