import { describe, expect, it } from "vitest";
import { parseAssistantResultTable } from "../../src/shared/assistant-result-table";
import { operationById } from "./catalog";
import { formatFriendlyAssistantResult } from "./result-format";

describe("student bulk result formatting", () => {
  it("renders invalid rows with the Excel row, learner, value and reason", () => {
    const operation = operationById("student.bulk.preview")!;
    const reply = formatFriendlyAssistantResult(operation, {
      errors: [{ row: 4, name: "Lê Minh Châu", phone: "SĐT giả lập 003", reason: "Số điện thoại không hợp lệ." }],
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toEqual({
      "Dòng": "4",
      "Học viên": "Lê Minh Châu",
      "Số điện thoại": "SĐT giả lập 003",
      "Lý do": "Số điện thoại không hợp lệ.",
    });
  });

  it("does not say records were created when every row was skipped", () => {
    const operation = operationById("student.bulk.create")!;
    const reply = formatFriendlyAssistantResult(operation, {
      importedCount: 0,
      skippedCount: 1,
      errors: [{ row: 2, name: "Nguyễn Văn An", phone: "SĐT giả lập 001", reason: "Số điện thoại không hợp lệ." }],
    });

    expect(reply).toContain("Đã nhập 0 học viên; bỏ qua 1 dòng · 1 kết quả:");
    expect(reply).not.toContain("đã tạo nhiều hồ sơ học viên");
    expect(parseAssistantResultTable(reply)?.rows[0]?.values["Học viên"]).toBe("Nguyễn Văn An");
  });
});

describe("nested API result fields", () => {
  it("shows only explicitly approved fields from nested result objects", () => {
    const source = operationById("customer.list")!;
    const operation = {
      ...source,
      title: "Lịch sử giao dịch khách hàng",
      resultFields: ["name", "items"],
      resultChildFields: { items: ["orderCode", "amount"] },
    };
    const reply = formatFriendlyAssistantResult(operation, [{
      name: "La Văn Sến",
      items: [{ orderCode: "DH-001", amount: 250000, customerPhone: "0987000000", internalId: "private-id" }],
    }]);

    expect(reply).toContain("La Văn Sến");
    expect(reply).toContain("DH-001");
    expect(reply).toContain("250.000");
    expect(reply).not.toContain("0987000000");
    expect(reply).not.toContain("private-id");
    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values["Tên khách hàng"]).toBe("La Văn Sến");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("DH-001");
    expect(Object.values(table?.rows[0]?.values || {}).join(" ")).toContain("250.000");
  });
});

describe("shared tables for module lookups", () => {
  it("lists department employees in a safe shared table", () => {
    const operation = operationById("department.employees.list")!;
    const reply = formatFriendlyAssistantResult(operation, [
      { displayName: "Trần Minh", jobTitle: "Quản trị hệ thống", department: "IT", id: "private-id" },
      { displayName: "Hà My", jobTitle: "Hỗ trợ kỹ thuật", department: "IT", _id: "private-id-2" },
    ]);

    const table = parseAssistantResultTable(reply);
    expect(table?.rows).toHaveLength(2);
    expect(table?.rows[0]?.values).toMatchObject({
      "Nhân sự": "Trần Minh",
      "Chức danh": "Quản trị hệ thống",
      "Phòng ban": "IT",
    });
    expect(reply).not.toContain("private-id");
  });

  it("renders generic lookup lists as a table while keeping internal fields hidden", () => {
    const operation = operationById("customer.list")!;
    const reply = formatFriendlyAssistantResult(operation, [{
      customerCode: "KH-001",
      name: "La Văn Sến",
      phone: "0987217127",
      status: "active",
      internalId: "db-private-id",
    }]);

    const table = parseAssistantResultTable(reply);
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.values).toMatchObject({
      "Mã khách hàng": "KH-001",
      "Tên khách hàng": "La Văn Sến",
      "Số điện thoại": "0987217127",
      "Trạng thái": "Đang hoạt động",
    });
    expect(reply).not.toContain("db-private-id");
  });
});

