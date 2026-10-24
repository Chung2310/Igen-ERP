import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { scheduleCampaignFacebookContent } from "./campaign-content-schedule";
import { assertCampaignContentLinks } from "./campaign-uploaded-media.service";

const mocks = vi.hoisted(() => ({ content: vi.fn(), campaign: vi.fn(), touch: vi.fn(), slot: vi.fn(), duplicate: vi.fn(), edit: vi.fn(), sync: vi.fn(), credentials: vi.fn() }));
vi.mock("../model/marketing-content.model", () => ({ MarketingContentModel: { findOne: mocks.content } }));
vi.mock("../model/marketing-campaign.model", () => ({ MarketingCampaignModel: { findOne: mocks.campaign, updateOne: mocks.touch, exists: async () => true } }));
vi.mock("../model/marketing-campaign-slot.model", () => ({ MarketingCampaignSlotModel: { findOne: mocks.slot, exists: mocks.duplicate } }));
vi.mock("./campaign-slot-edit", () => ({ withCampaignSlotEdit: mocks.edit, syncCampaignSheetFields: mocks.sync }));
vi.mock("./agents/campaign-utils", () => ({ resolveFacebookCredentials: mocks.credentials }));
vi.mock("../../shared/socket", () => ({ broadcastEvent: vi.fn() }));
const campaignId = "100000000000000000000001", slotId = "200000000000000000000001", integrationId = "300000000000000000000001";
const input = { companyCode: "A", contentId: "card", approvedBy: "operator", scheduledDate: "2027-01-10", scheduledTime: "09:30", integrationId };
const card = { _id: "card", companyCode: "A", campaignId, campaignSlotId: slotId, channel: "Facebook", status: "approved", integrationId, save: vi.fn() };
const slot = { _id: slotId, companyCode: "A", campaignId, marketingContentId: "card", platform: "Facebook", status: "pending_approval", scheduledAt: new Date("2027-01-09T00:00:00Z"), save: vi.fn(), transitions: [] as unknown[] };
const campaign = { _id: campaignId, timezone: "Asia/Bangkok", startDate: "2027-01-01", endDate: "2027-01-31", createdBy: "owner", verificationLeadMinutes: 15 };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-01T00:00:00Z")); vi.resetAllMocks();
  Object.assign(card, { status: "approved", scheduledDate: undefined, scheduledTime: undefined, integrationId });
  Object.assign(slot, { status: "pending_approval", scheduledAt: new Date("2027-01-09T00:00:00Z"), publishRequestedAt: undefined, transitions: [] });
  mocks.content.mockReturnValue({ lean: async () => card, session: async () => card });
  mocks.campaign.mockReturnValue({ session: async () => campaign });
  mocks.slot.mockReturnValue({ lean: async () => slot });
  mocks.duplicate.mockReturnValue({ session: async () => false });
  mocks.touch.mockResolvedValue({ matchedCount: 1 });
  mocks.edit.mockImplementation(async (_input, work) => work(slot, "transaction"));
});
afterEach(() => vi.useRealTimers());
it("updates the slot and card in one transaction, revalidates readiness, and leaves publishing to the worker", async () => {
  await expect(scheduleCampaignFacebookContent(input)).resolves.toMatchObject({ campaignScheduled: true, scheduledAt: "2027-01-10T02:30:00.000Z" });
  expect(slot).toMatchObject({ status: "verifying", approvedBy: "operator", attemptCount: 0 });
  expect(card).toMatchObject({ status: "scheduled", scheduledDate: "2027-01-10", scheduledTime: "09:30" });
  expect(slot.save).toHaveBeenCalledWith({ session: "transaction" });
  expect(card.save).toHaveBeenCalledWith({ session: "transaction" });
  expect(mocks.sync).toHaveBeenCalledWith("A", campaignId, slotId, { scheduledAt: "2027-01-10T02:30:00.000Z" }, "transaction", "operator");
  expect(mocks.credentials).toHaveBeenCalledWith({ companyCode: "A", createdBy: "owner", integrationId });
});
it("rejects ambiguous previous publication before any save", async () => {
  Object.assign(slot, { publishRequestedAt: new Date() });
  await expect(scheduleCampaignFacebookContent(input)).rejects.toMatchObject({ statusCode: 409 });
  expect(card.save).not.toHaveBeenCalled();
});
it.each(["2026-01-01", "2027-02-01"])("rejects past/out-of-range schedules: %s", async scheduledDate => {
  await expect(scheduleCampaignFacebookContent({ ...input, scheduledDate })).rejects.toMatchObject({ statusCode: 400 });
  expect(slot.save).not.toHaveBeenCalled();
});
it("rejects a second slot at the same instant and platform", async () => {
  mocks.duplicate.mockReturnValue({ session: async () => true });
  await expect(scheduleCampaignFacebookContent(input)).rejects.toMatchObject({ statusCode: 409 });
  expect(slot.save).not.toHaveBeenCalled();
});
it("rejects paused or foreign campaigns before saving", async () => {
  mocks.campaign.mockReturnValue({ session: async () => null });
  await expect(scheduleCampaignFacebookContent(input)).rejects.toMatchObject({ statusCode: 409 });
  expect(mocks.campaign).toHaveBeenCalledWith({ _id: campaignId, companyCode: "A", status: "active" });
  expect(slot.save).not.toHaveBeenCalled();
});
it.each([{ status: "scheduled" }, { scheduledDate: "2027-01-10" }, { integrationId: "another-page" }])("blocks generic card PATCH from bypassing the campaign schedule: %j", async changes => {
  await expect(assertCampaignContentLinks("A", changes, card)).rejects.toMatchObject({ statusCode: 409 });
});
