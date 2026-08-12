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
  useAuth: () => ({ userProfile: { companyCode: "ACME", permissions: ["retail:manager"] } }),
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
});
