import { describe, expect, it } from "vitest";
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { buildAssistantCapabilityContext } from "./capability-context";

describe("buildAssistantCapabilityContext", () => {
  it("exposes authorized report measures, their aliases, and result fields", () => {
    const operation = ASSISTANT_OPERATIONS.find(item => item.path === "/worker-management/partners/kpi")!;
    const [context] = buildAssistantCapabilityContext([defaultWorkflow(operation)]);

    expect(context).toMatchObject({
      actionId: operation.id,
      module: operation.module,
      effect: "read",
      classification: { action: "read", intent: "report", featureKey: "partner-referral-analysis", featureLabel: "Phân tích KPI và lượt giới thiệu lao động" },
      outputs: operation.resultFields,
      analysis: { fields: { actualReferrals: { label: "Đã giới thiệu", type: "number" } } },
    });
    expect(context.classification?.capabilities).toEqual(expect.arrayContaining(["analysis", "query-filters", "structured-results"]));
    expect(context.analysis?.fields.actualReferrals.aliases).toContain("lao động được giới thiệu");
    expect(JSON.stringify(context)).not.toContain(operation.path);
  });

  it("marks write workflows as confirmation-gated and includes only passed workflows", () => {
    const create = ASSISTANT_OPERATIONS.find(item => item.id === "employee.create")!;
    const other = ASSISTANT_OPERATIONS.find(item => item.id === "employee.list")!;
    const [context] = buildAssistantCapabilityContext([defaultWorkflow(create)]);

    expect(context).toMatchObject({
      actionId: "employee.create",
      effect: "write",
      confirmationRequired: true,
      classification: { action: "create", intent: "create" },
    });
    expect(context.classification?.capabilities).toEqual(expect.arrayContaining(["confirmation-required", "reference-resolution", "structured-results"]));
    expect(buildAssistantCapabilityContext([defaultWorkflow(create)]).map(item => item.actionId)).toEqual([create.id]);
    expect(buildAssistantCapabilityContext([defaultWorkflow(other)]).map(item => item.actionId)).not.toContain(create.id);
  });
});
