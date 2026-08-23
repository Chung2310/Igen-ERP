// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "./customerApi";
import CustomerWorkspace from "./CustomerWorkspace";

let profile: any;
let activeBranchId: string;
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: profile }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId }) }));
vi.mock("./customerApi", () => ({ customerApi: { list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), billingProfiles: vi.fn(), createBillingProfile: vi.fn(), purchaseHistory: vi.fn() } }));

const customer = {
  _id: "c1", companyCode: "IGEN", customerCode: "KH-IGEN-000001", type: "regular" as const,
  name: "Nguyễn Văn An", phone: "0901000001", email: "an@example.com", status: "active" as const,
  source: "manual" as const, createdBy: "u1", createdByName: "Admin", version: 0,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  profile = { companyCode: "IGEN", role: "user", permissions: ["customer:manage"] };
  activeBranchId = "b1";
  vi.mocked(customerApi.list).mockResolvedValue({ items: [customer], total: 1, page: 1, limit: 20 });
  vi.mocked(customerApi.detail).mockResolvedValue(customer);
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([]);
  vi.mocked(customerApi.purchaseHistory).mockResolvedValue({ summary: { orderCount: 0, totalPurchased: 0, totalPaid: 0, currentDebt: 0 }, items: [] });
});

describe("CustomerWorkspace purchase history", () => {
  it("loads purchase history for the active selected branch when opening a customer", async () => {
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    await waitFor(() => expect(customerApi.purchaseHistory).toHaveBeenCalledWith("c1", { companyCode: "IGEN", branchId: "b1" }));
  });

  it("shows the branch selection prompt without requesting history when no branch is active", async () => {
    activeBranchId = "";
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    expect(await screen.findByText("Vui lòng chọn chi nhánh để xem lịch sử mua hàng.")).toBeTruthy();
    expect(customerApi.purchaseHistory).not.toHaveBeenCalled();
  });
});

describe("CustomerWorkspace", () => {
  it("loads company-wide active customers and offers management actions", async () => {
    render(<CustomerWorkspace />);
    expect(await screen.findByText("Nguyễn Văn An")).toBeTruthy();
    expect(customerApi.list).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "IGEN", status: "active" }));
    expect(screen.getByRole("button", { name: "Thêm khách hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /xóa/i })).toBeNull();
  });

  it("debounces search and applies status and type filters", async () => {
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.change(screen.getByLabelText("Tìm khách hàng"), { target: { value: "0901" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "inactive" } });
    fireEvent.change(screen.getByLabelText("Loại khách"), { target: { value: "vat" } });
    await waitFor(() => expect(customerApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "0901", status: "inactive", type: "vat" })), { timeout: 1000 });
  });

  it("renders read-only mode without mutation controls", async () => {
    profile = { companyCode: "IGEN", role: "user", permissions: ["customer:read"] };
    render(<CustomerWorkspace />);
    expect(await screen.findByText("Nguyễn Văn An")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm khách hàng" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    expect(await screen.findByRole("heading", { name: "Nguyễn Văn An" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sửa hồ sơ" })).toBeNull();
  });
});
