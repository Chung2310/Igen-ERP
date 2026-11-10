/** Built-in voices advertised for elevenlabs/eleven-flash-v2.5 by OpenRouter. */
export const assistantSpeechVoices = [
  "sarah", "george", "adam", "alice", "bella", "bill", "brian", "callum",
  "charlie", "chris", "daniel", "eric", "harry", "jessica", "laura",
  "liam", "lily", "matilda", "river", "roger", "will",
] as const;

export type AssistantSpeechVoice = typeof assistantSpeechVoices[number];
export const defaultAssistantSpeechVoice: AssistantSpeechVoice = "sarah";

export function assistantSpeechVoiceLabel(voice: AssistantSpeechVoice): string {
  return `Tiếng Việt · ${voice[0].toUpperCase()}${voice.slice(1)}`;
}

export function isAssistantSpeechVoice(value: unknown): value is AssistantSpeechVoice {
  return typeof value === "string" && (assistantSpeechVoices as readonly string[]).includes(value);
}
