// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "./customerApi";
import { retailCustomerApi } from "./retailCustomerApi";
import CustomerWorkspace from "./CustomerWorkspace";

let profile: any;
let activeBranchId: string;
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: profile }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId }) }));
vi.mock("./customerApi", () => ({ customerApi: { list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), billingProfiles: vi.fn(), createBillingProfile: vi.fn(), purchaseHistory: vi.fn() } }));
vi.mock("./retailCustomerApi", () => ({ retailCustomerApi: { pointPolicy: vi.fn(), updatePointPolicy: vi.fn(), points: vi.fn(), adjustPoints: vi.fn(), receivables: vi.fn() } }));

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
  vi.mocked(customerApi.purchaseHistory).mockResolvedValue({ summary: { orderCount: 0, totalPurchased: 0, totalPaid: 0, currentDebt: 0 }, items: [], devices: [] });
  vi.mocked(retailCustomerApi.pointPolicy).mockResolvedValue({ enabled: true, earnVndPerPoint: 10000, redeemVndPerPoint: 1000, maxRedeemPercent: 50, version: 1 });
  vi.mocked(retailCustomerApi.points).mockResolvedValue({ balance: 120, totalEarned: 200, totalRedeemed: 80, ledger: [] });
  vi.mocked(retailCustomerApi.receivables).mockResolvedValue({ items: [], total: 0, page: 1, limit: 100, currentBalance: 100000 });
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
    expect(await screen.findByText("Chọn chi nhánh để xem số liệu mua hàng và công nợ.")).toBeTruthy();
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

  it("shows POS point redemption policy and reads the retail receivable ledger", async () => {
    profile = { companyCode: "IGEN", role: "admin", permissions: ["customer:manage", "retail:manage", "retail-points:manage"] };
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    fireEvent.click(await screen.findByRole("button", { name: /Điểm thưởng/ }));
    expect(await screen.findByText("120 điểm")).toBeTruthy();
    expect(retailCustomerApi.points).toHaveBeenCalledWith({ companyCode: "IGEN", branchId: "b1" }, "c1");
    expect(screen.getByText(/1 điểm cấn trừ 1\.000 ₫ trên đơn/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Công nợ/ }));
    await waitFor(() => expect(retailCustomerApi.receivables).toHaveBeenCalledWith({ companyCode: "IGEN", branchId: "b1" }, "c1"));
    expect(screen.queryByRole("button", { name: "Cấn trừ tiền" })).toBeNull();
  });

  it("adds a VAT billing profile from the customer detail page", async () => {
    vi.mocked(customerApi.createBillingProfile).mockResolvedValue({ profile: { _id: "vat1" } as any, warnings: [] });
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    await screen.findByRole("heading", { name: "Nguyễn Văn An" });
    fireEvent.click(screen.getByRole("button", { name: /Hồ sơ VAT/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Thêm hồ sơ VAT" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Tên pháp nhân/ }), { target: { value: "Công ty An" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Mã số thuế/ }), { target: { value: "0123456789" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Địa chỉ hóa đơn/ }), { target: { value: "Hà Nội" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Email nhận hóa đơn/ }), { target: { value: "invoice@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ VAT" }));
    await waitFor(() => expect(customerApi.createBillingProfile).toHaveBeenCalledWith("c1", expect.objectContaining({ legalName: "Công ty An", taxId: "0123456789", invoiceEmail: "invoice@example.com" }), "IGEN"));
    expect(await screen.findByText("Đã thêm hồ sơ VAT.")).toBeTruthy();
  });

  it("creates a VAT customer with a default billing profile for retail POS", async () => {
    const created = { ...customer, _id: "c2", customerCode: "KH-IGEN-000002", type: "vat" as const, name: "Công ty An", version: 0 };
    vi.mocked(customerApi.create).mockResolvedValue(created);
    vi.mocked(customerApi.createBillingProfile).mockResolvedValue({ profile: { _id: "vat2" } as any, warnings: [] });
    vi.mocked(customerApi.detail).mockImplementation(async (id) => id === "c2" ? { ...created, version: 1 } : customer);
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Thêm khách hàng" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Họ và tên/ }), { target: { value: "Công ty An" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Số điện thoại/ }), { target: { value: "0901000002" } });
    fireEvent.click(screen.getByRole("button", { name: "Loại khách" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Chọn loại khách" })).getByRole("option", { name: "Khách xuất VAT" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Tên pháp nhân/ }), { target: { value: "Công ty An" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Mã số thuế/ }), { target: { value: "0123456789" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Địa chỉ hóa đơn/ }), { target: { value: "Hà Nội" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Email nhận hóa đơn/ }), { target: { value: "invoice@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));
    await waitFor(() => expect(customerApi.createBillingProfile).toHaveBeenCalledWith("c2", expect.objectContaining({ legalName: "Công ty An", taxId: "0123456789", invoiceEmail: "invoice@example.com", isDefault: true }), "IGEN"));
    expect(await screen.findByRole("heading", { name: "Công ty An" })).toBeTruthy();
    expect(customerApi.detail).toHaveBeenCalledWith("c2", "IGEN");
  });
});
