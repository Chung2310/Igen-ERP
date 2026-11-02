import { beforeEach, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { schedulerController } from "./scheduler.controller";
const mocks = vi.hoisted(() => ({ find: vi.fn(), schedule: vi.fn(), n8n: vi.fn() }));
vi.mock("../model/marketing-content.model", () => ({ MarketingContentModel: { findOne: mocks.find } }));
vi.mock("../service/campaign-content-schedule", () => ({ scheduleCampaignFacebookContent: mocks.schedule }));
vi.mock("../service/scheduler.service.ts", () => ({ schedulerService: { sendScheduleToN8n: mocks.n8n } }));
beforeEach(() => vi.resetAllMocks());
const request = { user: { id: "operator", companyCode: "A" }, body: { cardId: "card", scheduledDate: "2027-01-10", scheduledTime: "09:30" } } as unknown as Request;
function response() { const res = { status: vi.fn(), json: vi.fn() }; res.status.mockReturnValue(res); return res; }
it("keeps Campaign-linked content out of the standalone n8n scheduling flow", async () => {
  mocks.find.mockReturnValue({ lean: async () => ({ _id: "card", campaignSlotId: "slot" }) });
  mocks.schedule.mockResolvedValue({ campaignScheduled: true });
  const res = response();
  await schedulerController.schedulePost(request, res as unknown as Response);
  expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({ companyCode: "A", contentId: "card", approvedBy: "operator" }));
  expect(mocks.n8n).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { campaignScheduled: true } }));
});
it("preserves standalone scheduling", async () => {
  mocks.find.mockReturnValue({ lean: async () => ({ _id: "card" }) });
  const res = response();
  await schedulerController.schedulePost(request, res as unknown as Response);
  expect(mocks.n8n).toHaveBeenCalledWith(request.body);
  expect(mocks.schedule).not.toHaveBeenCalled();
});
it("rejects an absent or foreign card before any scheduling side effect", async () => {
  mocks.find.mockReturnValue({ lean: async () => null });
  const res = response();
  await schedulerController.schedulePost(request, res as unknown as Response);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(mocks.n8n).not.toHaveBeenCalled();
  expect(mocks.schedule).not.toHaveBeenCalled();
});
