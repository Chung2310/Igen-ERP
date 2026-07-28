// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const branchMocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn() }));
const authState = vi.hoisted(() => ({ userProfile: { role: "admin", companyCode: "ACME" } }));
vi.mock("../../services/branchService", () => ({ branchService: branchMocks }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import BranchManagementTab from "./BranchManagementTab";

describe("BranchManagementTab", () => {
  beforeEach(() => {
    branchMocks.list.mockResolvedValue([{ _id: "b1", code: "HQ", name: "Head Office", address: "Main street", phone: "0900000000", companyCode: "ACME", isActive: true }]);
    branchMocks.create.mockResolvedValue({ _id: "b2", code: "BR2", name: "Branch 2", companyCode: "ACME", isActive: true });
    branchMocks.update.mockResolvedValue({ _id: "b1", code: "HQ", name: "Head Office", companyCode: "ACME", isActive: false });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("renders branches and creates a new branch", async () => {
    const user = userEvent.setup();
    render(<BranchManagementTab />);
    expect(await screen.findByText("Head Office")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Thêm chi nhánh/ }));
    await user.type(screen.getByLabelText("Mã chi nhánh"), "BR2");
    await user.type(screen.getByLabelText("Tên chi nhánh"), "Branch 2");
    await user.click(screen.getByRole("button", { name: /Tạo chi nhánh/ }));
    await waitFor(() => expect(branchMocks.create).toHaveBeenCalledWith(expect.objectContaining({ code: "BR2", name: "Branch 2" })));
  });

  it("soft deletes an active branch", async () => {
    const user = userEvent.setup();
    render(<BranchManagementTab />);
    const row = (await screen.findByText("Head Office")).closest("li") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: /Vô hiệu hóa/ }));
    await waitFor(() => expect(branchMocks.update).toHaveBeenCalledWith("b1", { isActive: false }));
  });
});