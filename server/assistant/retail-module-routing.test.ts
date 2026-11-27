import { describe, expect, it } from "vitest";
import { defaultWorkflow, operationById } from "./catalog";
import { validateRequestCoverage } from "./request-coverage";
import { mentionsCompatibleModule } from "./module-context";

describe("retail module context routing", () => {
  it("accepts store wording as retail context for an explicit sales report", () => {
    const operation = operationById("retail.report.summary")!;
    const workflow = defaultWorkflow(operation);

    expect(validateRequestCoverage(
      "Hôm nay cửa hàng bán được bao nhiêu đơn và tổng doanh thu là bao nhiêu?",
      [{
        evidence: "cửa hàng",
        requirement: "Ngữ cảnh cửa hàng bán lẻ",
        mappedTo: ["context.module"],
      }],
      workflow,
      operation,
      {},
    )).toEqual({ ok: true });
  });

  it("does not infer retail from a cash and transfer question without store context", () => {
    expect(mentionsCompatibleModule("Hôm nay thu tiền mặt bao nhiêu, chuyển khoản về bao nhiêu?", "retail")).toBe(false);
  });
});
