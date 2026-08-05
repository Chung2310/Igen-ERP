import { WorkerNotificationModel } from "../models/worker-notification.model";
import { WorkerModel } from "../models/worker.model";
import type { WorkerScope } from "../contracts";

const scoped = (scope: WorkerScope) => ({ companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) });
export async function listWorkerNotifications(scope: WorkerScope) { return (WorkerNotificationModel as any).find(scoped(scope)).sort({ createdAt: -1 }).lean(); }
export async function createWorkerNotification(scope: WorkerScope, input: { title: string; content: string; recipients?: string; channels?: string[] }) {
  const query = { ...scoped(scope), deletedAt: null };
  const recipientCount = await WorkerModel.countDocuments(query);
  return (WorkerNotificationModel as any).create({ ...scoped(scope), title: input.title, content: input.content, recipients: input.recipients || "all", channels: input.channels || ["in-app"], recipientCount, status: "sent" });
}
