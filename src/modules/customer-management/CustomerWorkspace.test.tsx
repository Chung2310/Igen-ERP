// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "./customerApi";
import { retailCustomerApi } from "./retailCustomerApi";
import CustomerWorkspace from "./CustomerWorkspace";
import { CustomerSourceTransferAction } from "./components/CustomerSourceTransferAction";

let profile: any;
let activeBranchId: string;
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ userProfile: profile }) }));
vi.mock("../../context/BranchContext", () => ({ useBranch: () => ({ activeBranchId }) }));
vi.mock("./customerApi", () => ({ customerApi: { list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), billingProfiles: vi.fn(), createBillingProfile: vi.fn(), purchaseHistory: vi.fn(), moduleLinks: vi.fn(), linkedModules: vi.fn(), leadNeeds: vi.fn(), sourceQueue: vi.fn(), sourceTransferSetting: vi.fn(), setSourceTransferHidden: vi.fn(), sourceBatchPreview: vi.fn(), sourceBatchTransfer: vi.fn(), sourceCustomerCandidates: vi.fn(), importSourceRecord: vi.fn() } }));
vi.mock("./retailCustomerApi", () => ({ retailCustomerApi: { pointPolicy: vi.fn(), updatePointPolicy: vi.fn(), points: vi.fn(), adjustPoints: vi.fn(), receivables: vi.fn() } }));

