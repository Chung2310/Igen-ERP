import { afterEach, expect, it, vi } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { interpretRequest } from "./interpreter";
import { directPayrollRequest, payrollAmount } from "./payroll-intent";

vi.mock("../service/openrouter.service", () => ({ openrouterChat: vi.fn(() => { throw new Error("Unexpected AI fallback"); }) }));
const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "hr").map(defaultWorkflow);
afterEach(() => vi.useRealTimers());

it.each([
  ["Bảng lương đã được gửi về tài khoản ngày 12/11 cho các nhân sự, họ có khiếu nại gì không?", "payroll.run.complaints.list", {}],
  ["Bảng lương đã gửi ngày 24/3 cho nhân viên, có khiếu nại gì không?", "payroll.run.complaints.list", {}],
  ["Tổng hợp khiếu nại về bảng lương", "payroll.run.complaints.list", {}],
  ["Tổng hợp khiếu nại về bảng lương kỳ 2027-03", "payroll.run.complaints.list", { path_id: "2027-03" }],
  ["Đổi lịch tự động phát hành lương tạm tính sang ngày 5/11 lúc 16 giờ", "payroll.reconciliation.schedule.update", { day: 5, hour: 16, minute: 0 }],
  ["Đổi lịch tự động phát hành lương tạm tính sang ngày 22/12 lúc 9 giờ 45 phút", "payroll.reconciliation.schedule.update", { day: 22, hour: 9, minute: 45 }],
  ["Đổi lịch phát hành lương tạm tính sang ngày 8 hằng tháng lúc 10:30", "payroll.reconciliation.schedule.update", { day: 8, hour: 10, minute: 30, recurrence: "monthly" }],
  ["Giúp tôi phát hành bảng lương tạm tính", "payroll.run.reconciliation.publish", {}],
  ["Phát hành bảng lương tạm tính tháng 2/2028", "payroll.run.reconciliation.publish", { path_id: "2028-02" }],
  ["Phát hành bảng lương tạm tính tháng 10", "payroll.run.reconciliation.publish", { path_id: "2026-10" }],
  ["Phát hành bảng lương tạm tính kỳ 2025-10", "payroll.run.reconciliation.publish", { path_id: "2025-10" }],
  ["Các khoản nào đang cần chờ duyệt", "payroll.adjustment.list", { status: "pending" }],
  ["Xem các khoản lương chờ duyệt kỳ 2027-04", "payroll.adjustment.list", { path_periodKey: "2027-04", status: "pending" }],
  ["Đổi chính sách lương thành Lương mới 2026", "payroll.policy.update", { name: "Lương mới 2026" }],
  ["Đổi tên chính sách lương Chính sách A thành Thu nhập 2028", "payroll.policy.update", { path_id: "Chính sách A", name: "Thu nhập 2028" }],
  ["Cập nhật lương cơ bản của chính sách Thu nhập 2028 lên 4,5 triệu", "payroll.policy.update", { path_id: "Thu nhập 2028", baseSalary: 4500000 }],
  ["Cập nhật lương cơ bản của nhân sự Nguyễn Anh lên 3450k", "employee.update", { id: "Nguyễn Anh", monthlySalary: 3450000 }],
  ["Sửa lương cơ bản cho Lê Thu Hà thành 8.750.000 đồng", "employee.update", { id: "Lê Thu Hà", monthlySalary: 8750000 }],
  ["Cap nhat luong co ban cua nhan vien Tran Minh len 9200k", "employee.update", { id: "Tran Minh", monthlySalary: 9200000 }],
  ["Sua luong co ban cua chinh sach Thu nhap moi len 5,2 trieu", "payroll.policy.update", { path_id: "Thu nhap moi", baseSalary: 5200000 }],
  ["Cập nhật lương cơ bản của chính sách Thành 2027 lên 6500k", "payroll.policy.update", { path_id: "Thành 2027", baseSalary: 6500000 }],
] as const)("handles variable data without fixed spreadsheet values: %s", async (text, actionId, values) => {
  const result = await interpretRequest(text, workflows, null, []);
  expect(result).toMatchObject({ actionId, values });
});

