import { afterEach, expect, it, vi } from "vitest";
import { MarketingCampaignModel } from "../model/marketing-campaign.model.ts";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model.ts";
import { CampaignSheetConfigModel } from "../model/campaign-content-sheet.model.ts";
import { campaignContentSheetService } from "./campaign-content-sheet.service.ts";

afterEach(() => vi.restoreAllMocks());

it("lists editable Content Sheet slots with safe visible labels for the assistant", async () => {
  const campaignId = "507f1f77bcf86cd799439701";
  const slotId = "507f1f77bcf86cd799439702";
  vi.spyOn(MarketingCampaignModel, "findOne").mockReturnValue({
    lean: async () => ({ _id: campaignId, companyCode: "ACME", title: "Chiến dịch tháng 11" }),
  } as any);
  const query = {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([{
      _id: slotId,
      scheduledAt: new Date("2026-11-03T09:00:00.000Z"),
      platform: "Facebook",
      status: "planned",
      integrationId: { displayName: "Trang Igen" },
      fields: { private: { value: "Nội dung riêng" } },
    }]),
  };
  const findSlots = vi.spyOn(MarketingCampaignSlotModel, "find").mockReturnValue(query as any);

  const rows = await campaignContentSheetService.listAssistantSlots("ACME", campaignId);

  expect(findSlots).toHaveBeenCalledWith({
    companyCode: "ACME",
    campaignId,
    status: { $nin: ["published", "cancelled"] },
  });
  expect(query.select).toHaveBeenCalledWith("_id scheduledAt platform status integrationId");
  expect(rows).toEqual([{
    id: slotId,
    name: "Dòng 1 — 2026-11-03 09:00 — Facebook — Trang Igen — planned",
    scheduledAt: "2026-11-03T09:00:00.000Z",
    platform: "Facebook",
    page: "Trang Igen",
    status: "planned",
  }]);
  expect(JSON.stringify(rows)).not.toContain("Nội dung riêng");
});

it("lists selectable Content Sheet columns without exposing AI instructions or defaults", async () => {
  const campaignId = "507f1f77bcf86cd799439711";
  vi.spyOn(MarketingCampaignModel, "findOne").mockReturnValue({
    lean: async () => ({ _id: campaignId, companyCode: "ACME", title: "Chiến dịch tháng 11" }),
  } as any);
  const config = {
    columns: [{
      id: "column-hook",
      key: "hook",
      label: "Câu mở đầu",
      kind: "custom",
      dataType: "short_text",
      required: true,
      archived: false,
      options: ["Không cần lộ trong bộ chọn"],
      defaultValue: "Không cần lộ trong bộ chọn",
      fieldPolicy: "input",
      ai: { instruction: "Không cần lộ trong bộ chọn" },
      display: { order: 1 },
    }],
    save: vi.fn().mockResolvedValue(undefined),
  };
  vi.spyOn(CampaignSheetConfigModel, "findOneAndUpdate").mockResolvedValue(config as any);

  const columns = await campaignContentSheetService.listAssistantColumns("ACME", campaignId);

  expect(columns).toContainEqual({
    id: "column-hook",
    name: "Câu mở đầu (hook)",
    label: "Câu mở đầu",
    key: "hook",
    kind: "custom",
    dataType: "short_text",
    required: true,
    fieldPolicy: "input",
  });
  expect(JSON.stringify(columns)).not.toContain("Không cần lộ trong bộ chọn");
});
