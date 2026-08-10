// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailCustomersApi } from "../api/retailCustomers.api";
import RetailCustomersPage from "./RetailCustomersPage";

vi.mock("../../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId: "B1" }) }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: { companyCode: "ACME" } }) }));
vi.mock("../api/retailCustomers.api", () => ({ retailCustomersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), detail: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailCustomersApi.list).mockResolvedValue({
    items: [{ _id: "1", customerCode: "KH-ACME-000001", name: "Nguyễn Văn A", phone: "0901234567", companyCode: "ACME", originBranchId: "B1" }],
    total: 1, page: 1, limit: 20,
  });
});

describe("RetailCustomersPage", () => {
  it("shows company-wide customers and management actions without delete", async () => {
    render(<RetailCustomersPage />);
    expect(await screen.findByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.getByText("KH-ACME-000001")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm khách hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /xóa/i })).toBeNull();
  });
});
