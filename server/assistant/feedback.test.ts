import { afterEach, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(),
  patchFindOneAndUpdate: vi.fn(),
  patchUpdateOne: vi.fn(),
  actorScope: vi.fn((req: any) => ({ userId: req.user.id, companyCode: req.user.companyCode })),
}));

vi.mock("./models", () => ({ AssistantSessionModel: { findOne: stubs.findOne, updateOne: stubs.updateOne }, AssistantFeedbackPatchModel: { findOneAndUpdate: stubs.patchFindOneAndUpdate, updateOne: stubs.patchUpdateOne } }));
vi.mock("./workflows", () => ({ actorScope: stubs.actorScope }));

import { saveAssistantAnswerFeedback } from "./feedback";

const answerAt = "2026-11-28T04:00:00.000Z";
const session = {
  _id: "session-1",
  messages: [
    { role: "user", content: "Tạo phiếu nghỉ phép", createdAt: "2026-11-28T03:59:00.000Z" },
    { role: "assistant", content: "Đã tạo phiếu nghỉ phép.", createdAt: answerAt },
  ],
};
const req = { user: { id: "user-1", companyCode: "ACME", branchId: "branch-1", role: "user", displayName: "Nguyễn An", email: "an@example.com" } } as any;

afterEach(() => vi.clearAllMocks());

it("saves feedback on the owned assistant answer and keeps its question for reporting", async () => {
  stubs.findOne.mockReturnValue({ select: () => ({ lean: async () => session }) });
  stubs.updateOne.mockResolvedValue({ matchedCount: 1 });
  stubs.patchFindOneAndUpdate.mockReturnValue({ lean: async () => ({ status: "queued" }) });

  const result = await saveAssistantAnswerFeedback(req, {
    conversationId: "conversation-1", answerAt: "2026-11-28T04:00:00.500Z", rating: 2, comment: "Thiếu thông tin",
  });

  expect(stubs.findOne).toHaveBeenCalledWith({ userId: "user-1", companyCode: "ACME", branchId: "branch-1", conversationId: "conversation-1", mode: "work" });
  const [filter, update] = stubs.updateOne.mock.calls[0];
  expect(filter["messages.1.content"]).toBe("Đã tạo phiếu nghỉ phép.");
  expect(update.$set["messages.1.feedback"]).toMatchObject({
    rating: 2,
    comment: "Thiếu thông tin",
    question: "Tạo phiếu nghỉ phép",
    displayName: "Nguyễn An",
    email: "an@example.com",
  });
  expect(result.rating).toBe(2);
  expect(result.improvementStatus).toBe("queued");
  expect(stubs.patchFindOneAndUpdate).toHaveBeenCalledWith(
    { feedbackKey: "session-1:2026-11-28T04:00:00.000Z" },
    { $setOnInsert: expect.objectContaining({ status: "queued", rating: 2, question: "Tạo phiếu nghỉ phép" }) },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
});

it("rejects feedback when the timestamp does not identify a recent answer", async () => {
  stubs.findOne.mockReturnValue({ select: () => ({ lean: async () => session }) });

  await expect(saveAssistantAnswerFeedback(req, {
    conversationId: "conversation-1", answerAt: "2026-11-28T06:00:00.000Z", rating: 5, comment: "Không liên quan",
  })).rejects.toThrow("Không tìm thấy câu trả lời cần đánh giá");
  expect(stubs.updateOne).not.toHaveBeenCalled();
});
