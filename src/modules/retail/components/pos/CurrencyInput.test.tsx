// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CurrencyInput from "./CurrencyInput";

afterEach(cleanup);

describe("CurrencyInput", () => {
  it("shows a visible label, description and Vietnamese formatted value", () => {
    render(<CurrencyInput label="Số tiền thu" description="Khoản được ghi nhận vào đơn." value={500_000} onChange={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Số tiền thu" }) as HTMLInputElement;
    expect(input.value).toBe("500.000");
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("numeric");
    expect(screen.getByText("Khoản được ghi nhận vào đơn.")).toBeTruthy();
    expect(screen.getByText("₫")).toBeTruthy();
  });

  it("normalizes typed or pasted currency text to an integer", () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Số tiền thu" value={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Số tiền thu" }), { target: { value: "1.234.567 ₫" } });
    expect(onChange).toHaveBeenLastCalledWith(1_234_567);
  });

  it("maps an empty value to zero", () => {
    const onChange = vi.fn();
    render(<CurrencyInput label="Số tiền thu" value={500_000} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Số tiền thu" }), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
