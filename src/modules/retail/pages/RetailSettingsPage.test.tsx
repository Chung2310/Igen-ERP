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
    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));
    await waitFor(() => expect(retailSettingsApi.update).toHaveBeenCalledWith(
      expect.objectContaining({ allowNegativeStock: true }),
      { companyCode: "ACME", branchId: "B1" },
    ));
  });
});
