import type { AuthenticatedRequest } from "../middleware/auth";
import { defaultAssistantSettings, type AssistantSettings } from "../../src/shared/assistant-workflow";
import { actorScope } from "./workflows";
import { AssistantSettingsModel, ensureAssistantIndexes } from "./models";
import { AssistantError } from "./policy";
import { defaultAssistantSpeechVoice, isAssistantSpeechVoice } from "../../src/shared/assistant-speech-voices";
export async function getSettings(req: AuthenticatedRequest): Promise<AssistantSettings> {
  const scope = actorScope(req);
  await ensureAssistantIndexes();
  await AssistantSettingsModel.updateOne(scope, { $setOnInsert: { ...scope, config: defaultAssistantSettings, version: 0 } }, { upsert: true });
  const row = await AssistantSettingsModel.findOne(scope).lean();
  const config = { ...defaultAssistantSettings, ...row!.config };
  if (typeof config.responseRules !== "string" || !config.responseRules.trim()) config.responseRules = defaultAssistantSettings.responseRules;
  if (!isAssistantSpeechVoice(config.speechVoice)) config.speechVoice = defaultAssistantSpeechVoice;
  return { ...config, version: row!.version };
}
export async function saveSettings(req: AuthenticatedRequest, value: AssistantSettings): Promise<AssistantSettings> {
  const current = await getSettings(req);
  const config = { ...current, ...value };
  if (typeof config.responseRules !== "string" || !config.responseRules.trim()) config.responseRules = defaultAssistantSettings.responseRules;
  if (!isAssistantSpeechVoice(config.speechVoice)) throw new AssistantError("Giọng đọc đã chọn không hợp lệ.");
  const row = await AssistantSettingsModel.findOneAndUpdate({ ...actorScope(req), version: value.version }, { $set: { config }, $inc: { version: 1 } }, { new: true }).lean();
  if (!row) throw new AssistantError("Cài đặt đã được thay đổi ở nơi khác. Tải lại cài đặt trước khi lưu.", 409);
  return { ...defaultAssistantSettings, ...row.config, version: row.version };
}
