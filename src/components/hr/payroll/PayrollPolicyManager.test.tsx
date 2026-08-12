// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { PayrollPolicyManager } from "./PayrollPolicyManager";

const api = vi.hoisted(() => ({ getPolicies: vi.fn(), activatePolicy: vi.fn(), retirePolicy: vi.fn(), deletePolicy: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: { ...api, createPolicy: vi.fn(), updatePolicy: vi.fn(), clonePolicy: vi.fn() } }));
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("PayrollPolicyManager", () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); api.getPolicies.mockResolvedValue([]); });

  it("opens the guided form instead of a JSON editor", async () => {
    render(<PayrollPolicyManager canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo công thức" }));
    expect(screen.getByText("1. Thông tin chung")).toBeTruthy();
    expect(document.querySelector("textarea.font-mono")).toBeNull();
  });

  it("uses the standard dialog before retiring an active policy", async () => {
    api.getPolicies.mockResolvedValue([{ _id: "p1", code: "VN", name: "Việt Nam", status: "active", effectiveFrom: "2026-01-01" }]);
    render(<PayrollPolicyManager canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ngưng áp dụng" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(api.retirePolicy).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ngưng áp dụng" }));
    await waitFor(() => expect(api.retirePolicy).toHaveBeenCalledWith("p1"));
  });

  it("offers replacement after an overlap response", async () => {
    api.getPolicies.mockResolvedValue([
      { _id: "p1", code: "OLD", name: "Công thức cũ", status: "active", effectiveFrom: "2026-01-01" },
      { _id: "p2", code: "NEW", name: "Mới", status: "draft", effectiveFrom: "2026-07-01" },
    ]);
    api.activatePolicy.mockRejectedValueOnce(Object.assign(new Error("Trùng thời gian"), { code: "PAYROLL_POLICY_OVERLAP" })).mockResolvedValueOnce({});
    render(<PayrollPolicyManager canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText("Thay thế công thức đang áp dụng?")).toBeTruthy();
    expect(screen.getByText(/Công thức cũ \(OLD\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận thay thế" }));
    await waitFor(() => expect(api.activatePolicy).toHaveBeenLastCalledWith("p2", { replaceOverlaps: true }));
  });
});
