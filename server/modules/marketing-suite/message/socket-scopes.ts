import type { Socket } from "socket.io";
import { UserModel } from "../../../model/user.model";
import { getModuleStateForCompany, resolveModuleAccess } from "../../../middleware/require-module";
import { getEffectivePermissions } from "../../../middleware/auth";
import { SocialIntegrationModel } from "../shared/model/social-integration.model";
import { messengerRoom } from "../shared/socket";
import { assertMarketingAccountOwnership } from "../shared/account-ownership";

type Scope = { channel: "facebook" | "zalo" | "tiktok"; accountId: string };
type ScopeAck = (result: { success: boolean; scopes: Scope[]; code?: string }) => void;

export function attachMessengerScopes(socket: Socket) {
  let requestVersion = 0;
  socket.on("set_messenger_scopes", async (requested: unknown, acknowledge?: ScopeAck) => {
    const version = ++requestVersion;
    const fail = async (code: string) => {
      if (version !== requestVersion) return;
      for (const room of socket.rooms) {
        if (version !== requestVersion) return;
        if (room.startsWith("marketing:messenger:")) await socket.leave(room);
      }
      if (version !== requestVersion) return;
      console.warn("[Messenger scopes] Subscription rejected", { socketId: socket.id, code });
      if (typeof acknowledge === "function") acknowledge({ success: false, scopes: [], code });
    };
    if (!Array.isArray(requested) || requested.length > 30) return fail("INVALID_SCOPES");
    try {
      const user = await UserModel.findById(socket.data.user?._id).lean();
      if (!user?.companyCode || user.disabledAt) return fail("ACCOUNT_UNAVAILABLE");
      const permissions = await getEffectivePermissions(String(user._id), user.role, user.companyCode);
      if (!["admin", "superadmin"].includes(user.role) && !permissions.has("*") && !["omni-inbox:read", "omni-inbox:manage"].some((value) => permissions.has(value))) return fail("PERMISSION_DENIED");
      const state = await getModuleStateForCompany(user.companyCode);
      if (!resolveModuleAccess(user, "omni-inbox", state.modules, state.exists, state.businessType)) return fail("MODULE_DISABLED");
      const scopes: Scope[] = [];
      for (const value of requested.slice(0, 30)) {
        if (version !== requestVersion) return;
        const channel = value?.channel;
        const accountId = typeof value?.accountId === "string" ? value.accountId.trim() : "";
        if (!["facebook", "zalo", "tiktok"].includes(channel) || !accountId || accountId.length > 200) return fail("INVALID_SCOPE");
        const platform = channel === "facebook" ? "Facebook" : channel === "zalo" ? "Zalo" : "TikTok";
        await assertMarketingAccountOwnership(user.companyCode, platform, accountId);
        const companyAccount = await SocialIntegrationModel.exists({ companyCode: user.companyCode, platform, username: accountId, isConnected: true });
        const personal = channel === "facebook" ? user.facebookIntegration : channel === "zalo" ? user.zaloIntegration : user.tiktokIntegration;
        const personalId = channel === "facebook" ? user.facebookIntegration?.pageId : channel === "zalo" ? user.zaloIntegration?.oaId : user.tiktokIntegration?.username;
        if (!companyAccount && !(personal?.isConnected && personalId === accountId)) return fail("ACCOUNT_NOT_CONNECTED");
        scopes.push({ channel, accountId });
      }
      if (version !== requestVersion) return;
      // Keep existing subscriptions while authorization is in flight; replace rooms only when ready.
      const rooms = new Set(scopes.map(scope => messengerRoom(user.companyCode, scope.channel, scope.accountId)));
      await socket.join([...rooms]);
      if (version !== requestVersion) return;
      for (const room of socket.rooms) {
        if (version !== requestVersion) return;
        if (room.startsWith("marketing:messenger:") && !rooms.has(room)) await socket.leave(room);
      }
      if (version !== requestVersion) return;
      console.info("[Messenger scopes] Subscription ready", { socketId: socket.id, companyCode: user.companyCode, scopes });
      if (typeof acknowledge === "function") acknowledge({ success: true, scopes });
    } catch (error) {
      console.error("[Messenger scopes] Authorization failed", error instanceof Error ? error.message : "unknown");
      await fail("SUBSCRIPTION_FAILED");
    }
  });
}
