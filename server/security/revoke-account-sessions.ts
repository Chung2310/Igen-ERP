import { UserModel } from "../model/user.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";

export async function revokeAccountSessions(userId: string) {
  await UserModel.updateOne({ _id: userId }, { $set: { activeSessionId: "" } });
  await SuperAdminSessionModel.updateMany({ userId }, { $set: { revokedAt: new Date(), revokeReason: "administrative" } });
  const { disconnectUserSockets } = await import("../socket");
  disconnectUserSockets(userId);
}
