// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PayrollPolicyManager } from "./PayrollPolicyManager";

const { getPolicies } = vi.hoisted(() => ({ getPolicies: vi.fn() }));
vi.mock("../../../services/payrollService", () => ({ payrollService: { getPolicies, createPolicy: vi.fn(), updatePolicy: vi.fn(), clonePolicy: vi.fn(), activatePolicy: vi.fn(), retirePolicy: vi.fn(), deletePolicy: vi.fn() } }));
vi.mock("../../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("PayrollPolicyManager", () => {
  beforeEach(() => getPolicies.mockResolvedValue([]));

  it("opens the guided form instead of a JSON editor", async () => {
    render(<PayrollPolicyManager canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo công thức" }));
    expect(screen.getByText("1. Thông tin chung")).toBeTruthy();
    expect(document.querySelector("textarea.font-mono")).toBeNull();
  });
});
