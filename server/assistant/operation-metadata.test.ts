import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS } from "./catalog";

describe("assistant operation metadata", () => {
  it('never derives a mutation from words inside a read capability title', () => {
    for (const op of ASSISTANT_OPERATIONS.filter(op=>op.method==='GET'||op.readOnly)) expect(op.assistantMetadata?.action,op.id).toBe('read');
    expect(ASSISTANT_OPERATIONS.find(op=>op.id==='hr.training.progress')?.assistantMetadata).toMatchObject({action:'read',intent:'report'});
  });
  it("classifies every catalog operation from its canonical contract", () => {
    expect(ASSISTANT_OPERATIONS.length).toBeGreaterThan(0);
    for (const operation of ASSISTANT_OPERATIONS) {
      expect(operation.assistantMetadata, operation.id).toBeDefined();
      expect(operation.assistantMetadata?.action, operation.id).toBeTruthy();
      expect(operation.assistantMetadata?.intent, operation.id).toBeTruthy();
      expect(operation.assistantMetadata?.effect, operation.id).toBe(operation.readOnly || operation.method === "GET" ? "read" : "write");
      expect(operation.assistantMetadata?.featureKey, operation.id).toBeTruthy();
      expect(operation.assistantMetadata?.featureLabel, operation.id).toBeTruthy();
      expect(operation.assistantMetadata?.searchTerms.length, operation.id).toBeGreaterThan(0);
      expect(operation.assistantMetadata?.requiredInputs, operation.id).toEqual(operation.fields
        .filter(field => field.required || field.systemRequired).map(field => field.key));
    }
  });

  it("distinguishes lookup, report, and write actions", () => {
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.list")?.assistantMetadata)
      .toMatchObject({ action: "read", intent: "lookup", effect: "read" });
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.count")?.assistantMetadata)
      .toMatchObject({ action: "read", intent: "report", effect: "read" });
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.create")?.assistantMetadata)
      .toMatchObject({ action: "create", intent: "create", effect: "write", confirmationRequired: true });
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.update")?.assistantMetadata)
      .toMatchObject({ action: "update", intent: "update", effect: "write" });
    expect(ASSISTANT_OPERATIONS.find(operation => operation.id === "employee.delete")?.assistantMetadata)
      .toMatchObject({ action: "delete", intent: "delete", effect: "write" });
  });

  it("separates function areas from action type within the same module", () => {
    const feature = (id: string) => ASSISTANT_OPERATIONS.find(operation => operation.id === id)?.assistantMetadata;
    expect(feature("employee.list")).toMatchObject({ featureKey: "employee", featureLabel: "Hồ sơ nhân sự", action: "read" });
    expect(feature("recruitment.applicant.list")).toMatchObject({ featureKey: "recruitment", featureLabel: "Tuyển dụng", action: "read" });
    expect(feature("hr.contract.create")).toMatchObject({ featureKey: "contract", featureLabel: "Hợp đồng", action: "create" });
    expect(feature("hr.calendar.event.create")).toMatchObject({ featureKey: "calendar", featureLabel: "Lịch", action: "create" });

    const laborKpi = ASSISTANT_OPERATIONS.find(operation => operation.path === "/worker-management/partners/kpi")!;
    expect(laborKpi.assistantMetadata).toMatchObject({ featureKey: "partner-referral-analysis", featureLabel: "Phân tích KPI và lượt giới thiệu lao động" });
    expect(feature("worker.partner.policy.list")?.featureKey).toBe("partner-policies");
    expect(feature("worker.partner.referrals.list")?.featureKey).toBe("partner-referrals");
  });

  it("keeps retrieval metadata free of credential fields", () => {
    for (const operation of ASSISTANT_OPERATIONS) {
      const metadata = operation.assistantMetadata!;
      expect(metadata.searchTerms.join(" ")).not.toMatch(/password|secret|token|credential|cookie|authorization|mật khẩu|mã xác thực|khóa bí mật/i);
    }
  });
});
