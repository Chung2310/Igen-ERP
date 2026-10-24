// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailSettingsApi } from "../api/retailSettings.api";
import RetailSettingsPage from "./RetailSettingsPage";

vi.mock("../../../context/BranchContext", () => ({
  useBranch: () => ({ activeBranchId: "B1" }),
}));
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userProfile: { companyCode: "ACME", permissions: ["retail:manage"] } }),
}));
vi.mock("../api/retailSettings.api", () => ({
  retailSettingsApi: { get: vi.fn(), update: vi.fn() },
}));

const settings = {
  companyCode: "ACME", branchId: "B1", allowNegativeStock: false,
  maxDiscountPercent: 0, defaultTaxRate: 0, varianceReasonThreshold: 0,
  orderPrefix: "DH", invoicePrefix: "HD",
  invoicePaperSize: "A4" as const, invoiceTemplate: "standard" as const,
  customerTiers: [
    { code: "standard", name: "Thành viên", minSpend: 0 },
    { code: "vip", name: "VIP", minSpend: 50_000_000 },
  ],
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailSettingsApi.get).mockResolvedValue(settings);
  vi.mocked(retailSettingsApi.update).mockResolvedValue({ ...settings, allowNegativeStock: true });
});

describe("RetailSettingsPage", () => {
  it("loads branch settings and saves manager changes", async () => {
    render(<RetailSettingsPage />);
    const toggle = await screen.findByRole("checkbox", { name: "Cho phép bán âm kho" });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole("combobox", { name: "Khổ giấy hóa đơn" }), { target: { value: "80mm" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
    await waitFor(() => expect(retailSettingsApi.update).toHaveBeenCalledWith(
      expect.objectContaining({ allowNegativeStock: true, invoicePaperSize: "80mm", invoiceTemplate: "standard" }),
      { companyCode: "ACME", branchId: "B1" },
    ));
  });

  it("offers 58mm paper and opens a sample receipt for test printing", async () => {
    render(<RetailSettingsPage />);
    const paper = await screen.findByRole("combobox", { name: "Khổ giấy hóa đơn" }) as HTMLSelectElement;
    expect(Array.from(paper.options, (option) => option.value)).toEqual(["58mm", "80mm", "A5", "A4"]);
    fireEvent.change(paper, { target: { value: "58mm" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem trước và in thử" }));
    expect(screen.getByText(/Khách hàng in thử/)).toBeTruthy();
    expect(document.querySelector('[data-paper-size="58mm"]')).toBeTruthy();
  });
});
