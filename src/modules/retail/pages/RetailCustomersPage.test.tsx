// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../../customer-management/customerApi";
import RetailCustomersPage from "./RetailCustomersPage";

vi.mock("../../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "B1" }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../../customer-management/customerApi", () => ({ customerApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), detail: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(customerApi.list).mockResolvedValue({
    items: [{ _id: "1", customerCode: "KH-ACME-000001", name: "Nguyễn Văn A", phone: "0901234567", companyCode: "ACME", type: "regular" }],
    total: 1, page: 1, limit: 20,
  } as any);
});

describe("RetailCustomersPage", () => {
  it("shows company-wide customers and management actions without delete", async () => {
    render(<RetailCustomersPage />);
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("KH-ACME-000001")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm khách hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /xóa/i })).toBeNull();
  });

  it("links customer debt to the Finance receivable list with customer id", async () => {
    vi.mocked(customerApi.detail).mockResolvedValue({ _id: "1", customerCode: "KH-ACME-000001", name: "Nguyễn Văn A", companyCode: "ACME", type: "regular", phone: "0901234567", status: "active", source: "manual", createdBy: "u1", createdByName: "Admin", version: 1 } as any);
    render(<RetailCustomersPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Chi tiết" }));
    const link = await screen.findByRole("link", { name: "Xem công nợ trong Finance" });
    expect(link.getAttribute("href")).toContain("/tai-chinh?");
    expect(link.getAttribute("href")).toContain("sub=cong-no");
    expect(link.getAttribute("href")).toContain("customerId=1");
  });

  it("loads customers from the shared customer module using company scope", async () => {
    render(<RetailCustomersPage />);
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(customerApi.list).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "ACME", page: 1, limit: 20 }));
  });
});
