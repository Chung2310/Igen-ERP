// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuantityInput } from "./QuantityInput";

afterEach(cleanup);

describe("QuantityInput", () => {
  it("keeps the cart line while its quantity input is temporarily empty", () => {
    const onQuantityChange = vi.fn();
    render(<QuantityInput ariaLabel="Số lượng Áo" value={1} onQuantityChange={onQuantityChange} />);

    const input = screen.getByRole("spinbutton", { name: "Số lượng Áo" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "5" } });

    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith(5);
  });

  it("confirms removal when the empty quantity input loses focus", () => {
    const onQuantityChange = vi.fn();
    render(<QuantityInput ariaLabel="Số lượng Áo" value={1} onQuantityChange={onQuantityChange} />);

    const input = screen.getByRole("spinbutton", { name: "Số lượng Áo" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onQuantityChange).toHaveBeenCalledWith(0);
  });
});
