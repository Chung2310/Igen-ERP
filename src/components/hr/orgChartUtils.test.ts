import { describe, expect, it } from "vitest";
import { EmployeeNode } from "../../types";
import { filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";

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
});
