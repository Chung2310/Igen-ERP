import { afterEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { interpretRequest } from "./interpreter";

const provider = vi.hoisted(() => vi.fn(async (..._args: any[]): Promise<{ text: string }> => { throw new Error("Unexpected provider call for a supported HR request"); }));
vi.mock("../service/openrouter.service", () => ({ openrouterChat: provider }));

const employeeWorkflows = ASSISTANT_OPERATIONS
  .filter(operation => ["employee.list", "employee.detail", "employee.create", "employee.update", "employee.delete"].includes(operation.id))
  .map(defaultWorkflow);
const hrWorkflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "hr").map(defaultWorkflow);

afterEach(() => provider.mockReset());

it.each([
  ["Thông tin nhân sự La Văn Sến", "employee.detail", { search: "La Văn Sến" }],
  ["Tra cứu nhân viên tên La Văn Sến", "employee.list", { search: "La Văn Sến" }],
  ["Tìm nhân sự theo email sen@example.com", "employee.list", { search: "sen@example.com" }],
  ["Tạo nhân viên mới", "employee.create", {}],
  ["Cập nhật thông tin nhân sự", "employee.update", {}],
  ["Bổ sung thông tin cho nhân sự", "employee.update", {}],
  ["Cho tôi xem nhân sự", "employee.list", {}],
  ["Xóa nhân viên", "employee.delete", {}],
])("routes a plain-language HR request: %s", async (text, actionId, values) => {
  const result = await interpretRequest(text, employeeWorkflows, null, []);
  expect(result.actionId).toBe(actionId);
  expect(result.values).toMatchObject(values);
});

it.each([
  ["Cập nhật dữ liệu đầu vào lương nhân sự", "payroll.period.input.update"],
  ["Cập nhật biến dữ liệu đầu vào bảng lương", "payroll.period.variables.update"],
  ["Thay đổi thông tin cài đặt lịch phát hành đối soát lương", "payroll.reconciliation.schedule.update"],
  ["Sửa giờ làm nhân viên", "api.patch.6bc968347283a069"],
  ["Danh sách trạng thái đối soát lương của nhân viên", "payroll.run.reconciliation.list"],
  ["Xem yêu cầu kiểm tra phiếu lương của tôi", "payroll.employee.me.payslip.review-requests"],
  ["Xem nhật ký xử lý của kỳ lương", "api.get.ac427b464961eae6"],
  ["Xem nhật ký thao tác của một lượt lương", "api.get.f2ac09bb2c5e311f"],
])("does not confuse a payroll workflow with an employee profile request: %s", async (text, actionId) => {
  provider.mockResolvedValueOnce({ text: JSON.stringify({ actionId: null, values: {} }) });

  const result = await interpretRequest(text, hrWorkflows, null, []);

  expect(result.actionId).toBe(actionId);
});

it.each([
  ["Xem phiếu lương của tôi", "payroll.employee.me.payslips"],
  ["Tra cứu đối soát lương của tôi", "payroll.employee.me.reconciliation"],
  ["Tra cứu số dư phép năm của tôi", "leave.balance.me"],
  ["Tra cứu chấm công hôm nay của tôi", "timekeeping.today.me"],
  ["Danh sách ca làm việc", "api.get.d632a938b9c72492"],
  ["Danh sách phân ca", "api.get.efd26957a4dbe889"],
  ["Danh sách giờ làm nhân sự", "api.get.5d0d3ea4fc0d9efb"],
  ["Danh sách lịch nghỉ lễ", "timekeeping.work-calendar.list"],
  ["Danh sách hợp đồng nhân sự", "api.get.0c557a74cbc907f9"],
  ["Danh sách tin tuyển dụng", "recruitment.job.list"],
  ["Danh sách ứng viên", "recruitment.applicant.list"],
  ["Danh sách lịch phỏng vấn", "recruitment.interview.list"],
  ["Danh sách khóa đào tạo", "training.list"],
  ["Danh sách phòng ban", "department.list"],
  ["Danh sách công việc", "task.list"],
  ["Danh sách dự án", "project.list"],
])("understands a common request from HR tabs: %s", async (text, actionId) => {
  const result = await interpretRequest(text, hrWorkflows, null, []);
  expect(result.actionId).toBe(actionId);
});

