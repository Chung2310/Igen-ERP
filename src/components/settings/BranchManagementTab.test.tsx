// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const branchMocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), currentIp: vi.fn() }));
const authState = vi.hoisted(() => ({ userProfile: { role: "admin", companyCode: "ACME" } }));
const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../services/branchService", () => ({ branchService: branchMocks }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../../pages/Toast", () => ({ toast: toastMocks }));

import BranchManagementTab from "./BranchManagementTab";

describe("BranchManagementTab", () => {
  beforeEach(() => {
    branchMocks.list.mockResolvedValue([{ _id: "b1", code: "HQ", name: "Head Office", address: "Main street", phone: "0900000000", companyCode: "ACME", isActive: true }]);
    branchMocks.create.mockResolvedValue({ _id: "b2", code: "BR2", name: "Branch 2", companyCode: "ACME", isActive: true });
    branchMocks.update.mockResolvedValue({ _id: "b1", code: "HQ", name: "Head Office", companyCode: "ACME", isActive: false });
    branchMocks.currentIp.mockResolvedValue({ ip: "203.0.113.7" });
  });

  it("captures the current coordinates and public IP", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success: any) => success({ coords: { latitude: 10.7, longitude: 106.6 } }) } });
    const user = userEvent.setup();
    render(<BranchManagementTab />);
    await screen.findByText("Head Office");
    await user.click(screen.getByRole("button", { name: /Thêm chi nhánh/ }));
    await user.click(screen.getByRole("button", { name: /Lấy vị trí & IP hiện tại/ }));
    await waitFor(() => expect((screen.getByLabelText("Vĩ độ") as HTMLInputElement).value).toBe("10.7"));
    expect((screen.getByLabelText("IP công cộng được phép") as HTMLTextAreaElement).value).toBe("203.0.113.7");
  });

  it("keeps a public IPv6 address and explains a denied location permission", async () => {
    branchMocks.currentIp.mockResolvedValue({ ip: "2405:4802:219a:9eb0:8002:e332:b128:462b" });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success: unknown, error: (value: unknown) => void) =>
          error({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });
    const user = userEvent.setup();
    render(<BranchManagementTab />);
    await screen.findByText("Head Office");
    await user.click(screen.getByRole("button", { name: /Thêm chi nhánh/ }));
    await user.click(screen.getByRole("button", { name: /Lấy vị trí & IP hiện tại/ }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(expect.stringMatching(/quyền truy cập vị trí/i)));
    expect((screen.getByLabelText("IP công cộng được phép") as HTMLTextAreaElement).value)
      .toBe("2405:4802:219a:9eb0::/64");
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
