// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import PayrollTab from "./PayrollTab";

const api = vi.hoisted(() => new Proxy({}, { get: () => vi.fn().mockResolvedValue([]) }));
vi.mock("../../services/payrollService", () => ({ payrollService: api }));
vi.mock("../../pages/Toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./payroll/PayrollPolicyManager", () => ({ PayrollPolicyManager: () => null }));
vi.mock("./payroll/PayrollFormulaLibrary", () => ({ PayrollFormulaLibrary: () => <div>formula-library-entry-point</div> }));
vi.mock("./payroll/PayrollCustomVariableManager", () => ({ PayrollCustomVariableManager: () => null }));
vi.mock("./payroll/PayrollReviewQueue", () => ({ PayrollReviewQueue: () => null }));
vi.mock("./payroll/PayrollPayslipsPanel", () => ({ PayrollPayslipsPanel: () => null }));
vi.mock("./payroll/PayrollReopenModal", () => ({ PayrollReopenModal: () => null }));

describe("PayrollTab formula library feature flag", () => {
  afterEach(cleanup);

  it("does not render the formula library entry point when disabled", () => {
    render(<PayrollTab canManage />);

    expect(screen.queryByText("formula-library-entry-point")).toBeNull();
  });
});
