// @vitest-environment jsdom
import React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRetailPosShortcuts } from "./useRetailPosShortcuts";
afterEach(cleanup);
function Fixture({ actions }: any) { useRetailPosShortcuts(actions); return <><input aria-label="editable" /><div data-testid="surface" tabIndex={0} /></>; }
describe("POS shortcuts", () => {
  it("maps F1 F2 F4 F6 and F8 to help search payment hold and scanner", () => { const actions = { focusSearch: vi.fn(), openPayment: vi.fn(), holdDraft: vi.fn(), openScanner: vi.fn(), openHelp: vi.fn() }; const view = render(<Fixture actions={actions} />); for (const key of ["F1", "F2", "F4", "F6", "F8"]) fireEvent.keyDown(view.getByTestId("surface"), { key }); expect([actions.openHelp, actions.focusSearch, actions.openPayment, actions.holdDraft, actions.openScanner].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1, 1, 1]); });
  it("ignores shortcuts while typing in editable fields", () => { const actions = { focusSearch: vi.fn(), openPayment: vi.fn(), holdDraft: vi.fn(), openScanner: vi.fn(), openHelp: vi.fn() }; const view = render(<Fixture actions={actions} />); fireEvent.keyDown(view.getByLabelText("editable"), { key: "F4" }); expect(actions.openPayment).not.toHaveBeenCalled(); });
});
