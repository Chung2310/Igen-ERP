import { MarketingCampaignModel } from "../model/marketing-campaign.model";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { zonedLocalTimeToUtc } from "./marketing-campaign-schedule.service";

export type PublicCampaignClaims = {
  campaignId: string;
  companyCode: string;
  slotId?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
};

export function nextCalendarDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ngày chia sẻ không hợp lệ.");
  const value = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw new Error("Ngày chia sẻ không hợp lệ.");
  }
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function publicCampaignSlotScope(claims: PublicCampaignClaims) {
  if (!claims.campaignId || !claims.companyCode) throw new Error("Token không chứa đầy đủ thông tin.");
  const campaign = await MarketingCampaignModel.findOne({ _id: claims.campaignId, companyCode: claims.companyCode })
    .select("timezone").lean();
  if (!campaign) throw new Error("Không tìm thấy chiến dịch.");
  const scope: Record<string, unknown> = { campaignId: claims.campaignId, companyCode: claims.companyCode };
  if (claims.date || claims.startDate || claims.endDate) {
    const start = claims.date || claims.startDate;
    const end = claims.date || claims.endDate;
    if (!start || !end || start > end) throw new Error("Khoảng ngày chia sẻ không hợp lệ.");
    nextCalendarDate(start);
    scope.scheduledAt = {
      $gte: zonedLocalTimeToUtc(start, "00:00", campaign.timezone || "Asia/Ho_Chi_Minh"),
      $lt: zonedLocalTimeToUtc(nextCalendarDate(end), "00:00", campaign.timezone || "Asia/Ho_Chi_Minh"),
    };
  } else if (claims.slotId) {
    scope._id = claims.slotId;
  } else {
    throw new Error("Token không chứa đầy đủ thông tin.");
  }
  return scope;
}

/** Compare the state that was reviewed before accepting a public decision. */
export async function savePublicSlotDecision(
  slot: InstanceType<typeof MarketingCampaignSlotModel>,
  scope: Record<string, unknown>,
) {
  const now = new Date();
  const updated = await MarketingCampaignSlotModel.findOneAndUpdate(
    {
      ...scope, _id: slot._id, status: "pending_approval",
      approvedBy: slot.$locals.publicApprovalPreviousReviewer ?? null,
      ...(slot.$locals.publicApprovalUpdatedAt ? { updatedAt: slot.$locals.publicApprovalUpdatedAt } : {}),
      $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }],
    },
    {
      $set: {
        status: slot.status,
        ...(slot.approvedBy ? { approvedBy: slot.approvedBy, approvedAt: slot.approvedAt } : {}),
        ...(slot.status === "needs_attention" ? { lastError: slot.lastError } : {}),
      },
      $push: { transitions: slot.transitions[slot.transitions.length - 1] },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw Object.assign(new Error("Bài đăng đã thay đổi hoặc đang được xử lý. Vui lòng tải lại trước khi duyệt."), { statusCode: 409 });
  return updated;
}

export function rememberPublicApprovalState(slot: InstanceType<typeof MarketingCampaignSlotModel>) {
  slot.$locals.publicApprovalPreviousReviewer = slot.approvedBy ?? null;
  slot.$locals.publicApprovalUpdatedAt = slot.updatedAt;
  if (slot.lockExpiresAt && slot.lockExpiresAt > new Date()) {
    throw new Error("Slot đang được xử lý ở nơi khác. Hãy tải lại trước khi duyệt.");
  }
}
