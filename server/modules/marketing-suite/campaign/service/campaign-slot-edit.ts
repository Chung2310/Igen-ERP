import { randomUUID } from "node:crypto";
import type { ClientSession, HydratedDocument } from "mongoose";
import type { IMarketingCampaignSlot } from "../interface/marketing-campaign-slot.interface";
import { MarketingCampaignSlotModel } from "../model/marketing-campaign-slot.model";
import { CampaignSheetRowModel, CampaignSheetRevisionModel } from "../model/campaign-content-sheet.model";

const conflict = () => Object.assign(new Error("Slot đã thay đổi hoặc đang được xử lý. Hãy tải lại trước khi lưu."), { statusCode: 409 });

export async function syncCampaignSheetFields(companyCode: string, campaignId: string, slotId: string, updates: Record<string, unknown>, session: ClientSession) {
  const row = await CampaignSheetRowModel.findOne({ companyCode, campaignId, slotId }).session(session);
  if (!row) return;
  const changes = row.fields.filter((field) => ["title", "bodyText"].includes(field.key) && updates[field.key] !== undefined)
    .map((field) => ({ slotId, fieldKey: field.key, before: field.value, after: updates[field.key] }));
  if (!changes.length) return;
  const fields = row.toObject().fields.map((field) => {
    const change = changes.find((item) => item.fieldKey === field.key);
    return change ? { ...field, value: change.after, source: "user", updatedBy: "internal", updatedAt: new Date(), generationId: undefined, references: [] } : field;
  });
  const synced = await CampaignSheetRowModel.updateOne({ _id: row._id, companyCode, revision: row.revision }, { $set: { fields }, $inc: { revision: 1 } }, { session });
  if (!synced.matchedCount) throw conflict();
  await CampaignSheetRevisionModel.create([{ companyCode, campaignId, actorType: "user", actorId: "internal", operation: "update_content", baseRevision: row.revision, changes }], { session });
}

/** Serialize user edits with campaign workers; commit row/card/slot changes together. */
export async function withCampaignSlotEdit<T>(
  input: { companyCode: string; campaignId: string; slotId: string; statuses: string[] },
  work: (slot: HydratedDocument<IMarketingCampaignSlot>, session: ClientSession) => Promise<T>,
): Promise<T> {
  const scope = { _id: input.slotId, campaignId: input.campaignId, companyCode: input.companyCode };
  const snapshot = await MarketingCampaignSlotModel.findOne(scope);
  if (!snapshot) throw Object.assign(new Error("Không tìm thấy slot chiến dịch."), { statusCode: 404 });
  if (!input.statuses.includes(snapshot.status) || (snapshot.lockExpiresAt && snapshot.lockExpiresAt > new Date())) throw conflict();
  const lockId = randomUUID();
  const now = new Date();
  const leased = await MarketingCampaignSlotModel.findOneAndUpdate(
    { ...scope, status: snapshot.status, updatedAt: snapshot.updatedAt,
      $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }] },
    { $set: { lockId, lockedAt: now, lockExpiresAt: new Date(now.getTime() + 20 * 60_000) } },
    { returnDocument: "after" },
  );
  if (!leased) throw conflict();
  try {
    return await MarketingCampaignSlotModel.db.transaction(async (session) => {
      const slot = await MarketingCampaignSlotModel.findOne({ ...scope, lockId }).session(session);
      if (!slot || !input.statuses.includes(slot.status)) throw conflict();
      const result = await work(slot, session);
      const released = await MarketingCampaignSlotModel.updateOne(
        { ...scope, lockId }, { $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 } }, { session },
      );
      if (!released.matchedCount) throw conflict();
      return result;
    });
  } finally {
    await MarketingCampaignSlotModel.updateOne(
      { ...scope, lockId }, { $unset: { lockId: 1, lockedAt: 1, lockExpiresAt: 1 } },
    ).catch(error => console.error("[Campaign edit] Could not release edit lease:", error));
  }
}
