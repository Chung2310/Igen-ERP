// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoleModal } from "./RoleModal";

afterEach(cleanup);

const permissions = [
  { _id: "1", code: "hr:read", name: "Xem nhân sự", module: "hr", group: "Nhân sự" },
  { _id: "2", code: "hr:manage", name: "Quản lý nhân sự", module: "hr", group: "Nhân sự" },
  { _id: "3", code: "payroll-period:read", name: "Xem tiền lương", module: "payroll", group: "Tiền lương" },
];

function Harness() {
  const [selected, setSelected] = React.useState(["hr:read"]);
  return <RoleModal
    open
    onClose={vi.fn()}
    editingRole={null}
    roleSlug="hr_staff"
    setRoleSlug={vi.fn()}
    roleDisplayName="Nhân viên nhân sự"
    setRoleDisplayName={vi.fn()}
    roleLevel={4}
    setRoleLevel={vi.fn()}
    selectedPermissions={selected}
    setSelectedPermissions={setSelected}
    userProfile={{ uid: "admin-1", role: "admin" } as any}
    selectedCompanyCode="ACME"
    systemPermissions={permissions}
    submittingRole={false}
    onSubmit={(event) => event.preventDefault()}
  />;
}

describe("RoleModal permission module cards", () => {
  it("renders always-open module cards with selected permission counts", () => {
    render(<Harness />);

    const hrCard = screen.getByRole("region", { name: "Nhân sự" });
    const payrollCard = screen.getByRole("region", { name: "Tiền lương" });
    expect(within(hrCard).getByText("1/2")).toBeTruthy();
    expect(within(payrollCard).getByText("0/1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /chọn tất cả/i })).toBeNull();
  });

  it("shows read as included when manage permission is selected", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Quản lý nhân sự" }));
    expect((screen.getByRole("checkbox", { name: "Xem nhân sự" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Quản lý nhân sự" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("region", { name: "Nhân sự" }).textContent).toContain("2/2");
  });
});