const customer = {
  _id: "c1", companyCode: "IGEN", customerCode: "KH-IGEN-000001", type: "regular" as const,
  name: "Nguyễn Văn An", phone: "0901000001", email: "an@example.com", status: "active" as const,
  source: "manual" as const, createdBy: "u1", createdByName: "Admin", version: 0,
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/quan-ly-khach-hang");
  profile = { companyCode: "IGEN", role: "user", permissions: ["customer:manage", "retail:read"] };
  activeBranchId = "b1";
  vi.mocked(customerApi.list).mockResolvedValue({ items: [customer], total: 1, page: 1, limit: 20 });
  vi.mocked(customerApi.detail).mockResolvedValue(customer);
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([]);
  vi.mocked(customerApi.purchaseHistory).mockResolvedValue({ summary: { orderCount: 0, totalPurchased: 0, totalPaid: 0, currentDebt: 0 }, items: [], devices: [] });
  vi.mocked(customerApi.moduleLinks).mockResolvedValue({ modules: ["students"], manageable: ["students"], links: [] });
  vi.mocked(customerApi.linkedModules).mockResolvedValue({});
  vi.mocked(customerApi.leadNeeds).mockResolvedValue([{ id: "lead1", productOfChoice: "Tư vấn nhập học" }]);
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
  it("transfers ready rows and asks which existing customer to link for a shared phone", async () => {
    const refs = [{ module: "students" as const, sourceId: "student1" }, { module: "students" as const, sourceId: "student2" }];
    vi.mocked(customerApi.sourceTransferSetting).mockResolvedValue({ hidden: false });
    vi.mocked(customerApi.sourceQueue).mockResolvedValue({ hasMore: false, items: [
      { id: "student1", name: customer.name, phone: customer.phone, dateOfBirth: "2001-01-09" },
      { id: "student2", name: "Lê Mai", phone: "0971111111" },
    ] });
    vi.mocked(customerApi.sourceBatchPreview).mockResolvedValue([{ ...refs[0], status: "shared-customer-phone" }, { ...refs[1], status: "ready" }]);
    vi.mocked(customerApi.sourceBatchTransfer).mockResolvedValue([{ ...refs[0], status: "shared-customer-phone" }, { ...refs[1], status: "transferred" }]);
    vi.mocked(customerApi.sourceCustomerCandidates).mockResolvedValue({ truncated: false, items: [
      { ...customer, customerId: "c1", samePhone: true },
      { ...customer, customerId: "c2", name: "Nguyễn Văn Bình", customerCode: "KH-IGEN-000002", samePhone: true },
    ] });
    vi.mocked(customerApi.importSourceRecord).mockResolvedValue(customer);
    render(<CustomerSourceTransferAction module="students" companyCode="IGEN" branchId="b1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển hồ sơ sang Khách hàng" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Chọn trên trang này" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem trước đợt chuyển" }));
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển 1 hồ sơ" }));
    expect(await screen.findByRole("heading", { name: "Đã chuyển hoặc đã liên kết" })).toBeTruthy();
    expect(customerApi.sourceBatchTransfer).toHaveBeenCalledExactlyOnceWith({ companyCode: "IGEN", branchId: "b1" }, refs, [refs[1]]);
    fireEvent.click(screen.getByRole("button", { name: /Đối chiếu Nguyễn Văn An/ }));
    expect(await screen.findByText(/2 khách có cùng số điện thoại/)).toBeTruthy();
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
    expect((screen.getByRole("button", { name: "Xác nhận liên kết" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Tạo khách hàng mới/ }));
    expect((screen.getByRole("button", { name: "Tạo và liên kết" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /KH-IGEN-000001/ }));
    expect(customerApi.importSourceRecord).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận liên kết" }));
    expect(await screen.findByRole("link", { name: "Mở KH-IGEN-000001" })).toBeTruthy();
    expect(customerApi.importSourceRecord).toHaveBeenCalledExactlyOnceWith("students", "student1", { companyCode: "IGEN", branchId: "b1" }, { customerId: "c1" });
  });

  it("hides the module action and allows restoring it from settings", async () => {
    vi.mocked(customerApi.sourceTransferSetting).mockResolvedValue({ hidden: false });
    vi.mocked(customerApi.sourceQueue).mockResolvedValue({ items: [], hasMore: false });
    vi.mocked(customerApi.setSourceTransferHidden).mockResolvedValue({ hidden: true });
    const view = render(<CustomerSourceTransferAction module="healthcare" companyCode="IGEN" branchId="b1" canConfigure />);
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển hồ sơ sang Khách hàng" }));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn nút chuyển" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Chuyển hồ sơ sang Khách hàng" })).toBeNull());
    view.unmount();
    vi.mocked(customerApi.sourceTransferSetting).mockResolvedValue({ hidden: true });
    vi.mocked(customerApi.setSourceTransferHidden).mockResolvedValue({ hidden: false });
    render(<CustomerSourceTransferAction module="healthcare" companyCode="IGEN" branchId="b1" settingsOnly />);
    fireEvent.click(await screen.findByRole("button", { name: "Hiện nút chuyển ở Bệnh nhân" }));
    expect(await screen.findByRole("button", { name: "Ẩn nút chuyển ở Bệnh nhân" })).toBeTruthy();
  });
  it("opens the chosen module section directly from the customer list", async () => {
    profile = { companyCode: "IGEN", role: "admin", enabledModules: ["customer", "omni-inbox", "student"] };
    render(<CustomerWorkspace />);
    expect(await screen.findByRole("heading", { name: "Hồ sơ khách hàng" })).toBeTruthy();
    const row = await screen.findByRole("row", { name: /Nguyễn Văn An/ });
    expect(within(row).getByText(customer.customerCode)).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /Mua hàng & bảo hành/ })).toBeNull();
    fireEvent.click(within(row).getByRole("button", { name: "Hồ sơ liên kết của Nguyễn Văn An" }));
    expect(await screen.findByRole("button", { name: "Liên kết hồ sơ Đào tạo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại danh sách" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nhu cầu từ Lead của Nguyễn Văn An" }));
    expect(await screen.findByText("Tư vấn nhập học · Lead")).toBeTruthy();
  });
  it("opens directly from a Lead, then exposes the module link action on the overview", async () => {
    profile = { companyCode: "IGEN", role: "admin", enabledModules: ["customer", "omni-inbox", "student"] };
    window.history.replaceState(null, "", "?customerId=c1&section=lead-needs");
    render(<CustomerWorkspace />);
    expect(await screen.findByText("Tư vấn nhập học · Lead")).toBeTruthy();
    expect(customerApi.detail).toHaveBeenCalledWith("c1", "IGEN", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Tổng quan" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem và liên kết hồ sơ" }));
    expect(await screen.findByRole("button", { name: "Liên kết hồ sơ Đào tạo" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại danh sách" }));
    expect(window.location.search).toBe("");
    expect(await screen.findByRole("button", { name: "Chi tiết Nguyễn Văn An" })).toBeTruthy();
  });

  it("returns to overview for a linked section without access", async () => {
    profile = { companyCode: "IGEN", role: "user", permissions: ["customer:read"], enabledModules: ["customer", "omni-inbox"] };
    window.history.replaceState(null, "", "?customerId=c1&section=lead-needs");
    render(<CustomerWorkspace />);
    expect(await screen.findByRole("heading", { name: "Thông tin hồ sơ" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nhu cầu" })).toBeNull();
    expect(customerApi.leadNeeds).not.toHaveBeenCalled();
  });
  it("clears the previous branch's customer and open form when scope changes", async () => {
    const view = render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    await screen.findByRole("heading", { name: "Nguyễn Văn An" });
    fireEvent.click(screen.getByRole("button", { name: "Sửa hồ sơ" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    activeBranchId = "b2";
    view.rerender(<CustomerWorkspace />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Nguyễn Văn An" })).toBeNull();
    await screen.findByRole("button", { name: "Chi tiết Nguyễn Văn An" });
    fireEvent.click(screen.getByRole("button", { name: "Chi tiết Nguyễn Văn An" }));
    await waitFor(() => expect(customerApi.purchaseHistory).toHaveBeenLastCalledWith("c1", { companyCode: "IGEN", branchId: "b2" }));
  });

  it("ignores an older customer list response after the filter changes", async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof customerApi.list>>) => void;
    vi.mocked(customerApi.list).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const inactive = { ...customer, _id: "c2", name: "Khách ngừng giao dịch", status: "inactive" as const };
    vi.mocked(customerApi.list).mockResolvedValue({ items: [inactive], total: 1, page: 1, limit: 20 });
    render(<CustomerWorkspace />);
    await waitFor(() => expect(customerApi.list).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Trạng thái" })).getByRole("option", { name: "Ngừng hoạt động" }));
    await screen.findByText(inactive.name);
    await act(async () => { resolveOld({ items: [customer], total: 1, page: 1, limit: 20 }); });
    expect(screen.getByText(inactive.name)).toBeTruthy();
    expect(screen.queryByText(customer.name)).toBeNull();
  });

  it("loads company-wide active customers and offers management actions", async () => {
    render(<CustomerWorkspace />);
    expect(await screen.findByText("Nguyễn Văn An")).toBeTruthy();
    expect(customerApi.list).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "IGEN", status: "active" }));
    expect(screen.getByRole("button", { name: "Thêm khách hàng" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /xóa/i })).toBeNull();
  });

  it("combines independent customer kind, invoice and status filters with the search", async () => {
    render(<CustomerWorkspace />);
    await screen.findByText("Nguyễn Văn An");
    fireEvent.change(screen.getByLabelText("Tìm khách hàng"), { target: { value: "0901" } });
    fireEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Trạng thái" })).getByRole("option", { name: "Ngừng hoạt động" }));
    fireEvent.click(screen.getByRole("button", { name: "Đối tượng khách hàng" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Đối tượng khách hàng" })).getByRole("option", { name: "Chưa phân loại" }));
    fireEvent.click(screen.getByRole("button", { name: "Chế độ hóa đơn" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Chế độ hóa đơn" })).getByRole("option", { name: "Mặc định xuất VAT" }));
    await waitFor(() => expect(customerApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "0901", status: "inactive", type: "vat", customerKind: "unclassified" })), { timeout: 1000 });
  });

  it("edits the kind from the list while retaining a customer's two linked roles", async () => {
    profile = { companyCode: "IGEN", role: "admin", enabledModules: ["customer", "student", "healthcare"] };
    vi.mocked(customerApi.linkedModules).mockResolvedValue({ c1: ["students", "healthcare"] });
    const updated = { ...customer, customerKind: "individual" as const, version: 1 };
    vi.mocked(customerApi.update).mockResolvedValue(updated);
    render(<CustomerWorkspace />);
    expect(await screen.findByRole("button", { name: /Hồ sơ liên kết của Nguyễn Văn An \(Học viên · Bệnh nhân\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sửa hồ sơ Nguyễn Văn An" }));
    const dialog = screen.getByRole("dialog", { name: "Sửa hồ sơ khách hàng" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Đối tượng khách hàng" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "Cá nhân" }));
    vi.mocked(customerApi.list).mockResolvedValue({ items: [updated], total: 1, page: 1, limit: 20 });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu khách hàng" }));
    expect(await screen.findByText("Cá nhân")).toBeTruthy();
    expect(customerApi.update).toHaveBeenCalledWith("c1", expect.objectContaining({ customerKind: "individual", type: "regular" }), 0, "IGEN");
    expect(await screen.findByRole("button", { name: /Hồ sơ liên kết của Nguyễn Văn An \(Học viên · Bệnh nhân\)/ })).toBeTruthy();
  });

  it("renders read-only mode without mutation controls", async () => {
    profile = { companyCode: "IGEN", role: "user", permissions: ["customer:read"] };
    render(<CustomerWorkspace />);
    expect(await screen.findByText("Nguyễn Văn An")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm khách hàng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa hồ sơ Nguyễn Văn An" })).toBeNull();
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
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thêm khách hàng" })).getByRole("button", { name: "Chế độ hóa đơn" }));
    fireEvent.click(within(screen.getByRole("listbox", { name: "Chế độ hóa đơn" })).getByRole("option", { name: "Mặc định xuất VAT" }));
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
