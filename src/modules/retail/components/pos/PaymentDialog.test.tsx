// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentDialog from "./PaymentDialog";

afterEach(cleanup);

describe("PaymentDialog", () => {
  it("defaults to full payment and exposes three explicit modes", () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Thanh toán đủ" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Thanh toán một phần" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ghi nợ toàn bộ" })).toBeTruthy();
    expect((screen.getByRole("spinbutton", { name: "Số tiền 1" }) as HTMLInputElement).value).toBe("500000");
  });

  it("submits actual collections and due date in partial mode", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán một phần" }));
    const amount = screen.getByRole("spinbutton", { name: "Số tiền 1" });
    await userEvent.clear(amount);
    await userEvent.type(amount, "200000");
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Tiền khách đưa 1" }));
    await userEvent.type(screen.getByRole("spinbutton", { name: "Tiền khách đưa 1" }), "200000");
    await userEvent.type(screen.getByLabelText("Hạn thanh toán"), "2026-09-30");
    expect(screen.getByText("300.000 ₫")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([{ method: "cash", amount: 200_000, tenderedAmount: 200_000 }], "2026-09-30"));
  });

  it("requires customer and due date for debt modes", async () => {
    const onSubmit = vi.fn();
    render(<PaymentDialog total={500_000} busy={false} onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/khách hàng/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides payment rows and submits an empty list for full debt", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    expect(screen.queryByRole("spinbutton", { name: "Số tiền 1" })).toBeNull();
    await userEvent.type(screen.getByLabelText("Hạn thanh toán"), "2026-09-30");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([], "2026-09-30"));
  });

  it("resets to a valid full cash payment when switching back to full", async () => {
    render(<PaymentDialog total={500_000} busy={false} customerId="c1" onClose={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Ghi nợ toàn bộ" }));
    await userEvent.click(screen.getByRole("button", { name: "Thanh toán đủ" }));
    expect((screen.getByRole("spinbutton", { name: "Số tiền 1" }) as HTMLInputElement).value).toBe("500000");
  });
});
