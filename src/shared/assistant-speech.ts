export interface AssistantSpeechControls {
  speed: number;
  pausePeriod: number;
  pauseComma: number;
  pauseSemicolon: number;
  pauseNewline: number;
}

export const defaultAssistantSpeechControls: AssistantSpeechControls = {
  speed: 1,
  pausePeriod: 0.6,
  pauseComma: 0.25,
  pauseSemicolon: 0.25,
  pauseNewline: 0.6,
};
