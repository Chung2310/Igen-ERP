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

it("routes a company-wide employee total to the headcount report", async () => {
  const result = await interpretRequest("Tổng số nhân sự của công ty", hrWorkflows, null, []);

  expect(result.actionId).toBe("employee.count");
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
  ["XÓA QUY TRÌNH TUYỂN DỤNG NHÂN SỰ", "hr.workflow.delete", { path_id: "TUYỂN DỤNG NHÂN SỰ" }],
  ["thêm bước hẹn lịch phỏng vấn vào quy trình tuyển dụng", "hr.workflow.update", { path_id: "tuyển dụng", workflowAction: "Thêm bước", workflowValue: "hẹn lịch phỏng vấn" }],
  ["thêm bước trả lương cho quy trình tuyển dụng nhân sự", "hr.workflow.update", { path_id: "tuyển dụng nhân sự", workflowAction: "Thêm bước", workflowValue: "trả lương" }],
  ["thêm bước con trong bước trả lương trong quy tình tuyển dụng nhân sự", "hr.workflow.update", { path_id: "tuyển dụng nhân sự", workflowAction: "Thêm giai đoạn con", workflowTarget: "trả lương" }],
  ["thêm bước con trong bước trả lương trong quy trình tuyển dụng nhân sự", "hr.workflow.update", { path_id: "tuyển dụng nhân sự", workflowAction: "Thêm giai đoạn con", workflowTarget: "trả lương" }],
  ["thêm bước con Kiểm tra bảng lương cho bước trả lương trong quy trình tuyển dụng nhân sự", "hr.workflow.update", { path_id: "tuyển dụng nhân sự", workflowAction: "Thêm giai đoạn con", workflowTarget: "trả lương", workflowValue: "Kiểm tra bảng lương" }],
  ["bổ sung bước Gửi tài liệu cho quy trình Hội nhập nhân viên", "hr.workflow.update", { path_id: "Hội nhập nhân viên", workflowAction: "Thêm bước", workflowValue: "Gửi tài liệu" }],
  ["bỏ bước sàng lọc CV khỏi quy trình tuyển dụng nhân sự", "hr.workflow.update", { path_id: "tuyển dụng nhân sự", workflowAction: "Gỡ bước", workflowTarget: "sàng lọc CV" }],
  ["thêm quy trình con \"scan CV \" vào bước sàng lọc CV trong quy trình tuyển dụng", "hr.workflow.update", { path_id: "tuyển dụng", workflowAction: "Thêm giai đoạn con", workflowTarget: "sàng lọc CV", workflowValue: "scan CV" }],
  ["thêm quy trình tuyển dụng nhân sự : bước 1 : Viết jd bước đăng bài tuyển dụng, bước 3 sàng lọc", "hr.workflow.create", { name: "tuyển dụng nhân sự", steps: [{ title: "Viết jd" }, { title: "đăng bài tuyển dụng" }, { title: "sàng lọc" }] }],
])("routes work-process requests through HR workflows: %s", async (text, actionId, values) => {
  const result = await interpretRequest(text, hrWorkflows, null, []);

  expect(result.actionId, text).toBe(actionId);
  expect(result.values, text).toMatchObject(values);
});

it.each(["Kiểm tra bảng lương", "Tên bước con là Kiểm tra bảng lương"])("collects a child step name without changing the pending parent: %s", async text => {
  const result = await interpretRequest(text, hrWorkflows, {
    actionId: "hr.workflow.update", values: { path_id: "tuyển dụng nhân sự", workflowAction: "Thêm giai đoạn con", workflowTarget: "trả lương" },
  }, []);
  expect(result).toMatchObject({ actionId: "hr.workflow.update", newRequest: false, values: { workflowValue: "Kiểm tra bảng lương" } });
  expect(result.values.path_id).toBeUndefined();
  expect(result.values.workflowTarget).toBeUndefined();
});

