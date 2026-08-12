// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { PayrollFormulaModal } from "./PayrollFormulaModal";
describe("PayrollFormulaModal", () => {
  afterEach(cleanup);
  it("uses structured variable and operator controls", () => { render(<PayrollFormulaModal saving={false} onClose={vi.fn()} onSave={vi.fn()}/>); expect(screen.getByText("Công thức tính")).toBeTruthy(); expect(screen.getByRole("option", { name: "Lương tháng" })).toBeTruthy(); expect(document.querySelector("textarea")).toBeNull(); });
  it("shows field errors instead of submitting invalid metadata", () => { const save=vi.fn(); render(<PayrollFormulaModal saving={false} onClose={vi.fn()} onSave={save}/>); fireEvent.click(screen.getByRole("button",{name:"Lưu công thức"})); expect(screen.getByText("Nhập mã công thức")).toBeTruthy(); expect(save).not.toHaveBeenCalled(); });
});
