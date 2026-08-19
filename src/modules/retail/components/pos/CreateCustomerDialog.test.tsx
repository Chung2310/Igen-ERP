// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../../../customer-management/customerApi";
import CreateCustomerDialog from "./CreateCustomerDialog";

vi.mock("../../../customer-management/customerApi", () => ({
  customerApi: { create: vi.fn(), createBillingProfile: vi.fn() },
}));

const scope = { companyCode: "ACME", branchId: "B1" };
const created = {
  _id: "c2",
  customerCode: "KH-ACME-000002",
  companyCode: "ACME",
  type: "regular",
  name: "Nguyễn Văn B",
  phone: "0909123456",
  email: "b@example.com",
  address: "1 Nguyễn Huệ",
  notes: "Khách tại quầy",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(customerApi.create).mockResolvedValue(created as any);
  vi.mocked(customerApi.createBillingProfile).mockResolvedValue({
    profile: {
      _id: "bp1",
      customerId: "c2",
      legalName: "Công ty A",
      taxId: "0312345678",
      address: "1 Nguyễn Huệ",
      invoiceEmail: "ketoan@congtya.vn",
      contactName: "An",
      isDefault: true,
      status: "active",
      version: 1,
    },
    warnings: [],
  } as any);
});

describe("CreateCustomerDialog", () => {
  it("prefills the searched phone and creates a customer with trimmed full details", async () => {
    const onCreated = vi.fn();
    render(<CreateCustomerDialog scope={scope} initialPhone=" 0909123456 " onClose={vi.fn()} onCreated={onCreated} />);

    expect(screen.getByRole("dialog", { name: "Tạo khách hàng mới" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Số điện thoại" }) as HTMLInputElement).value).toBe("0909123456");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "  Nguyễn Văn B  ");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), " b@example.com ");
    await userEvent.type(screen.getByRole("textbox", { name: "Địa chỉ" }), " 1 Nguyễn Huệ ");
    await userEvent.type(screen.getByRole("textbox", { name: "Ghi chú" }), " Khách tại quầy ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    await waitFor(() => expect(customerApi.create).toHaveBeenCalledWith({
      name: "Nguyễn Văn B",
      phone: "0909123456",
      email: "b@example.com",
      address: "1 Nguyễn Huệ",
      notes: "Khách tại quầy",
      type: "regular",
    }, "ACME"));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("allows choosing VAT customer type", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);

    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "vat");
    expect(screen.getByRole("textbox", { name: "Tên pháp nhân" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Mã số thuế" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Địa chỉ hóa đơn" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email nhận hóa đơn" })).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "Cong ty A");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên pháp nhân" }), " Công ty A ");
    await userEvent.type(screen.getByRole("textbox", { name: "Mã số thuế" }), " 0312345678 ");
    await userEvent.type(screen.getByRole("textbox", { name: "Địa chỉ hóa đơn" }), " 1 Nguyễn Huệ ");
    await userEvent.type(screen.getByRole("textbox", { name: "Email nhận hóa đơn" }), " ketoan@congtya.vn ");
    await userEvent.type(screen.getByRole("textbox", { name: "Người liên hệ" }), " An ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    await waitFor(() => expect(customerApi.create).toHaveBeenCalledWith(expect.objectContaining({ type: "vat" }), "ACME"));
    await waitFor(() => expect(customerApi.createBillingProfile).toHaveBeenCalledWith("c2", {
      legalName: "Công ty A",
      taxId: "0312345678",
      address: "1 Nguyễn Huệ",
      invoiceEmail: "ketoan@congtya.vn",
      contactName: "An",
      isDefault: true,
    }, "ACME"));
  });

  it("rejects a whitespace-only name without calling the API", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Vui lòng nhập tên khách hàng.");
    expect(customerApi.create).not.toHaveBeenCalled();
  });

  it("keeps entered values and shows the API error when creation fails", async () => {
    vi.mocked(customerApi.create).mockRejectedValueOnce(new Error("Số điện thoại đã tồn tại."));
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);
    const name = screen.getByRole("textbox", { name: "Tên khách hàng" });
    await userEvent.type(name, "Nguyễn Văn B");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Số điện thoại đã tồn tại.");
    expect((name as HTMLInputElement).value).toBe("Nguyễn Văn B");
  });

  it("closes without creating a customer", async () => {
    const onClose = vi.fn();
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(customerApi.create).not.toHaveBeenCalled();
  });
});
