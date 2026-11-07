// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ permissions: new Set<string>(), api: vi.fn() }));
vi.mock("./api", () => ({ api: state.api, ApiError: class extends Error {}, hasQuotationCapability: (code: string) => state.permissions.has(code), formatMoney: (amount: number) => String(amount), getLatestGeneratedFile: async () => ({ file: null, job: null }), createGeneratedExport: vi.fn(), downloadGeneratedFile: vi.fn() }));
import BudgetPlanner from "./BudgetPlanner";

describe("budget AI permission", () => {
  beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
  beforeEach(() => { state.permissions = new Set(["quotation:manage"]); state.api.mockResolvedValue({ plans: [] }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("keeps analysis disabled with valid input when AI permission is missing", async () => {
    const view = render(<BudgetPlanner onAiUsed={vi.fn()} />);
    const create = await screen.findAllByRole("button", { name: /Tạo phương án/i });
    fireEvent.click(create[0]);
    fireEvent.change(document.querySelector("#budget-description")!, { target: { value: "Lắp PC văn phòng" } });
    fireEvent.change(document.querySelector("#budget-amount")!, { target: { value: "15000000" } });
    const submit = screen.getByRole("button", { name: "Phân tích & Đề xuất phương án" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    state.permissions.add("quotation-ai:manage"); view.rerender(<BudgetPlanner onAiUsed={vi.fn()} />);
    await waitFor(() => expect(submit.disabled).toBe(false));
    expect(state.api).not.toHaveBeenCalledWith("/api/budget-plans/suggest", expect.anything());
  });
});
