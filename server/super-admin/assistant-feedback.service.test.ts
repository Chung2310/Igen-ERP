import { afterEach, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({ aggregate: vi.fn(), branchFind: vi.fn() }));
vi.mock("../assistant/models", () => ({ AssistantSessionModel: { aggregate: stubs.aggregate } }));
vi.mock("../model/branch.model", () => ({ BranchModel: { find: stubs.branchFind } }));

import { superAdminAssistantFeedbackService } from "./assistant-feedback.service";

afterEach(() => vi.clearAllMocks());

it("filters ERP assistant feedback and returns report totals", async () => {
  stubs.aggregate.mockResolvedValue([{
    summary: [{ total: 3, average: 4.25, lowRatingCount: 1 }],
    items: [{ companyCode: "ACME", branchId: "", rating: 2, answer: "Đã tạo phiếu.", submittedAt: new Date("2026-11-28T04:00:00.000Z") }],
  }]);

  const result = await superAdminAssistantFeedbackService.list({ from: "2026-11-28", to: "2026-11-28", companyCode: "ACME", rating: 2, search: "thiếu", page: 2, limit: 10 });

  const pipeline = stubs.aggregate.mock.calls[0][0];
  expect(pipeline[0].$match).toMatchObject({ mode: "work", companyCode: "ACME" });
  expect(pipeline[1].$unwind).toBe("$messages");
  expect(pipeline[2].$match["messages.feedback.rating"]).toBe(2);
  expect(pipeline[2].$match["messages.feedback.submittedAt"].$gte.toISOString()).toBe("2026-11-27T17:00:00.000Z");
  expect(pipeline.some((stage: any) => stage.$match?.$or)).toBe(true);
  expect(result).toMatchObject({ total: 3, page: 2, limit: 10, summary: { total: 3, averageRating: 4.3, lowRatingCount: 1 } });
  expect(result.items[0].branchName).toBe("Toàn doanh nghiệp");
});
