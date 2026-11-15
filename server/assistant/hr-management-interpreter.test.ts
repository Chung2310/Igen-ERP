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
