// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailCustomersApi } from "../../api/retailCustomers.api";
import CreateCustomerDialog from "./CreateCustomerDialog";

vi.mock("../../api/retailCustomers.api", () => ({
  retailCustomersApi: { create: vi.fn() },
}));

const scope = { companyCode: "ACME", branchId: "B1" };
const created = {
  _id: "c2",
  customerCode: "KH-ACME-000002",
  companyCode: "ACME",
  originBranchId: "B1",
  name: "Nguyễn Văn B",
  phone: "0909123456",
  email: "b@example.com",
  address: "1 Nguyễn Huệ",
  notes: "Khách tại quầy",
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailCustomersApi.create).mockResolvedValue(created);
});

describe("CreateCustomerDialog", () => {
  it("prefills the searched phone and creates a customer with trimmed full details", async () => {
    const onCreated = vi.fn();
    render(
      <CreateCustomerDialog
        scope={scope}
        initialPhone=" 0909123456 "
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Tạo khách hàng mới" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Số điện thoại" }) as HTMLInputElement).value).toBe("0909123456");
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "  Nguyễn Văn B  ");
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), " b@example.com ");
    await userEvent.type(screen.getByRole("textbox", { name: "Địa chỉ" }), " 1 Nguyễn Huệ ");
    await userEvent.type(screen.getByRole("textbox", { name: "Ghi chú" }), " Khách tại quầy ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    await waitFor(() => expect(retailCustomersApi.create).toHaveBeenCalledWith({
      name: "Nguyễn Văn B",
      phone: "0909123456",
      email: "b@example.com",
      address: "1 Nguyễn Huệ",
      notes: "Khách tại quầy",
    }, scope));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("rejects a whitespace-only name without calling the API", async () => {
    render(<CreateCustomerDialog scope={scope} initialPhone="0909" onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Tên khách hàng" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Lưu khách hàng" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Vui lòng nhập tên khách hàng.");
    expect(retailCustomersApi.create).not.toHaveBeenCalled();
  });

  it("keeps entered values and shows the API error when creation fails", async () => {
    vi.mocked(retailCustomersApi.create).mockRejectedValueOnce(new Error("Số điện thoại đã tồn tại."));
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
    expect(retailCustomersApi.create).not.toHaveBeenCalled();
  });
});
