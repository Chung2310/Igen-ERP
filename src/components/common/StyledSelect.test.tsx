// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StyledSelect } from "./StyledSelect";

afterEach(cleanup);

describe("StyledSelect in ERP dialogs", () => {
  const options = [{ value: "a", label: "Chi nhánh A" }, { value: "b", label: "Chi nhánh B" }];

  it("keeps the menu in the dialog top layer and closes it before Escape reaches the modal", () => {
    render(<dialog open aria-label="Phiếu"><StyledSelect appearance="erp" ariaLabel="Chi nhánh" value="a" options={options} onChange={vi.fn()} /></dialog>);
    const trigger = screen.getByRole("button", { name: "Chi nhánh" });
    fireEvent.click(trigger);
    expect(within(screen.getByRole("dialog")).getByRole("listbox", { name: "Chi nhánh" })).toBeTruthy();
    expect(fireEvent.keyDown(screen.getByRole("option", { name: "Chi nhánh A" }), { key: "Escape", cancelable: true })).toBe(false);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("retains keyboard selection and body portals outside dialogs", () => {
    const change = vi.fn();
    render(<StyledSelect ariaLabel="Chi nhánh" value="a" options={options} onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Chi nhánh" }));
    expect(screen.getByRole("listbox").parentElement).toBe(document.body);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Chi nhánh B" }));
    fireEvent.click(document.activeElement!);
    expect(change).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("keeps required form validation and focuses the visible dropdown", () => {
    function Form() {
      const [value, setValue] = useState("");
      return <form aria-label="Điều chuyển"><StyledSelect required appearance="erp" ariaLabel="Kho nhận" value={value} options={[{ value: "", label: "Chọn kho" }, ...options]} onChange={setValue} /></form>;
    }
    render(<Form />);
    const form = screen.getByRole("form") as HTMLFormElement;
    const trigger = screen.getByRole("button", { name: "Kho nhận" });
    fireEvent.invalid(form.querySelector("select")!);
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole("alert").textContent).toBe("Vui lòng chọn một mục.");
    expect(form.checkValidity()).toBe(false);
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Chi nhánh B" }));
    expect(form.checkValidity()).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
