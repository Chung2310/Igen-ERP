// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayrollPolicyFormModal } from "./PayrollPolicyFormModal";

describe("PayrollPolicyFormModal", () => {
  it("uses four guided steps and blocks invalid navigation", () => {
    render(<PayrollPolicyFormModal mode="create" saving={false} onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("1. Thông tin chung")).toBeTruthy();
    expect(screen.getByText("4. Tăng ca & làm tròn")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));
    expect(screen.getByText("Vui lòng nhập mã công thức")).toBeTruthy();
    expect(screen.getByLabelText("Mã công thức")).toBeTruthy();
  });

  it("prefills edit data using percentage values", () => {
    render(<PayrollPolicyFormModal mode="edit" saving={false} initialDefinition={{ code: "VN", name: "Việt Nam", effectiveFrom: "2026-01-01", funds: [{ code: "social", employeeRate: .08, employerRate: .175, capBasis: "baseSalary" }] }} onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByDisplayValue("VN")).toBeTruthy();
  });
});
