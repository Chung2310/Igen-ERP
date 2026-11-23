// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { Contract } from "./types";

vi.mock("./api", () => ({
  api: vi.fn(),
  createGeneratedExport: vi.fn(),
  formatMoney: (value: number) => String(value),
  hasQuotationCapability: () => false,
}));

import { AcceptanceCreationDialog } from "./DocumentDialogs";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(cleanup);

const contract = {
  _id: "contract-1",
  contractNumber: "HD-001",
  quoteId: "quote-1",
  signedDate: "2026-11-01",
  signingPlace: "Hà Nội",
  currency: "USD",
  total: 100,
  depositAmount: 0,
  deliverables: "Thiết bị",
  lines: [{ catalogItemId: "item-1", name: "Máy tính", quantity: 3, unit: "cái", sku: "PC-01", currency: "USD", unitPrice: 100, lineTotal: 300, attributes: {} }],
} as unknown as Contract;

it("shows editable acceptance details for each product in the creation dialog", () => {
  render(<AcceptanceCreationDialog contract={contract} onClose={vi.fn()} onCreated={vi.fn()} notify={vi.fn()} />);

  expect(screen.getByRole("region", { name: "Sản phẩm và thông tin nghiệm thu" })).toBeTruthy();
  expect(screen.getByText("Máy tính")).toBeTruthy();
  expect(screen.getByText("3 cái")).toBeTruthy();

  const acceptedQuantity = screen.getByLabelText("Số lượng nghiệm thu thực tế") as HTMLInputElement;
  const acceptedDetails = screen.getByLabelText("Thông tin nghiệm thu sản phẩm") as HTMLInputElement;
  expect(acceptedQuantity.disabled).toBe(true);
  expect(acceptedDetails.disabled).toBe(false);

  fireEvent.change(acceptedDetails, { target: { value: "Đã bàn giao nguyên vẹn" } });
  fireEvent.click(screen.getByLabelText("Đưa vào nghiệm thu"));
  expect(acceptedQuantity.disabled).toBe(false);
  expect(acceptedQuantity.value).toBe("3");
  expect(acceptedDetails.value).toBe("Đã bàn giao nguyên vẹn");
});
