import type { AuthenticatedRequest } from "../middleware/auth";
import { defaultAssistantSettings, type AssistantSettings } from "../../src/shared/assistant-workflow";
import { actorScope } from "./workflows";
import { AssistantSettingsModel, ensureAssistantIndexes } from "./models";
import { AssistantError } from "./policy";
export async function getSettings(req: AuthenticatedRequest): Promise<AssistantSettings> {
  const scope = actorScope(req);
  await ensureAssistantIndexes();
  await AssistantSettingsModel.updateOne(scope, { $setOnInsert: { ...scope, config: defaultAssistantSettings, version: 0 } }, { upsert: true });
  const row = await AssistantSettingsModel.findOne(scope).lean();
  return { ...defaultAssistantSettings, ...row!.config, version: row!.version };
}
export async function saveSettings(req: AuthenticatedRequest, value: AssistantSettings): Promise<AssistantSettings> {
  await getSettings(req);
  const row = await AssistantSettingsModel.findOneAndUpdate({ ...actorScope(req), version: value.version }, { $set: { config: value }, $inc: { version: 1 } }, { new: true }).lean();
  if (!row) throw new AssistantError("Cài đặt đã được thay đổi ở nơi khác. Tải lại cài đặt trước khi lưu.", 409);
  return { ...defaultAssistantSettings, ...row.config, version: row.version };
}
