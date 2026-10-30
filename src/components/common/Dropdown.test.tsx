// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown } from "./Dropdown";

afterEach(cleanup);

describe("searchable Dropdown inside native dialogs", () => {
  it("searches options and consumes Escape before it closes the enclosing modal", () => {
    render(<dialog open aria-label="Phiếu"><Dropdown aria-label="SKU" value="" onChange={vi.fn()} options={[{ value: "a", label: "Vật tư A" }, { value: "b", label: "Vật tư B" }]} searchable searchPlaceholder="Tìm SKU..." /></dialog>);
    const trigger = screen.getByRole('button', { name: 'SKU' });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm SKU...' }), { target: { value: 'Vật tư B' } });
    expect(screen.queryByRole('option', { name: 'Vật tư A' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Vật tư B' })).toBeTruthy();
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape', cancelable: true })).toBe(false);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole('dialog').hasAttribute('open')).toBe(true);
  });
});
