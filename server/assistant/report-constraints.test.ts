import { expect, it } from "vitest";
import { operationById } from "./catalog";
import { missingReportConstraint } from "./report-constraints";

it.each([
  ["employee.count", "Đếm nhân viên lương trên 20 triệu"],
  ["student.list", "Liệt kê học viên học phí dưới 5 triệu"],
  ["quotation.quote.list", "Tìm dự toán tổng tiền trên 100 triệu"],
  ["student.list", "Học viên công nợ ít nhất 3 triệu"],
])("blocks omitted numerical filters across modules: %s", (id, request) => {
  expect(missingReportConstraint(request, operationById(id)!, {})).toBeTruthy();
});
it.each([
  {},
  { from: "2026-10-01", to: "2026-10-31" },
  { from: "2026-11-01", to: "2026-12-31" },
  { from: "2026-11-01" },
])("blocks omitted, incorrect, oversized or incomplete periods: %j", values => {
  expect(missingReportConstraint("Danh sách dự toán tháng 11/2026", operationById("quotation.quote.list")!, values)).toBeTruthy();
});
it("accepts a complete correct period and requests without additional filters", () => {
  expect(missingReportConstraint("Danh sách dự toán tháng 11/2026", operationById("quotation.quote.list")!, { from: "2026-11-01", to: "2026-11-30" })).toBeUndefined();
  expect(missingReportConstraint("Xem danh sách dự toán", operationById("quotation.quote.list")!, {})).toBeUndefined();
  expect(missingReportConstraint("Tạo báo giá tổng tiền trên 100 triệu", operationById("quotation.customer-quote.create")!, {})).toBeUndefined();
});
it("checks both explicit calendar boundaries even when the model returns no date fields", () => {
  const op = operationById("employee.count")!;
  const request = "Đếm hồ sơ được tạo từ 01/11 đến 30/11/2026";
  expect(missingReportConstraint(request, op, {})).toBeTruthy();
  expect(missingReportConstraint(request, op, { createdFrom: "2026-11-01", createdTo: "2026-12-30" })).toBeTruthy();
  expect(missingReportConstraint(request, op, { createdFrom: "2026-11-01", createdTo: "2026-11-30" })).toBeUndefined();
});
it("does not accept a numeric analysis condition with the wrong operator or amount", () => {
  const op = { ...operationById("partner.analysis")!, analysis: { fields: { debt: { label: "Công nợ", type: "number" as const } } } };
  const request = "Đối tác công nợ trên 3 triệu";
  expect(missingReportConstraint(request, op, { analysis: JSON.stringify({ filters: [{ field: "debt", operator: "gt", value: 3000000 }] }) })).toBeUndefined();
  expect(missingReportConstraint(request, op, { analysis: JSON.stringify({ filters: [{ field: "debt", operator: "lt", value: 3000000 }] }) })).toBeTruthy();
  expect(missingReportConstraint(request, op, { analysis: JSON.stringify({ filters: [{ field: "debt", operator: "gt", value: 3 }] }) })).toBeTruthy();
});
