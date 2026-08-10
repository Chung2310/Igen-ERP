// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RetailDiscountInput } from "../../types";
import OrderAdjustments from "./OrderAdjustments";

afterEach(cleanup);

describe("OrderAdjustments", () => {
  it("edits discount type, tax rate and integer shipping fee", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = React.useState<{ orderDiscount: RetailDiscountInput; taxRate: number; shippingFee: number }>({ orderDiscount: { type: "amount", value: 0 }, taxRate: 0, shippingFee: 0 });
      return <OrderAdjustments {...value} onChange={(next) => { onChange(next); setValue(next); }} />;
    }
    render(<Harness />);
    const discountGroup = screen.getByRole("group", { name: "Giảm giá đơn" });
    const discountType = within(discountGroup).getByRole("combobox", { name: "Loại giảm giá đơn" });
    const discountValue = within(discountGroup).getByRole("spinbutton", { name: "Giảm giá đơn" });
    await userEvent.selectOptions(discountType, "percent");
    await userEvent.clear(discountValue);
    await userEvent.type(discountValue, "5");
    await userEvent.clear(screen.getByLabelText("Thuế suất"));
    await userEvent.type(screen.getByLabelText("Thuế suất"), "8.25");
    await userEvent.clear(screen.getByLabelText("Phí vận chuyển"));
    await userEvent.type(screen.getByLabelText("Phí vận chuyển"), "12000.9");

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ orderDiscount: { type: "percent", value: 0 } }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ taxRate: 8.25 }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ shippingFee: 12000 }));
  });
});