it.each([
  ["Xóa quy trình Onboarding nhân viên", "hr.workflow.delete", { path_id: "Onboarding nhân viên" }],
  ["Thêm bước Gửi thư mời vào quy trình Onboarding nhân viên", "hr.workflow.update", {
    path_id: "Onboarding nhân viên", workflowAction: "Thêm bước", workflowValue: "Gửi thư mời",
  }],
  ["Xóa bước Kiểm tra hồ sơ khỏi quy trình Chuẩn hóa dữ liệu", "hr.workflow.update", {
    path_id: "Chuẩn hóa dữ liệu", workflowAction: "Gỡ bước", workflowTarget: "Kiểm tra hồ sơ",
  }],
  ["Thêm giai đoạn con \"Gửi hướng dẫn\" vào bước Hướng dẫn ban đầu trong quy trình Hội nhập nhân viên", "hr.workflow.update", {
    path_id: "Hội nhập nhân viên", workflowAction: "Thêm giai đoạn con", workflowTarget: "Hướng dẫn ban đầu", workflowValue: "Gửi hướng dẫn",
  }],
  ["Tạo quy trình Đào tạo hội nhập: Bước 1: Chuẩn bị tài khoản; Bước 2: Hướng dẫn", "hr.workflow.create", {
    name: "Đào tạo hội nhập", steps: [{ title: "Chuẩn bị tài khoản" }, { title: "Hướng dẫn" }],
  }],
])("uses the process name supplied by the user: %s", async (text, actionId, values) => {
  const result = await interpretRequest(text, hrWorkflows, null, []);

  expect(result.actionId, text).toBe(actionId);
  expect(result.values, text).toMatchObject(values);
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

it("routes the remaining recruiting cases from intent and keeps names supplied by the user", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T17:00:00.000Z"));
  try {
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ["Báo cáo tình hình tuyển dụng", "recruitment.report", { query_reportType: "overview" }],
      ["Ngày mai có lịch phỏng vấn ứng viên nào", "recruitment.report", { query_reportType: "interviews", query_from: "2026-11-19", query_to: "2026-11-19" }],
      ["Hôm nay có lịch phỏng vấn ứng viên nào", "recruitment.report", { query_reportType: "interviews", query_from: "2026-11-18", query_to: "2026-11-18" }],
      ["Hôm nay có 1 buổi phỏng vấn cho vị trí QA Lead, nhân sự nào đã phỏng vấn", "recruitment.report", { query_reportType: "interviewers", query_search: "QA Lead" }],
      ["Hôm nay có 1 buổi phỏng vấn cho vị trí Kế toán, kết quả như thế nào", "recruitment.report", { query_reportType: "interview-results", query_search: "Kế toán" }],
      ["Kết quả phỏng vấn của Lê Bảo", "recruitment.report", { query_reportType: "interview-results", query_search: "Lê Bảo" }],
      ["Thêm lịch phỏng vấn", "recruitment.interview.create", {}],
      ["Đặt lịch hẹn phỏng vấn cho ứng viên Nguyễn An", "recruitment.interview.create", { applicantId: "Nguyễn An" }],
      ["Đổi người phỏng vấn cho ứng viên Mai Anh thành Võ Minh Quân", "recruitment.interview.update", { path_id: "Mai Anh", interviewerIds: ["Võ Minh Quân"] }],
      ["Dời lịch phỏng vấn ứng viên An Bình thành 13 giờ", "recruitment.interview.update", { path_id: "An Bình", requestedStartTime: "13:00" }],
      ["Xóa lịch phỏng vấn của ứng viên Thu Hà", "recruitment.interview.delete", { path_id: "Thu Hà" }],
      ["Thêm tin tuyển dụng vị trí Chuyên viên QA vào hệ thống", "recruitment.job.create", { title: "Chuyên viên QA" }],
      ["Thêm ứng viên Trần Minh Khoa vào hệ thống", "recruitment.applicant.create", { fullName: "Trần Minh Khoa" }],
      ["Xóa ứng viên Phạm Ngọc Lan", "recruitment.applicant.delete", { path_id: "Phạm Ngọc Lan" }],
      ["Sửa hình thức làm việc của ứng viên Gia Linh thành trực tuyến", "recruitment.interview.update", { path_id: "Gia Linh", format: "online" }],
      ["Sửa lịch phỏng vấn QA Lead của An Bình sang ngày 19 tháng 11", "recruitment.interview.update", { path_id: "An Bình", requestedStartDate: "2026-11-19" }],
      ["Đang có ai đang ứng tuyển vào vị trí QA Lead", "recruitment.applicant.list", { query_jobId: "QA Lead", query_outcome: "active" }],
      ["Tháng này đang có bao nhiêu lịch phỏng vấn", "recruitment.report", { query_reportType: "interview-count", query_from: "2026-11-01", query_to: "2026-11-30" }],
      ["Tuần này có những lịch phỏng vấn nào", "recruitment.report", { query_reportType: "interviews", query_from: "2026-11-16", query_to: "2026-11-22" }],
      ["Tuần này tuyển dụng được bao nhiêu nhân sự", "recruitment.report", { query_reportType: "hires", query_from: "2026-11-16", query_to: "2026-11-22" }],
      ["Tuần này có bao nhiêu ứng viên đã onboard", "recruitment.report", { query_reportType: "onboarded", query_from: "2026-11-16", query_to: "2026-11-22" }],
      ["Tháng này công ty có bao nhiêu nhân sự mới", "recruitment.report", { query_reportType: "hires", query_from: "2026-11-01", query_to: "2026-11-30" }],
      ["Tháng này công ty có bao nhiêu ứng viên onboard", "recruitment.report", { query_reportType: "onboarded", query_from: "2026-11-01", query_to: "2026-11-30" }],
      ["Vị trí nào đang có nhiều ứng viên ứng tuyển nhất", "recruitment.report", { query_reportType: "job-applications", query_rank: "most" }],
      ["Vị trí nào đang có ít ứng viên ứng tuyển nhất", "recruitment.report", { query_reportType: "job-applications", query_rank: "least" }],
      ["Phòng ban nào đang thiếu người (có đăng tuyển dụng)", "recruitment.report", { query_reportType: "staffing-gaps" }],
      ["Tin tuyển dụng Chuyên viên QA hết hạn chưa", "recruitment.report", { query_reportType: "job-deadlines", query_search: "Chuyên viên QA" }],
      ["Thống kê số ứng viên đang ứng tuyển vào từng phòng ban", "recruitment.report", { query_reportType: "applicants-by-department" }],
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

it("does not route a recruitment schedule request to the company calendar when its report workflow is unavailable", async () => {
  const workflows = hrWorkflows.filter(workflow => workflow.actionId !== "recruitment.report");
  const result = await interpretRequest("Ngày mai có lịch phỏng vấn ứng viên nào", workflows, null, []);
  expect(result).toMatchObject({ actionId: null, intentType: "unsupported", unsupportedModule: "hr" });
  expect(result.actionId).not.toBe("hr.calendar.events.list");
});

it.each([
  ["Báo cáo tình hình nhân sự hôm nay", "timekeeping.records.overview", {}],
  ["Kiểm tra xem hôm nay có những nhân sự nào đi muộn", "timekeeping.records.late", {}],
  ["Tình hình chấm công hôm nay", "timekeeping.records.overview", {}],
  ["Ai ( nhân sự nào ) còn thiếu hợp đồng", "hr.contract.missing.list", {}],
  ["Hôm nay nhân sự nào vắng", "timekeeping.records.absent", {}],
  ["Hôm nay nhân sự nào chưa chấm công", "timekeeping.records.unrecorded", {}],
  ["Hôm nay có ai nghỉ phép không", "hr.leave.applications.list", {}],
  ["Sửa lại dữ liệu chấm công cho Nam Văn Tú checkin lúc 7 giờ 59 phút và checkout lúc 18 giờ", "timekeeping.record.update", {
    employeeId: "Nam Văn Tú", checkInTime: "07:59", checkOutTime: "18:00",
  }],
  ["Sửa dữ liệu chấm công cho Nam Văn Tú ngày 16/11/2026 checkin lúc 7 giờ 59 phút và checkout lúc 18 giờ", "timekeeping.record.update", {
    employeeId: "Nam Văn Tú", date: "2026-11-16", checkInTime: "07:59", checkOutTime: "18:00",
  }],
  ["Nhân sự nào sắp hết hợp đồng", "hr.contract.expiring.list", {}],
  ["Tạo hợp đồng cho nhân sự Nam Văn Tú", "hr.contract.create", { employeeId: "Nam Văn Tú" }],
  ["Xóa nhân sự Nam Văn Tú vì đã nghỉ việc", "employee.delete", { id: "Nam Văn Tú" }],
  ["phòng tài chính có bao nhiêu nhân sự", "department.lookup", { query_department: "tài chính" }],
  ["ai là quản lý phòng tài chính ?", "department.lookup", { query_department: "tài chính" }],
  ["danh sách nhân sự phòng IT", "department.employees.list", { query_department: "IT" }],
  ["thêm phòng kế toán", "department.create", { name: "kế toán" }],
  ["sửa phòng tài chính thành kế toán tài chính", "department.update", { id: "phòng tài chính", name: "kế toán tài chính" }],
  ["bổ sung số điện thoại cho nhân sự Nam Văn tú 0988373736", "employee.update", { id: "Nam Văn tú", phone: "0988373736" }],
  ["bổ sung số điện thoại cho nhân sự Cường", "employee.update", { id: "Cường" }],
  ["chuyển nhân sự Nguyễn Anh sang phòng Marketing", "employee.update", { id: "Nguyễn Anh", department: "Phòng Marketing" }],
  ["điều chuyển Nguyễn Văn Phúc xuống dưới quyền quản lý của Trần quốc bảo", "employee.update", { id: "Nguyễn Văn Phúc", parentId: "Trần quốc bảo" }],
  ["Lọc danh sách các nhân sự chuẩn bị hết hạn hợp đồng thử việc trong 10 ngày tới", "hr.contract.expiring.list", { query_alertDays: 10, query_contractType: "thử việc" }],
  ["Đây là CCCD của nhân sự mới, dựa vào thông tin này tạo nhân sự này trên hệ thống giúp tôi", "employee.create", {}],
  ["Liệt kê danh sách nhân sự có sinh nhật trong tháng tới", "employee.birthday.next-month", {}],
  ["Kiểm tra ai chưa hoàn thành các bài học trong đào tạo nội bộ", "hr.training.incomplete.list", { page: 1, limit: 1000 }],
  ["Kiểm tra hôm nay có đơn nghỉ phép nào không", "hr.leave.applications.list", {}],
  ["Đặt nhân sự Nguyễn Anh làm trưởng nhóm", "employee.update", { id: "Nguyễn Anh", jobTitle: "trưởng nhóm" }],
  ["Đưa nhân sự Nguyễn Anh làm quản lí phòng tài chính", "department.update", { id: "Phòng tài chính", managerUid: "Nguyễn Anh" }],
  ["Sửa lương cho Nam Văn Tú thành 12 triệu", "employee.update", { id: "Nam Văn Tú", monthlySalary: 12000000 }],
  ["sửa lương cơ bản của nhân sự IT1 thành 20 triệu", "employee.update", { id: "IT1", monthlySalary: 20000000 }],
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

it.each([
  ["Kiểm tra ai chưa hoàn thành các bài học trong đào tạo hát", "hát"],
  ["Kiểm tra ai chưa hoàn thành các bài học trong đào tạo Hát dân ca", "Hát dân ca"],
  ["kiem tra ai chua hoan thanh cac bai hoc trong dao tao hat", "hat"],
  ["Ai chưa hoàn thành khóa đào tạo Hát dân ca", "Hát dân ca"],
  ["Ai chưa hoàn thành các bài học trong đào tạo nội bộ", undefined],
])("preserves the requested training scope: %s", async (text, courseName) => {
  const result = await interpretRequest(text, hrWorkflows, null, []);
  expect(result.actionId).toBe("hr.training.incomplete.list");
  expect(result.values).toEqual({ page: 1, limit: 1000, ...(courseName ? { courseName } : {}) });
});

it("routes HR spreadsheet requests 32 through 40 to monthly reports and leave balances", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ["tổng hợp dữ liệu chấm công tháng 10", "timekeeping.records.monthly.overview", { year: 2026, month: 10 }],
      ["tháng vừa rồi ai không đủ 26 công", "timekeeping.records.monthly.under-threshold", { year: 2026, month: 10, thresholdDays: 26 }],
      ["thang nay ai khong du 20 cong", "timekeeping.records.monthly.under-threshold", { year: 2026, month: 11, thresholdDays: 20 }],
      ["ai nghỉ nhiều nhất tháng trước", "timekeeping.records.monthly.most-absent", { year: 2026, month: 10 }],
      ["tháng này ai nghỉ nhiều nhất", "timekeeping.records.monthly.most-absent", { year: 2026, month: 11 }],
      ["ai thường xuyên đi làm trễ tháng này", "timekeeping.records.monthly.most-late", { year: 2026, month: 11 }],
      ["danh sách nhân sự còn đủ 12 phép", "leave.balances.minimum", { year: 2026, thresholdDays: 12 }],
      ["danh sach nhan su con it nhat 8 ngay phep", "leave.balances.minimum", { year: 2026, thresholdDays: 8 }],
      ["ai đã hết lượt nghỉ phép năm", "leave.balances.exhausted", { year: 2026 }],
      ["thống kê lượt nghỉ phép còn lại của các nhân sự", "leave.balances.list", { year: 2026 }],
      ["tháng này có những ngày nào được nghỉ", "timekeeping.work-calendar.month-holidays", { year: 2026, month: 11, appliedOnly: "true", holidaysOnly: "true" }],
      ["ngày Happy Day của công ty diễn ra vào ngày nào", "timekeeping.work-calendar.named-holiday", { year: 2026, eventName: "happy day" }],
      ["ngày Quốc khánh của công ty diễn ra vào ngày nào", "timekeeping.work-calendar.named-holiday", { year: 2026, eventName: "quoc khanh" }],
      ["những nhân sự nào chưa hoàn thành khóa học Quy chế bảo mật", "hr.training.incomplete.list", { page: 1, limit: 1000, courseName: "Quy chế bảo mật" }],
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

it("routes task requests with their dynamic title, person, filter, and completion values", async () => {
  const cases: Array<[string, string, Record<string, unknown>]> = [
    ["tạo 1 giao việc mới cho Phạm Gia Hân", "task.create", { assigneeUid: "Phạm Gia Hân" }],
    ["Tháng này, những nhân sự nào không đạt KPI", "task.kpi.monthly", { completionFilter: "below-100" }],
    ["Tháng này, những nhân sự nào hoàn thành 100% KPI", "task.kpi.monthly", { completionFilter: "exactly-100" }],
    ["Công việc Kiểm thử sản phẩm mới 1234567890 đang được giao cho ai", "task.list", { search: "Kiểm thử sản phẩm mới 1234567890" }],
    ["Công việc Kiểm thử sản phẩm mới 1234567890 đã hoàn thành chưa", "task.list", { search: "Kiểm thử sản phẩm mới 1234567890" }],
    ["Những công việc nào đang làm chưa xong", "task.list", { completionFilter: "unfinished" }],
    ["Những công việc nào bị trễ deadline", "task.list", { overdue: true }],
    ["Những công việc nào chưa bắt đầu", "task.list", { status: "Not Started" }],
    ["Báo cáo tiến độ công việc Dự hội thảo BNI EXPO ngày 20/11 hoàn thành được 50%", "task.activity.update", { path_id: "Dự hội thảo BNI EXPO", progress: 50 }],
    ["Báo cáo tiến độ công việc làm cho con bò ngày 20/11 hoàn thành được 50%", "task.activity.update", { path_id: "làm cho con bò", progress: 50 }],
    ["Cập nhập tiến độ công việc làm cho con bò ngày 20/11 hoàn thành được 50%", "task.activity.update", { path_id: "làm cho con bò", progress: 50 }],
    ["Những công việc nào đang ở mức ưu tiên cao", "task.list", { priority: "High" }],
    ["nhân sự Phạm Gia Hân đang đảm nhiệm những công việc nào", "task.list", { assigneeUid: "pham gia han" }],
  ];
  for (const [text, actionId, values] of cases) {
    const result = await interpretRequest(text, hrWorkflows, null, []);
    expect(result.actionId, text).toBe(actionId);
    expect(result.values, text).toMatchObject(values);
  }
});

it("routes monthly leave, attendance, calendar reports, and a dated event", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ["Kiểm tra hôm nay có đơn nghỉ phép nào không", "hr.leave.applications.list", { rangeStart: "2026-11-17", rangeEnd: "2026-11-17", requestKind: "leave", reportKind: "requests" }],
      ["Tổng hợp những nhân sự nghỉ phép trong tháng này", "hr.leave.applications.list", { rangeStart: "2026-11-01", rangeEnd: "2026-11-30", requestKind: "leave", status: "approved", reportKind: "leave-summary" }],
      ["Tổng hợp những nhân sự đi trễ trong tháng này", "timekeeping.records.monthly.most-late", { year: 2026, month: 11 }],
      ["Tổng hợp những nhân sự quên/chưa chấm công trong tháng này", "timekeeping.records.monthly.unrecorded", { year: 2026, month: 11 }],
      ["Báo cáo những sự kiện nội bộ diễn ra trong tháng này", "hr.calendar.events.list", { rangeStart: "2026-11-01", rangeEnd: "2026-11-30", type: "event" }],
      ["Nhân sự nào xin nghỉ nhiều nhất tháng qua", "hr.leave.applications.list", { rangeStart: "2026-10-01", rangeEnd: "2026-10-31", requestKind: "leave", status: "approved", reportKind: "leave-most" }],
      ["Nhân sự nào làm online nhiều nhất tháng qua", "hr.leave.applications.list", { rangeStart: "2026-10-01", rangeEnd: "2026-10-31", requestKind: "wfh", status: "approved", reportKind: "wfh-most" }],
      ["Ngày hôm nay có lịch gì không?", "hr.calendar.events.list", { rangeStart: "2026-11-17", rangeEnd: "2026-11-17" }],
    ];
    for (const [text, actionId, values] of cases) {
      const result = await interpretRequest(text, hrWorkflows, null, []);
      expect(result.actionId, text).toBe(actionId);
      expect(result.values, text).toMatchObject(values);
    }
    const event = await interpretRequest("tạo sự kiện Họp tổng kết tuần vào thứ 7 tuần này", hrWorkflows, null, []);
    expect(event.actionId).toBe("hr.calendar.event.create");
    expect(event.values).toMatchObject({ title: "Họp tổng kết tuần", type: "event", startDate: "2026-11-20T17:00:00.000Z", endDate: "2026-11-21T16:59:59.000Z" });
  } finally {
    vi.useRealTimers();
  }
});

it("uses the current Vietnam year for a day/month attendance adjustment date", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T08:00:00.000Z"));
  try {
    const result = await interpretRequest(
      "Sửa dữ liệu chấm công cho Nam Văn Tú ngày 16/11 checkin lúc 7 giờ 59 phút",
      hrWorkflows,
      null,
      [],
    );
    expect(result.actionId).toBe("timekeeping.record.update");
    expect(result.values.date).toBe("2026-11-16");
  } finally {
    vi.useRealTimers();
  }
});
