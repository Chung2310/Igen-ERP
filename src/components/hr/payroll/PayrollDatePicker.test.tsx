// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PayrollDatePicker } from "./PayrollDatePicker";

afterEach(cleanup);

test("shows Vietnamese dates and keeps ISO values for the payroll form", () => {
  const onChange = vi.fn();
  render(<PayrollDatePicker label="Hiệu lực từ" value="2026-10-17" onChange={onChange} />);

  expect(screen.getByRole("button", { name: "Hiệu lực từ" }).textContent).toContain("17/10/2026");
  fireEvent.click(screen.getByRole("button", { name: "Hiệu lực từ" }));
  const calendar = screen.getByRole("dialog", { name: "Chọn hiệu lực từ" });
  fireEvent.click(within(calendar).getByRole("button", { name: "18/10/2026" }));

  expect(onChange).toHaveBeenCalledWith("2026-10-18");
  expect(screen.queryByRole("dialog", { name: "Chọn hiệu lực từ" })).toBeNull();
});
