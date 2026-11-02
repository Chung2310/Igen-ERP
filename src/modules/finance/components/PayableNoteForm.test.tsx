// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { financeManagement } from "../api/financeManagement.api";
import PayableNoteForm from "./PayableNoteForm";
vi.mock("../api/financeManagement.api", () => ({ financeManagement: vi.fn() }));
const receipts = [{ _id: "a".repeat(24), receiptCode: "PN-001", supplierName: "NCC A", subtotal: 1200000 }];
beforeEach(() => { vi.clearAllMocks(); vi.mocked(financeManagement).mockResolvedValue({ payableCode: "GN-EXAMPLE" }); });
afterEach(cleanup);

it("requires choosing a receipt, previews the debt and saves only to Finance", async () => {
  const onSaved = vi.fn(), onClose = vi.fn();
  render(<PayableNoteForm receipts={receipts} onSaved={onSaved} onClose={onClose} />);
  expect(screen.getByRole("button", { name: "Lưu phiếu ghi nợ" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Phiếu nhập kho"), { target: { value: receipts[0]._id } });
  fireEvent.change(screen.getByLabelText("Hạn trả"), { target: { value: "2026-10-10" } });
  fireEvent.change(screen.getByLabelText("Đã thanh toán trước đó (VND)"), { target: { value: "200000" } });
  expect(screen.getByText("1.000.000 đ")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu ghi nợ" }));
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(financeManagement).toHaveBeenCalledExactlyOnceWith("/payables", { receiptId: receipts[0]._id, dueDate: "2026-10-10", openingPaid: 200000, note: "" });
  expect(onClose).toHaveBeenCalledOnce();
});

it("blocks amounts exceeding the receipt and keeps the form open on failure", async () => {
  const onClose = vi.fn();
  render(<PayableNoteForm receipts={receipts} onSaved={vi.fn()} onClose={onClose} />);
  fireEvent.change(screen.getByLabelText("Phiếu nhập kho"), { target: { value: receipts[0]._id } });
  fireEvent.change(screen.getByLabelText("Hạn trả"), { target: { value: "2026-10-10" } });
  fireEvent.change(screen.getByLabelText("Đã thanh toán trước đó (VND)"), { target: { value: "1300000" } });
  expect(screen.getByRole("button", { name: "Lưu phiếu ghi nợ" }).hasAttribute("disabled")).toBe(true);
  expect(financeManagement).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Đã thanh toán trước đó (VND)"), { target: { value: "0" } });
  vi.mocked(financeManagement).mockRejectedValueOnce(new Error("Phiếu nhập đã được ghi nợ."));
  fireEvent.click(screen.getByRole("button", { name: "Lưu phiếu ghi nợ" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Phiếu nhập đã được ghi nợ.");
  expect(onClose).not.toHaveBeenCalled();
});
