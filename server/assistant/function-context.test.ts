import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow, operationById } from "./catalog";
import { assistantFunctionContextCatalog, inferAnalyticalFunctionKeys } from "./function-context";

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

  it("includes a short action purpose in module and function discovery context", () => {
    const workflows = ["retail.report.summary", "retail.order.list"].map(id => defaultWorkflow(operationById(id)!));
    const catalog = assistantFunctionContextCatalog(workflows);
    const report = catalog.find(feature => feature.key === "retail:retail");
    const orders = catalog.find(feature => feature.key === "retail:order");

    expect(report?.purpose).toContain("tiền thu tiền mặt và chuyển khoản");
    expect(orders?.purpose).toContain("Đã giao/bán xong");
  });
});
