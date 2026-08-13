// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { PayrollPolicyManager } from "./PayrollPolicyManager";

const api = vi.hoisted(() => ({ getPolicies: vi.fn(), activatePolicy: vi.fn(), retirePolicy: vi.fn(), deletePolicy: vi.fn(), updatePolicy: vi.fn() }));
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: { ...api, createPolicy: vi.fn(), clonePolicy: vi.fn() } }));
vi.mock("../../../pages/Toast", () => ({ toast: notifications }));

const activePolicy = { _id: "p1", code: "VN", name: "Việt Nam", status: "active", version: 2, effectiveFrom: "2026-01-01", baseSalary: 2_340_000, regionalMinimumWage: 4_960_000, socialCapMultiplier: 20, unemploymentCapMultiplier: 20, funds: [], personalDeduction: 11_000_000, dependentDeduction: 4_400_000, taxBrackets: [{ upTo: 5_000_000, rate: .05 }, { rate: .1 }], shortTermWithholdingRate: .1, shortTermWithholdingThreshold: 2_000_000, nonResidentRate: .2, overtime: { weekday: 1.5, restDay: 2, holiday: 3, nightPremium: .3, nightOvertimeBonus: .2 }, roundingUnit: 1 };

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

  it("highlights the active policy and labels it as selected", async () => {
    api.getPolicies.mockResolvedValue([{ _id: "p1", code: "VN", name: "Việt Nam", status: "active", effectiveFrom: "2026-01-01" }]);
    render(<PayrollPolicyManager canManage />);
    const badge = await screen.findByText("Đang áp dụng");
    expect(badge).toBeTruthy();
    expect(badge.closest("[data-policy-status='active']")?.className).toContain("border-indigo-400");
  });

  it("asks whether to recalculate after editing an active policy", async () => {
    const policy = activePolicy;
    api.getPolicies.mockResolvedValue([policy]); api.updatePolicy.mockResolvedValue({ ...policy, version: 3 });
    const recalculate = vi.fn().mockResolvedValue(undefined);
    render(<PayrollPolicyManager canManage runStatus="draft" onRecalculate={recalculate} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu công thức" }));
    expect(await screen.findByText("Lưu thay đổi công thức đang áp dụng?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lưu và cập nhật bảng lương" }));
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("p1", expect.objectContaining({ expectedVersion: 2 })));
    await waitFor(() => expect(recalculate).toHaveBeenCalledOnce());
  });

  it("only offers configuration saving for a reviewed period", async () => {
    api.getPolicies.mockResolvedValue([activePolicy]);
    render(<PayrollPolicyManager canManage runStatus="review" onRecalculate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu công thức" }));
    expect(await screen.findByRole("button", { name: "Chỉ lưu cấu hình" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lưu và cập nhật bảng lương" })).toBeNull();
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
