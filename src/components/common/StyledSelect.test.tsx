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

  it("keeps the menu inside an open assistant popover", () => {
    render(<section popover="auto" data-testid="assistant-panel"><StyledSelect ariaLabel="Assistant mode" menuLabel="Chọn chế độ" value="qa" options={[{ value: "qa", label: "Hỏi đáp" }, { value: "work", label: "Thao tác" }]} onChange={vi.fn()} /></section>);
    const panel = screen.getByTestId("assistant-panel");
    fireEvent.click(within(panel).getByRole("button", { name: "Assistant mode", hidden: true }));
    expect(within(panel).getByRole("listbox", { name: "Assistant mode", hidden: true }).parentElement).toBe(panel);
    expect(within(panel).getByText("Chọn chế độ")).toBeTruthy();
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

  it("filters customer options inside the dropdown", () => {
    const change = vi.fn();
    const search = vi.fn();
    render(<dialog open aria-label="Ghi buổi tập"><StyledSelect ariaLabel="Học viên / Khách hàng" value="" options={[{ value: "a", label: "Lê Hoàng Anh — 0903112233" }, { value: "b", label: "Nguyễn Văn Bình — 0903223344" }]} onChange={change} searchable searchPlaceholder="Tìm tên hoặc SĐT..." onSearchChange={search} /></dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Học viên / Khách hàng" }));
    const input = screen.getByRole("searchbox", { name: "Tìm tên hoặc SĐT..." });
    fireEvent.change(input, { target: { value: "090322" } });
    expect(search).toHaveBeenCalledWith("090322");
    expect(screen.queryByRole("option", { name: /Lê Hoàng Anh/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: /Nguyễn Văn Bình/ }));
    expect(change).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
