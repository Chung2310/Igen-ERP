import { describe, expect, it } from "vitest";
import { EmployeeNode } from "../../types";
import { arrangeOrgChartEmployees, filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";

const employees: EmployeeNode[] = [
  { id: "1", name: "Nguyễn An", role: "Giám đốc", department: "Điều hành", email: "an@example.com", phone: "0901", avatar: "A", level: 1, status: "online", division: "Khối Vận Hành" },
  { id: "2", name: "Trần Bình", role: "Nhân viên", department: "Kỹ thuật", email: "binh@example.com", phone: "0902", avatar: "B", level: 2, parentId: "1", status: "offline", division: "Khối Kỹ Thuật" },
];

describe("org chart list helpers", () => {
  it("filters flat employees by normalized search and department", () => {
    expect(filterOrgChartEmployees(employees, "NGUYEN", "Tất cả")).toHaveLength(1);
    expect(filterOrgChartEmployees(employees, "", "Kỹ thuật")).toEqual([employees[1]]);
  });

  it("returns the direct manager or a missing-data fallback", () => {
    expect(getManagerForEmployee(employees[1], employees)?.name).toBe("Nguyễn An");
    expect(getManagerForEmployee(employees[0], employees)).toBeUndefined();
  });

  it("shows saved admin-to-admin links as peers without changing other reports", () => {
    const list = [
      { ...employees[0], id: "admin-a" },
      { ...employees[0], id: "admin-b", parentId: "admin-a" },
      { ...employees[1], id: "worker", parentId: "admin-b" },
    ];
    const arranged = arrangeOrgChartEmployees(list, new Map([["admin-a", "admin"], ["admin-b", "admin"], ["worker", "user"]]));
    expect(arranged.map(employee => employee.parentId)).toEqual([undefined, undefined, "admin-b"]);
    expect(list[1].parentId).toBe("admin-a");
  });

  it("places all admins directly under a superadmin when one is present", () => {
    const list = [
      { ...employees[0], id: "owner" },
      { ...employees[0], id: "admin-a", parentId: "owner" },
      { ...employees[0], id: "admin-b", parentId: "admin-a" },
    ];
    const arranged = arrangeOrgChartEmployees(list, new Map([["owner", "superadmin"], ["admin-a", "admin"], ["admin-b", "admin"]]));
    expect(arranged.map(employee => employee.parentId)).toEqual([undefined, "owner", "owner"]);
  });
});
