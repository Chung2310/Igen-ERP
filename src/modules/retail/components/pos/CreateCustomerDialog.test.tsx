// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customerApi } from "../../../customer-management/customerApi";
import CreateCustomerDialog from "./CreateCustomerDialog";

vi.mock("../../../customer-management/customerApi", () => ({
  customerApi: { create: vi.fn(), createBillingProfile: vi.fn(), billingProfiles: vi.fn() },
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
  vi.mocked(customerApi.billingProfiles).mockResolvedValue([]);
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
  async function fillVat(taxId = "0312345678", email = "invoice@example.com") {
    await userEvent.type(screen.getByRole("textbox", { name: "Số điện thoại" }), "0909123456");
    await userEvent.selectOptions(screen.getByRole("combobox"), "vat");
    for (const [label, value] of [
      ["Tên khách hàng", "Cong ty A"],
      ["Tên pháp nhân", "Cong ty A"],
      ["Mã số thuế", taxId],
      ["Địa chỉ hóa đơn", "1 Nguyen Hue"],
      ["Email nhận hóa đơn", email],
    ]) await userEvent.type(screen.getByRole("textbox", { name: label }), value);
  }

  it.each([false, true])("retries VAT without duplicating the customer or an already saved profile (saved=%s)", async (saved) => {
    const onCreated = vi.fn();
    vi.mocked(customerApi.createBillingProfile).mockRejectedValueOnce(new Error("Không lưu được hồ sơ VAT."));
    vi.mocked(customerApi.billingProfiles).mockResolvedValue(saved ? [{
      _id: "bp1", customerId: "c2", legalName: "Cong ty A", taxId: "0312345678",
      address: "1 Nguyen Hue", invoiceEmail: "invoice@example.com", isDefault: true, status: "active", version: 0,
    }] : []);
    render(<CreateCustomerDialog scope={scope} onClose={vi.fn()} onCreated={onCreated} />);
    await fillVat();
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không lưu được hồ sơ VAT.");
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox", { name: "Tên khách hàng" }) as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ VAT" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(customerApi.create).toHaveBeenCalledOnce();
    expect(customerApi.billingProfiles).toHaveBeenCalledWith("c2", "ACME");
    expect(customerApi.createBillingProfile).toHaveBeenCalledTimes(saved ? 1 : 2);
  });

  it.each([
    ["123", "invoice@example.com", "Mã số thuế không hợp lệ."],
    ["0312345678", "bad-email", "Email nhận hóa đơn không hợp lệ."],
  ])("validates VAT before creating a customer (%s, %s)", async (taxId, email, message) => {
    render(<CreateCustomerDialog scope={scope} onClose={vi.fn()} onCreated={vi.fn()} />);
    await fillVat(taxId, email);
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(customerApi.create).not.toHaveBeenCalled();
  });

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
      source: "pos",
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

  it("keeps the VAT dialog scrollable and mobile-friendly on smaller screens", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Loại khách hàng" }), "vat");

    const dialog = screen.getByRole("dialog", { name: "Tạo khách hàng mới" }).querySelector("form")!;
    expect(dialog.className).toContain("max-h-[calc(100vh-2rem)]");
    expect(dialog.className).toContain("overflow-y-auto");

    const cancelButton = screen.getByRole("button", { name: "Hủy" });
    const actions = cancelButton.parentElement;
    expect(actions?.className).toContain("grid-cols-1");
    expect(actions?.className).toContain("sm:grid-cols-2");
  });

  it("rejects a whitespace-only name without calling the API", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Vui lòng nhập tên khách hàng.");
    expect(customerApi.create).not.toHaveBeenCalled();
  });

  it("requires a phone number before creating a customer at POS", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="" onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "Nguyễn Văn B");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Vui lòng nhập số điện thoại khách hàng.");
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

  it("retries a failed VAT profile without creating a duplicate POS customer", async () => {
    vi.mocked(customerApi.createBillingProfile).mockRejectedValueOnce(new Error("Lỗi lưu VAT"));
    const onCreated = vi.fn();
    render(<CreateCustomerDialog scope={scope} initialPhone="0909123456" onClose={vi.fn()} onCreated={onCreated} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Loại khách hàng" }), "vat");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "Công ty A");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên pháp nhân" }), "Công ty A");
    await userEvent.type(screen.getByRole("textbox", { name: "Mã số thuế" }), "0312345678");
    await userEvent.type(screen.getByRole("textbox", { name: "Địa chỉ hóa đơn" }), "1 Nguyễn Huệ");
    await userEvent.type(screen.getByRole("textbox", { name: "Email nhận hóa đơn" }), "ketoan@congtya.vn");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Đã tạo khách hàng nhưng chưa lưu được hồ sơ VAT");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ VAT" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(customerApi.create).toHaveBeenCalledOnce();
    expect(customerApi.createBillingProfile).toHaveBeenCalledTimes(2);
  });

  it("closes without creating a customer", async () => {
    const onClose = vi.fn();
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(customerApi.create).not.toHaveBeenCalled();
  });
});
