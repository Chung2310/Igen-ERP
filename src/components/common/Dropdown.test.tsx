// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dropdown } from "./Dropdown";

afterEach(cleanup);

describe("searchable Dropdown inside native dialogs", () => {
  it("forwards remote search and clearing without changing selected option values", () => {
    const search = vi.fn(), change = vi.fn();
    render(<Dropdown aria-label="Sản phẩm" value="" onChange={change} onSearchChange={search} options={[{ value: "p1", label: "Sản phẩm A" }]} searchable searchPlaceholder="Tìm sản phẩm" />);
    fireEvent.click(screen.getByRole("button", { name: "Sản phẩm" }));
    expect(search).toHaveBeenLastCalledWith("");
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm sản phẩm" }), { target: { value: "Sản phẩm A" } });
    expect(search).toHaveBeenLastCalledWith("Sản phẩm A");
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(search).toHaveBeenLastCalledWith("");
    fireEvent.click(screen.getByRole("option", { name: "Sản phẩm A" }));
    expect(change).toHaveBeenCalledWith("p1");
  });
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
