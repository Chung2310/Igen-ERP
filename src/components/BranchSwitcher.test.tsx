// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BranchSwitcher from "./BranchSwitcher";

const branches = [
  { _id: "main", companyCode: "IGEN", code: "MAIN", name: "Trụ sở chính", isActive: true },
  { _id: "south", companyCode: "IGEN", code: "SOUTH", name: "Chi nhánh miền Nam", isActive: true },
];

afterEach(cleanup);

describe("BranchSwitcher", () => {
  it("shows the selected branch and applies a new selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BranchSwitcher branches={branches} activeBranchId="main" onChange={onChange} />);

    const trigger = screen.getByRole("button", { name: /Chi nhánh đang chọn: Trụ sở chính/ });
    await user.click(trigger);
    expect(screen.getByRole("option", { name: /Trụ sở chính/ }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("option", { name: /Chi nhánh miền Nam/ }));

    expect(onChange).toHaveBeenCalledWith("south");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports arrow navigation and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<BranchSwitcher branches={branches} activeBranchId="main" onChange={vi.fn()} />);

    const trigger = screen.getByRole("button", { name: /Chi nhánh đang chọn: Trụ sở chính/ });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Trụ sở chính/ })).toBe(document.activeElement);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Chi nhánh miền Nam/ })).toBe(document.activeElement);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toBe(document.activeElement);
  });
});
