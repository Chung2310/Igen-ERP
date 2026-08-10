// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retailCustomersApi } from "../../api/retailCustomers.api";
import CustomerPicker from "./CustomerPicker";

vi.mock("../../api/retailCustomers.api", () => ({ retailCustomersApi: { list: vi.fn() } }));
const scope = { companyCode: "ACME", branchId: "B1" };
const customer = { _id: "c1", customerCode: "KH-ACME-000001", companyCode: "ACME", originBranchId: "B2", name: "Nguyễn Văn A", phone: "0901234567" };

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retailCustomersApi.list).mockResolvedValue({ items: [customer], total: 1, page: 1, limit: 10 });
});

describe("CustomerPicker", () => {
  it("searches company-wide customers and selects a result", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker scope={scope} value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Tìm khách hàng" }), "0901");
    await waitFor(() => expect(retailCustomersApi.list).toHaveBeenCalledWith(scope, { q: "0901", limit: 10 }));
    await userEvent.click(await screen.findByRole("option", { name: /Nguyễn Văn A/ }));
    expect(onChange).toHaveBeenCalledWith(customer);
  });

  it("clears the selected customer", async () => {
    const onChange = vi.fn();
    render(<CustomerPicker scope={scope} value={customer} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Bỏ chọn khách hàng" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
