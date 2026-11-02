import { relayMarketingEvent } from "./event-relay";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { UserModel } from "../../../model/user.model";
import { AIMediaModel } from "./model/ai-media.model";
import mongoose from "mongoose";

type MessengerChannel = "facebook" | "zalo" | "tiktok";

export function messengerRoom(companyCode: string, channel: MessengerChannel, accountId: string) {
  return `marketing:messenger:${companyCode}:${channel}:${encodeURIComponent(accountId)}`;
}

export function broadcastEvent(event: string, payload: Record<string, unknown>) {
  const companyCode = typeof payload?.companyCode === "string" ? payload.companyCode : "";
  const userId = [payload?.userId, payload?.createdBy, payload?.authorUid].find((value) => typeof value === "string");
  if (companyCode) relayMarketingEvent({ kind: "company", id: companyCode }, event, payload);
  else if (typeof userId === "string") relayMarketingEvent({ kind: "user", id: userId }, event, payload);
  else if (typeof payload?.videoId === "string" && mongoose.isValidObjectId(payload.videoId)) {
    void AIMediaModel.findById(payload.videoId).select("userId").lean().then((media) => {
      if (media?.userId) relayMarketingEvent({ kind: "user", id: String(media.userId) }, event, payload);
    }).catch((error: unknown) => console.warn("[Marketing media event]", error instanceof Error ? error.message : "unavailable"));
  }
}

export async function emitToMessengerAccount(channel: MessengerChannel, accountId: string, event: string, payload: unknown) {
  const platform = channel === "facebook" ? "Facebook" : channel === "zalo" ? "Zalo" : "TikTok";
  const accounts = await SocialIntegrationModel.find({ platform, username: accountId, isConnected: true }).select("companyCode").lean();
  const companies = new Set(accounts.map((account) => account.companyCode).filter(Boolean));
  if (!companies.size) {
    const field = channel === "facebook" ? "facebookIntegration" : channel === "zalo" ? "zaloIntegration" : "tiktokIntegration";
    const identity = channel === "facebook" ? "pageId" : channel === "zalo" ? "oaId" : "username";
    const owners = await UserModel.find({ [`${field}.${identity}`]: accountId, [`${field}.isConnected`]: true }).select("companyCode").lean();
    for (const owner of owners) if (owner.companyCode) companies.add(owner.companyCode);
  }
  // An ambiguous account must be reconciled before messages can be routed.
  if (companies.size !== 1) return;
  const companyCode = [...companies][0];
  const object = payload && typeof payload === "object" ? payload : { data: payload };
  relayMarketingEvent({ kind: "account", id: messengerRoom(companyCode, channel, accountId) }, event, { ...object, channel, accountId });
}
export function emitToPage(pageId: string, event: string, payload: unknown) {
  void emitToMessengerAccount("facebook", pageId, event, payload);
}
