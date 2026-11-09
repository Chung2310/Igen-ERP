// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import VietnameseDatePicker from "./VietnameseDatePicker";

afterEach(cleanup);

it("keeps required dates within the allowed range", () => {
  const onChange = vi.fn();
  const { container } = render(<div className="quotation-module"><form><VietnameseDatePicker label="Ngày nghiệm thu" value="2026-11-07" min="2026-11-05" required clearable={false} onChange={onChange} /></form></div>);
  const trigger = screen.getByRole("button", { name: "Ngày nghiệm thu: 07/11/2026" });
  expect(trigger.getAttribute("aria-required")).toBe("true");
  expect(container.querySelector<HTMLInputElement>("input[type=date]")?.required).toBe(true);
  fireEvent.click(trigger);
  const calendar = screen.getByRole("dialog", { name: "Chọn ngày: Ngày nghiệm thu" });
  expect(within(calendar).getByRole("button", { name: /ngày 4 tháng 11 năm 2026/ }).hasAttribute("disabled")).toBe(true);
  expect(within(calendar).queryByRole("button", { name: "Xóa ngày" })).toBeNull();
  fireEvent.click(within(calendar).getByRole("button", { name: /ngày 8 tháng 11 năm 2026/ }));
  expect(onChange).toHaveBeenCalledWith("2026-11-08");
});
