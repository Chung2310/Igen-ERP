import type { Socket } from "socket.io";
import { UserModel } from "../../../model/user.model";
import { getModuleStateForCompany, resolveModuleAccess } from "../../../middleware/require-module";
import { getEffectivePermissions } from "../../../middleware/auth";
import { SocialIntegrationModel } from "../shared/model/social-integration.model";
import { messengerRoom } from "../shared/socket";
import { assertMarketingAccountOwnership } from "../shared/account-ownership";

export function attachMessengerScopes(socket: Socket) {
  let requestVersion = 0;
  socket.on("set_messenger_scopes", async (requested: unknown) => {
    const version = ++requestVersion;
    for (const room of socket.rooms) if (room.startsWith("marketing:messenger:")) void socket.leave(room);
    if (!Array.isArray(requested)) return;
    try {
      const user = await UserModel.findById(socket.data.user?._id).lean();
      if (!user?.companyCode || user.disabledAt) return;
      const permissions = await getEffectivePermissions(String(user._id), user.role, user.companyCode);
      if (!["admin", "superadmin"].includes(user.role) && !permissions.has("*") && !["omni-inbox:read", "omni-inbox:manage"].some((value) => permissions.has(value))) return;
      const state = await getModuleStateForCompany(user.companyCode);
      if (!resolveModuleAccess(user, "omni-inbox", state.modules, state.exists, state.businessType)) return;
      for (const value of requested.slice(0, 30)) {
        if (version !== requestVersion) return;
        const channel = value?.channel;
        const accountId = typeof value?.accountId === "string" ? value.accountId.trim() : "";
        if (!["facebook", "zalo", "tiktok"].includes(channel) || !accountId || accountId.length > 200) continue;
        const platform = channel === "facebook" ? "Facebook" : channel === "zalo" ? "Zalo" : "TikTok";
        await assertMarketingAccountOwnership(user.companyCode, platform, accountId);
        const companyAccount = await SocialIntegrationModel.exists({ companyCode: user.companyCode, platform, username: accountId, isConnected: true });
        const personal = channel === "facebook" ? user.facebookIntegration : channel === "zalo" ? user.zaloIntegration : user.tiktokIntegration;
        const personalId = channel === "facebook" ? user.facebookIntegration?.pageId : channel === "zalo" ? user.zaloIntegration?.oaId : user.tiktokIntegration?.username;
        if (version === requestVersion && (companyAccount || (personal?.isConnected && personalId === accountId))) await socket.join(messengerRoom(user.companyCode, channel, accountId));
      }
    } catch (error) {
      console.error("[Messenger scopes] Authorization failed", error instanceof Error ? error.message : "unknown");
    }
  });
}