describe("HR reports", () => {
  it("returns department head and employee count in the shared result table", () => {
    const operation = operationById("department.lookup")!;
    const reply = formatFriendlyAssistantResult(operation, [{ name: "Phòng Tài chính", managerName: "Mai Anh", employeeCount: 6 }]);

    expect(parseAssistantResultTable(reply)?.rows[0]?.values).toMatchObject({
      "Phòng ban": "Phòng Tài chính", "Trưởng phòng": "Mai Anh", "Số nhân sự": "6",
    });
  });

  it("filters daily attendance rows to the requested late-arrival report", () => {
    const operation = operationById("timekeeping.records.late")!;
    const reply = formatFriendlyAssistantResult(operation, [
      { employeeName: "Nam Văn Tú", date: "2026-11-17", attendanceStatus: "Đã vào ca, đi muộn", checkIn: "2026-11-17T00:59:00.000Z" },
      { employeeName: "Lê Thu An", date: "2026-11-17", attendanceStatus: "Đã vào và ra ca", checkIn: "2026-11-17T00:20:00.000Z" },
    ]);

    expect(reply).toContain("Nam Văn Tú");
    expect(reply).not.toContain("Lê Thu An");
    expect(parseAssistantResultTable(reply)?.rows[0]?.values["Trạng thái"]).toBe("Đã vào ca, đi muộn");
  });

  it("reports expiring employee contracts without exposing internal identifiers", () => {
    const operation = operationById("hr.contract.expiring.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      expiryAlerts: [{ _id: "507f1f77bcf86cd799439011", employeeName: "Nam Văn Tú", contractType: "Xác định thời hạn", endDate: "2026-11-30", daysRemaining: 13 }],
      expiryAlertTotal: 1,
      expiryAlertDays: 20,
    });

    expect(reply).toContain("Nam Văn Tú");
    expect(reply).toContain("13 ngày");
    expect(reply).not.toContain("507f1f77bcf86cd799439011");
  });

  it("renders birthdays without exposing birth years", () => {
    const operation = operationById("employee.birthday.next-month")!;
    const reply = formatFriendlyAssistantResult(operation, {
      birthdays: [{ displayName: "Nguyễn Anh", birthday: "04/12", birthDate: "1990-12-04", id: "private-id" }],
      total: 1,
      month: 12,
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Ngày sinh": "04/12" });
    expect(reply).not.toContain("1990");
    expect(reply).not.toContain("private-id");
  });

  it("lists only unfinished internal training and flags a truncated scan", () => {
    const operation = operationById("hr.training.incomplete.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      incompleteEnrollments: [{ employeeName: "Nguyễn Anh", courseTitle: "An toàn lao động", progress: 35, status: "in_progress", uid: "private-id" }],
      incompleteTotal: 1,
      fetchedTotal: 1000,
      overallTotal: 1200,
      truncated: true,
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh", "Khóa đào tạo": "An toàn lao động", "Tiến độ": "35%", "Trạng thái": "Đang học" });
    expect(reply).toContain("kết quả có thể chưa bao gồm toàn bộ nhân sự");
    expect(reply).not.toContain("private-id");
  });

  it("keeps the requested course name and says course of study in an empty report", () => {
    const operation = operationById("hr.training.incomplete.list")!;
    const reply = formatFriendlyAssistantResult(operation, {
      incompleteEnrollments: [], incompleteTotal: 0, courseName: "hát",
    });

    expect(reply).toContain("Không có lượt học nào chưa hoàn thành khóa học hát");
  });

  it("confirms a contract extension with the employee and formatted dates", () => {
    const operation = operationById("hr.contract.extend")!;
    const reply = formatFriendlyAssistantResult(operation, {
      employeeName: "Nguyễn Anh", previousEndDate: "2026-12-31T00:00:00.000Z",
      newEndDate: "2027-04-30T00:00:00.000Z", extensionDate: "2026-11-17T00:00:00.000Z", contractId: "private-id",
    });

    const table = parseAssistantResultTable(reply);
    expect(table?.rows[0]?.values).toMatchObject({ "Nhân sự": "Nguyễn Anh" });
    expect(reply).toContain("30/04/2027");
    expect(reply).not.toContain("private-id");
  });
});