it.each(["3450k", "4,5 triệu", "4.5tr", "3.450.000", "3,450,000", "8750 nghìn"])("parses a supplied money amount: %s", amount => {
  expect(payrollAmount(`Cập nhật lương cơ bản lên ${amount}`)).toBe(["4,5 triệu", "4.5tr"].includes(amount) ? 4500000 : amount === "8750 nghìn" ? 8750000 : 3450000);
});

it("asks which salary is intended and preserves the selected pending policy on a follow-up", async () => {
  expect(await interpretRequest("Cập nhật lương cơ bản lên 3450k", workflows, null, [])).toMatchObject({
    actionId: null, intentType: "ambiguous", suggestedActionIds: ["employee.update", "payroll.policy.update"],
  });
  expect(await interpretRequest("Cập nhật lương cơ bản lên 7200k", workflows, {
    actionId: "payroll.policy.update", values: { path_id: "Chính sách B" },
  }, [])).toMatchObject({ actionId: "payroll.policy.update", newRequest: false, values: { baseSalary: 7200000 } });
});

it("resolves a month-only payroll period against the current Vietnam year", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-17T18:00:00Z"));
  const result = await interpretRequest("Phát hành bảng lương tạm tính tháng 10", workflows, null, []);
  expect(result).toMatchObject({ actionId: "payroll.run.reconciliation.publish", values: { path_id: "2026-10" } });
});

it("does not silently convert a specific date into a monthly schedule", async () => {
  const result = await interpretRequest("Đổi lịch phát hành lương tạm tính sang ngày 19/4 lúc 8 giờ", workflows, null, []);
  expect(result.values.recurrence).toBeUndefined();
  expect(await interpretRequest("Hằng tháng", workflows, { actionId: result.actionId, values: result.values }, []))
    .toMatchObject({ actionId: result.actionId, newRequest: false, values: { recurrence: "monthly" } });
});

it("does not return disabled or unavailable payroll operations", () => {
  expect(directPayrollRequest("Giúp tôi phát hành bảng lương tạm tính", [], null)).toBeNull();
  expect(directPayrollRequest("Tổng hợp khiếu nại về bảng lương", workflows.map(workflow => ({ ...workflow, enabled: false })), null)).toBeNull();
});

it.each([
  ["2027-01-01T00:30:00Z", "2026-12-01", "2026-12-31", "2027-01-01"],
  ["2028-03-01T00:30:00Z", "2028-02-01", "2028-02-29", "2028-03-01"],
  ["2028-02-29T18:00:00Z", "2028-02-01", "2028-02-29", "2028-03-01"],
])("test keys 71–73 use the current Vietnam date, including year boundaries: %s", async (now, start, end, today) => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  for (const [text, reportKind] of [["Nhân sự nào xin nghỉ nhiều nhất tháng qua", "leave-most"], ["Nhân sự nào làm online nhiều nhất tháng qua", "wfh-most"]]) {
    expect(await interpretRequest(text, workflows, null, [])).toMatchObject({ actionId: "hr.leave.applications.list", values: { rangeStart: start, rangeEnd: end, reportKind } });
  }
  expect(await interpretRequest("Ngày hôm nay có lịch gì không?", workflows, null, [])).toMatchObject({ actionId: "hr.calendar.events.list", values: { rangeStart: today, rangeEnd: today } });
});

it("honors a supplied report year and calendar date", async () => {
  expect(await interpretRequest("Nhân sự nào xin nghỉ nhiều nhất tháng 2 năm 2028", workflows, null, [])).toMatchObject({ values: { rangeStart: "2028-02-01", rangeEnd: "2028-02-29" } });
  expect(await interpretRequest("Ngày 14/8/2029 có lịch gì không?", workflows, null, [])).toMatchObject({ values: { rangeStart: "2029-08-14", rangeEnd: "2029-08-14" } });
});
