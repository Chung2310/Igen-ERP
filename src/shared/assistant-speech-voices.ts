/** Provider voice IDs stay internal; labels and portraits are localized for the UI. */
export interface AssistantSpeechVoiceOption {
  id: string;
  name: string;
  gender: "Nam" | "Nữ";
  portraitIndex: number;
  demoUrl?: string;
  provider?: "vbee" | "openrouter";
}

export const assistantSpeechVoiceProfiles: readonly AssistantSpeechVoiceOption[] = [
  { id: "sarah", name: "Thu Hà", gender: "Nữ", portraitIndex: 0, provider: "openrouter" },
  { id: "george", name: "Tuấn Tài", gender: "Nam", portraitIndex: 1, provider: "openrouter" },
  { id: "adam", name: "Adam", gender: "Nam", portraitIndex: 2, provider: "openrouter" },
  { id: "alice", name: "Minh Anh", gender: "Nữ", portraitIndex: 3, provider: "openrouter" },
  { id: "bella", name: "Ngọc Hân", gender: "Nữ", portraitIndex: 4, provider: "openrouter" },
  { id: "bill", name: "Quốc Bảo", gender: "Nam", portraitIndex: 5, provider: "openrouter" },
  { id: "brian", name: "Đức Anh", gender: "Nam", portraitIndex: 6, provider: "openrouter" },
  { id: "callum", name: "Hoàng Nam", gender: "Nam", portraitIndex: 7, provider: "openrouter" },
  { id: "charlie", name: "Gia Huy", gender: "Nam", portraitIndex: 8, provider: "openrouter" },
  { id: "chris", name: "Minh Quân", gender: "Nam", portraitIndex: 9, provider: "openrouter" },
  { id: "daniel", name: "Anh Dũng", gender: "Nam", portraitIndex: 10, provider: "openrouter" },
  { id: "eric", name: "Tuấn Kiệt", gender: "Nam", portraitIndex: 11, provider: "openrouter" },
  { id: "harry", name: "Thanh Long", gender: "Nam", portraitIndex: 12, provider: "openrouter" },
  { id: "jessica", name: "Hồng Nhung", gender: "Nữ", portraitIndex: 13, provider: "openrouter" },
  { id: "laura", name: "Bảo Châu", gender: "Nữ", portraitIndex: 14, provider: "openrouter" },
  { id: "liam", name: "Tuấn Minh", gender: "Nam", portraitIndex: 15, provider: "openrouter" },
  { id: "lily", name: "Khánh Linh", gender: "Nữ", portraitIndex: 16, provider: "openrouter" },
  { id: "matilda", name: "Mai Phương", gender: "Nữ", portraitIndex: 17, provider: "openrouter" },
  { id: "river", name: "An Nhiên", gender: "Nữ", portraitIndex: 18, provider: "openrouter" },
  { id: "roger", name: "Quang Huy", gender: "Nam", portraitIndex: 19, provider: "openrouter" },
  { id: "will", name: "Nhật Nam", gender: "Nam", portraitIndex: 20, provider: "openrouter" },
] as const;

const FEMALE_PORTRAIT_INDICES = [0, 3, 4, 13, 14, 16, 17, 18] as const;
const MALE_PORTRAIT_INDICES = [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 15, 19, 20] as const;

export function getPortraitIndexForGender(gender: "Nam" | "Nữ", index: number): number {
  const pool = gender === "Nữ" ? FEMALE_PORTRAIT_INDICES : MALE_PORTRAIT_INDICES;
  return pool[Math.abs(index) % pool.length];
}

export type AssistantSpeechVoiceProfile = AssistantSpeechVoiceOption;
export type AssistantSpeechVoice = string;
export const assistantSpeechVoices: readonly string[] = assistantSpeechVoiceProfiles.map(({ id }) => id);
export const defaultAssistantSpeechVoice: AssistantSpeechVoice = "sarah";

const VOICE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,79}$/i;
let registeredDynamicVoices: readonly AssistantSpeechVoiceOption[] = [];

export function registerDynamicSpeechVoices(voices: readonly AssistantSpeechVoiceOption[]): void {
  registeredDynamicVoices = voices;
}

export function getAssistantSpeechVoiceProfile(
  voice: AssistantSpeechVoice,
  options?: readonly AssistantSpeechVoiceOption[],
): AssistantSpeechVoiceOption {
  const dynamicPool = options && options.length > 0 ? options : registeredDynamicVoices;
  const fromDynamic = dynamicPool.find((profile) => profile.id === voice);
  if (fromDynamic) return fromDynamic;
  const fromStatic = assistantSpeechVoiceProfiles.find((profile) => profile.id === voice);
  if (fromStatic) return fromStatic;
  return dynamicPool[0] ?? assistantSpeechVoiceProfiles[0];
}

export function assistantSpeechVoiceLabel(
  voice: AssistantSpeechVoice,
  options?: readonly AssistantSpeechVoiceOption[],
): string {
  return getAssistantSpeechVoiceProfile(voice, options).name;
}

export function isAssistantSpeechVoice(value: unknown): value is AssistantSpeechVoice {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return assistantSpeechVoices.includes(trimmed) || VOICE_ID_PATTERN.test(trimmed);
}
