import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { assistantFunctionContextCatalog, assistantFunctionKeys, inferAnalyticalFunctionKeys, isExplicitReadOnlyRequest } from "./function-context";

it('keeps cross-cutting read capabilities discoverable from their business function', () => {
  expect(assistantFunctionKeys(defaultWorkflow(operationById('student.batch.attendance.summary')!))).toContain('student:attendance');
  expect(assistantFunctionKeys(defaultWorkflow(operationById('student.batch.detail')!))).toContain('student:schedule');
  const catalog = assistantFunctionContextCatalog(ASSISTANT_OPERATIONS.filter(op=>op.module==='student').map(defaultWorkflow));
  expect(catalog.find(group=>group.key==='student:attendance')?.examples).toContain('Báo cáo điểm danh lớp học theo ngày');
});
it('constrains an explicit read without classifying a write or a mixed request as read-only', () => {
  expect(isExplicitReadOnlyRequest('Báo cáo tiến độ QA')).toBe(true);
  for (const text of ['Thêm báo cáo tiến độ QA','Xem rồi sửa dự án QA','Ghi nhận tiến độ 50%','Xem trước dữ liệu nhập đơn hàng']) expect(isExplicitReadOnlyRequest(text)).toBe(false);
});

describe("assistant function context", () => {
  it("groups HR workflows into function areas instead of CRUD actions", () => {
    const workflows = ["employee.list", "recruitment.applicant.list", "hr.contract.create", "hr.calendar.event.create"]
      .map(id => defaultWorkflow(operationById(id)!));
    const catalog = assistantFunctionContextCatalog(workflows);

    expect(catalog.map(feature => [feature.key, feature.label])).toEqual(expect.arrayContaining([
      ["hr:employee", "Hồ sơ nhân sự"],
      ["hr:recruitment", "Tuyển dụng"],
      ["hr:contract", "Hợp đồng"],
      ["hr:calendar", "Lịch"],
    ]));
  });

  it("separates partner KPI analysis from partner policies and referral operations", () => {
    const workflows = ASSISTANT_OPERATIONS.filter(operation => operation.module === "labor-partner").map(defaultWorkflow);
    const catalog = assistantFunctionContextCatalog(workflows);
    const ranking = "Trong quản lí lao động, Đối tác nào giới thiệu được nhiều lao động nhất trong tháng";

    expect(catalog.map(feature => feature.key)).toEqual(expect.arrayContaining([
      "labor-partner:partner-referral-analysis",
      "labor-partner:partner-policies",
      "labor-partner:partner-referrals",
      "labor-partner:partner-settlements",
    ]));
    expect(inferAnalyticalFunctionKeys(ranking, catalog)).toEqual(["labor-partner:partner-referral-analysis"]);
  });
});
