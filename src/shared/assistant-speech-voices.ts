/** Provider voice IDs stay internal; labels and portraits are localized for the UI. */
export const assistantSpeechVoiceProfiles = [
  { id: "sarah", name: "Thu Hà", gender: "Nữ", portraitIndex: 0 },
  { id: "george", name: "Tuấn Tài", gender: "Nam", portraitIndex: 1 },
  { id: "adam", name: "Adam", gender: "Nam", portraitIndex: 2 },
  { id: "alice", name: "Minh Anh", gender: "Nữ", portraitIndex: 3 },
  { id: "bella", name: "Ngọc Hân", gender: "Nữ", portraitIndex: 4 },
  { id: "bill", name: "Quốc Bảo", gender: "Nam", portraitIndex: 5 },
  { id: "brian", name: "Đức Anh", gender: "Nam", portraitIndex: 6 },
  { id: "callum", name: "Hoàng Nam", gender: "Nam", portraitIndex: 7 },
  { id: "charlie", name: "Gia Huy", gender: "Nam", portraitIndex: 8 },
  { id: "chris", name: "Minh Quân", gender: "Nam", portraitIndex: 9 },
  { id: "daniel", name: "Anh Dũng", gender: "Nam", portraitIndex: 10 },
  { id: "eric", name: "Tuấn Kiệt", gender: "Nam", portraitIndex: 11 },
  { id: "harry", name: "Thanh Long", gender: "Nam", portraitIndex: 12 },
  { id: "jessica", name: "Hồng Nhung", gender: "Nữ", portraitIndex: 13 },
  { id: "laura", name: "Bảo Châu", gender: "Nữ", portraitIndex: 14 },
  { id: "liam", name: "Tuấn Minh", gender: "Nam", portraitIndex: 15 },
  { id: "lily", name: "Khánh Linh", gender: "Nữ", portraitIndex: 16 },
  { id: "matilda", name: "Mai Phương", gender: "Nữ", portraitIndex: 17 },
  { id: "river", name: "An Nhiên", gender: "Nữ", portraitIndex: 18 },
  { id: "roger", name: "Quang Huy", gender: "Nam", portraitIndex: 19 },
  { id: "will", name: "Nhật Nam", gender: "Nam", portraitIndex: 20 },
] as const;

export type AssistantSpeechVoiceProfile = typeof assistantSpeechVoiceProfiles[number];
export type AssistantSpeechVoice = AssistantSpeechVoiceProfile["id"];
export const assistantSpeechVoices: readonly AssistantSpeechVoice[] = assistantSpeechVoiceProfiles.map(({ id }) => id);
export const defaultAssistantSpeechVoice: AssistantSpeechVoice = "sarah";

export function getAssistantSpeechVoiceProfile(voice: AssistantSpeechVoice): AssistantSpeechVoiceProfile {
  return assistantSpeechVoiceProfiles.find((profile) => profile.id === voice) ?? assistantSpeechVoiceProfiles[0];
}

export function assistantSpeechVoiceLabel(voice: AssistantSpeechVoice): string {
  return getAssistantSpeechVoiceProfile(voice).name;
}

export function isAssistantSpeechVoice(value: unknown): value is AssistantSpeechVoice {
  return typeof value === "string" && assistantSpeechVoiceProfiles.some((profile) => profile.id === value);
}
