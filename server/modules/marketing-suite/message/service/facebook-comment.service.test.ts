import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { facebookCommentService } from "./facebook-comment.service";

const mocks = vi.hoisted(() => ({ log: vi.fn(), createLog: vi.fn(), claim: vi.fn(), update: vi.fn(), owner: vi.fn(), knowledge: vi.fn() }));
vi.mock("./ai-auto-reply.service.ts", () => ({ resolveAutoReplyOwner: mocks.owner, ensureFacebookAutoReplyEnabled: async (owner: unknown) => owner }));
vi.mock("../../knowledge/service/ai-knowledge.service.ts", () => ({ aiKnowledgeService: { searchRelevantContext: mocks.knowledge, searchScenarioContext: async () => ({}) } }));
vi.mock("../../shared/service/gemini.service.ts", () => ({ geminiService: {} }));
vi.mock("./fb-messenger.service.ts", () => ({ fbMessengerService: {} }));
vi.mock("../model/ai-reply-log.model.ts", () => ({ AIReplyLogModel: { findOne: mocks.log, create: mocks.createLog } }));
vi.mock("../model/facebook-comment-delivery.model", () => ({ FacebookCommentDeliveryModel: { init: async () => {}, findOneAndUpdate: mocks.claim, updateOne: mocks.update } }));
vi.mock("../../shared/service/ai-subscription.service", () => ({ withAiUsage: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ companyCode: "A", aiConfig: { enabled: true, commentReplyEnabled: true } });
  mocks.log.mockImplementation(async filter => filter.status === "sent" ? null : { status: "failed" });
  mocks.claim.mockResolvedValue({ status: "processing" });
  mocks.update.mockResolvedValue({ modifiedCount: 1 });
  mocks.createLog.mockResolvedValue({});
  mocks.knowledge.mockRejectedValue(new Error("temporary context failure"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const comment = { comment_id: "comment", post_id: "post", verb: "add", message: "Hello", from: { id: "customer" } };
it("retries a known pre-send failure on redelivery, with tenant-scoped logs", async () => {
  await facebookCommentService.handleIncomingComment("page", comment);
  await facebookCommentService.handleIncomingComment("page", comment);
  expect(mocks.claim).toHaveBeenCalledTimes(2);
  expect(mocks.log).toHaveBeenCalledWith({ companyCode: "A", channel: "facebook_comment", commentId: "comment", status: "sent" });
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "A" }), expect.objectContaining({ $set: { status: "failed" } }));
});
it("never retries a sent comment", async () => {
  mocks.log.mockResolvedValue({ status: "sent" });
  await facebookCommentService.handleIncomingComment("page", comment);
  expect(mocks.claim).not.toHaveBeenCalled();
});
it("leaves sent/sending/unknown durable deliveries blocked even if the log says failed", async () => {
  mocks.claim.mockRejectedValue({ code: 11000 });
  await facebookCommentService.handleIncomingComment("page", comment);
  expect(mocks.knowledge).not.toHaveBeenCalled();
  expect(mocks.claim.mock.calls[0][0].$or).toEqual([{ status: "failed" }, { status: "processing", lockExpiresAt: { $lte: expect.any(Date) } }]);
});