it.each([
  ["Báo cáo tình hình nhân sự hôm nay", "timekeeping.records.overview", {}],
  ["Kiểm tra xem hôm nay có những nhân sự nào đi muộn", "timekeeping.records.late", {}],
  ["Tình hình chấm công hôm nay", "timekeeping.records.overview", {}],
  ["Ai ( nhân sự nào ) còn thiếu hợp đồng", "hr.contract.missing.list", {}],
  ["Hôm nay nhân sự nào vắng", "timekeeping.records.absent", {}],
  ["Hôm nay nhân sự nào chưa chấm công", "timekeeping.records.unrecorded", {}],
  ["Hôm nay có ai nghỉ phép không", "timekeeping.records.leave", {}],
  ["Sửa lại dữ liệu chấm công cho Nam Văn Tú checkin lúc 7 giờ 59 phút và checkout lúc 18 giờ", "timekeeping.record.update", {
    query_uid: "Nam Văn Tú", checkInTime: "07:59", checkOutTime: "18:00",
  }],
  ["Nhân sự nào sắp hết hợp đồng", "hr.contract.expiring.list", {}],
  ["Tạo hợp đồng cho nhân sự Nam Văn Tú", "hr.contract.create", { employeeId: "Nam Văn Tú" }],
  ["Xóa nhân sự Nam Văn Tú vì đã nghỉ việc", "employee.delete", { id: "Nam Văn Tú" }],
  ["phòng tài chính có bao nhiêu nhân sự", "department.lookup", { query_department: "Phòng tài chính" }],
  ["ai là quản lý phòng tài chính ?", "department.lookup", { query_department: "Phòng tài chính" }],
  ["thêm phòng kế toán", "department.create", { name: "kế toán" }],
  ["sửa phòng tài chính thành kế toán tài chính", "department.update", { id: "phòng tài chính", name: "kế toán tài chính" }],
  ["bổ sung số điện thoại cho nhân sự Nam Văn tú 0988373736", "employee.update", { id: "Nam Văn tú", phone: "0988373736" }],
  ["chuyển nhân sự Nguyễn Anh sang phòng Marketing", "employee.update", { id: "Nguyễn Anh", department: "Phòng Marketing" }],
  ["điều chuyển Nguyễn Văn Phúc xuống dưới quyền quản lý của Trần quốc bảo", "employee.update", { id: "Nguyễn Văn Phúc", parentId: "Trần quốc bảo" }],
  ["Lọc danh sách các nhân sự chuẩn bị hết hạn hợp đồng thử việc trong 10 ngày tới", "hr.contract.expiring.list", { query_alertDays: 10, query_contractType: "thử việc" }],
  ["Đây là CCCD của nhân sự mới, dựa vào thông tin này tạo nhân sự này trên hệ thống giúp tôi", "employee.create", {}],
  ["Liệt kê danh sách nhân sự có sinh nhật trong tháng tới", "employee.birthday.next-month", {}],
  ["Kiểm tra ai chưa hoàn thành các bài học trong đào tạo nội bộ", "hr.training.incomplete.list", { page: 1, limit: 1000 }],
  ["Kiểm tra hôm nay có đơn nghỉ phép nào không", "timekeeping.records.leave", {}],
  ["Đặt nhân sự Nguyễn Anh làm trưởng nhóm", "employee.update", { id: "Nguyễn Anh", jobTitle: "trưởng nhóm" }],
  ["Đưa nhân sự Nguyễn Anh làm quản lí phòng tài chính", "department.update", { id: "Phòng tài chính", managerUid: "Nguyễn Anh" }],
  ["Sửa lương cho Nam Văn Tú thành 12 triệu", "employee.update", { id: "Nam Văn Tú", monthlySalary: 12000000 }],
  ["đổi chức danh cho Nguyễn Anh thành giám đốc tài chính", "employee.update", { id: "Nguyễn Anh", jobTitle: "giám đốc tài chính" }],
  ["hủy chức vụ trưởng nhóm của Nguyễn Anh", "employee.update", { id: "Nguyễn Anh", jobTitle: "" }],
])("understands a previously failed sheet request: %s", async (text, actionId, values) => {
  const result = await interpretRequest(text, hrWorkflows, null, []);
  expect(result.actionId).toBe(actionId);
  expect(result.values).toMatchObject(values);
});

it("routes a contract extension to the selected contract and defaults its recorded date to today", async () => {
  const result = await interpretRequest("gia hạn hợp đồng cho nhân sự Nguyễn Anh thành 30/4/2027", hrWorkflows, null, []);
  expect(result.actionId).toBe("hr.contract.extend");
  expect(result.values).toMatchObject({ path_id: "Nguyễn Anh", newEndDate: "2027-04-30" });
  expect(result.values.extensionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it("does not expose salary in assistant employee search results", () => {
  const employeeList = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.list");
  expect(employeeList?.resultFields).not.toContain("monthlySalary");
  expect(employeeList?.resultFields).not.toContain("password");
});

it("offers employee deletion only through a confirmed selection", () => {
  const deletion = ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.delete");
  expect(deletion).toMatchObject({ method: "DELETE", path: "/auth/users/:id", confirmation: true });
  expect(deletion?.fields.find(field => field.key === "id")?.reference).toBe("employee.list");
  expect(deletion?.description).toContain("Cần chọn đúng người và xác nhận");
});

it("routes HR spreadsheet requests 32 through 40 to monthly reports and leave balances", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ["tổng hợp dữ liệu chấm công tháng 10", "timekeeping.records.monthly.overview", { year: 2026, month: 10 }],
      ["tháng vừa rồi ai không đủ 26 công", "timekeeping.records.monthly.under-26", { year: 2026, month: 10 }],
      ["ai nghỉ nhiều nhất tháng trước", "timekeeping.records.monthly.most-absent", { year: 2026, month: 10 }],
      ["tháng này ai nghỉ nhiều nhất", "timekeeping.records.monthly.most-absent", { year: 2026, month: 11 }],
      ["ai thường xuyên đi làm trễ tháng này", "timekeeping.records.monthly.most-late", { year: 2026, month: 11 }],
      ["danh sách nhân sự còn đủ 12 phép", "leave.balances.at-least-12", { year: 2026 }],
      ["ai đã hết lượt nghỉ phép năm", "leave.balances.exhausted", { year: 2026 }],
      ["thống kê lượt nghỉ phép còn lại của các nhân sự", "leave.balances.list", { year: 2026 }],
      ["tháng này có những ngày nào được nghỉ", "timekeeping.work-calendar.month-holidays", { year: 2026, month: 11, appliedOnly: "true", holidaysOnly: "true" }],
    ];

    for (const [text, actionId, values] of cases) {
      const result = await interpretRequest(text, hrWorkflows, null, []);
      expect(result.actionId, text).toBe(actionId);
      expect(result.values, text).toMatchObject(values);
    }
  } finally {
    vi.useRealTimers();
  }
});
