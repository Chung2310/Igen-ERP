// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../../../customer-management/customerApi";
import CustomerPicker from "./CustomerPicker";

vi.mock("../../../customer-management/customerApi", () => ({ customerApi: { list: vi.fn(), create: vi.fn() } }));

const scope = { companyCode: "ACME", branchId: "B1" };
const customer = {
  _id: "c1",
  customerCode: "KH-ACME-000001",
  companyCode: "ACME",
  type: "regular" as const,
  name: "Nguyễn Văn A",
  phone: "0901234567",
  status: "active" as const,
  source: "manual" as const,
  createdBy: "u1",
  createdByName: "Admin",
  version: 1,
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(customerApi.list).mockResolvedValue({ items: [customer], total: 1, page: 1, limit: 10 });
});

describe("CustomerPicker", () => {
  it("searches company-wide customers and selects a result", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker scope={scope} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Tìm khách hàng" }), "0901");
    await waitFor(() => expect(customerApi.list).toHaveBeenCalledWith({ companyCode: "ACME", q: "0901", limit: 10, status: "active" }));
    await userEvent.click(await screen.findByRole("option", { name: /Nguyễn Văn A/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      _id: "c1",
      customerCode: "KH-ACME-000001",
      companyCode: "ACME",
      type: "regular",
      name: "Nguyễn Văn A",
      phone: "0901234567",
    }));
  });

  it("clears the selected customer", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker scope={scope} value={customer} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Bỏ chọn khách hàng" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("offers creation only after a successful search returns no customers", async () => {
    vi.mocked(customerApi.list).mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 });
    render(<CustomerPicker scope={scope} value={null} onChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Tạo khách hàng mới" })).toBeNull();
    await userEvent.type(screen.getByRole("combobox", { name: "Tìm khách hàng" }), "0909");
    expect(await screen.findByRole("button", { name: "Tạo khách hàng mới" })).toBeTruthy();
  });

  it("does not offer creation when customer search fails", async () => {
    vi.mocked(customerApi.list).mockRejectedValueOnce(new Error("Mất kết nối"));
    render(<CustomerPicker scope={scope} value={null} onChange={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Tìm khách hàng" }), "0909");

    expect(await screen.findByText("Mất kết nối")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tạo khách hàng mới" })).toBeNull();
  });

  it("prefills the phone and selects the newly created customer", async () => {
    const onChange = vi.fn();
    const newCustomer = { ...customer, _id: "c2", customerCode: "KH-ACME-000002", name: "Khách mới", phone: "0909", type: "vat" as const };
    vi.mocked(customerApi.list).mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 });
    vi.mocked(customerApi.create).mockResolvedValueOnce(newCustomer as any);
    render(<CustomerPicker scope={scope} value={null} onChange={onChange} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Tìm khách hàng" }), "0909");
    await userEvent.click(await screen.findByRole("button", { name: "Tạo khách hàng mới" }));
    expect((screen.getByRole("textbox", { name: "Số điện thoại" }) as HTMLInputElement).value).toBe("0909");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "Khách mới");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      _id: "c2",
      customerCode: "KH-ACME-000002",
      companyCode: "ACME",
      type: "vat",
      name: "Khách mới",
      phone: "0909",
    })));
    expect(screen.queryByRole("dialog", { name: "Tạo khách hàng mới" })).toBeNull();
  });
});
