export const assistantImageAspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;
export const maxAssistantImageCount = 4;

export type AssistantImageAspectRatio = (typeof assistantImageAspectRatios)[number];

export interface AssistantImageGenerationRequest {
  prompt: string;
  aspectRatio: AssistantImageAspectRatio;
  count: number;
  countLimited: boolean;
}

const imageSubjectPattern = /\b(?:hinh anh|anh minh hoa|hinh minh hoa|buc anh|buc hinh|buc tranh|anh|hinh nen|hinh|logos?|posters?|banners?|infographics?|thumbnails?|avatars?|icons?|illustrations?|images?|pictures?|photos?|artworks?|drawings?|paintings?)\b/;
const documentSubjectPattern = /\b(?:slide|file|tep|tai lieu|bao cao|xlsx|xls|excel|csv|docx|word|pdf|presentation)\b/;

function normalizeImageRequestText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi").trim();
}

function requestedAspectRatio(text: string): AssistantImageAspectRatio {
  const explicitRatio = text.match(/\b(\d{1,2})\s*[:x×]\s*(\d{1,2})\b/);
  if (explicitRatio) {
    const ratio = `${explicitRatio[1]}:${explicitRatio[2]}`;
    if ((assistantImageAspectRatios as readonly string[]).includes(ratio)) return ratio as AssistantImageAspectRatio;
  }
  if (/\b(?:doc|portrait|vertical|story|mobile|phone)\b/.test(text)) return "9:16";
  if (/\b(?:ngang|landscape|horizontal|wide|banner)\b/.test(text)) return "16:9";
  return "1:1";
}

const countWords: Record<string, number> = {
  mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function requestedImageCount(text: string): { count: number; countLimited: boolean } {
  const match = text.match(/\b(\d{1,2}|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:tam|buc)\s+)?(?:hinh\s+anh|anh\s+minh\s+hoa|hinh\s+minh\s+hoa|buc\s+tranh|phien\s+ban|bien\s+the|variations?|versions?|images?|photos?|pictures?|logos?|posters?|banners?|anh|hinh|mau)\b/);
  if (!match) return { count: 1, countLimited: false };
  const requested = Number(match[1]) || countWords[match[1]] || 1;
  return {
    count: Math.min(requested, maxAssistantImageCount),
    countLimited: requested > maxAssistantImageCount,
  };
}

export function getAssistantImageGenerationRequest(text: string): AssistantImageGenerationRequest | null {
  const normalized = normalizeImageRequestText(text);
  if (!normalized || /^(?:cach|lam the nao|lam sao|huong dan|how to|how do i|what is)\b/.test(normalized)) return null;

  const request = normalized.replace(/^(?:(?:ban co the|ban hay|toi muon ban|minh muon ban|toi muon|minh muon|toi can|minh can|cho toi|cho minh|giup toi|giup minh|hay|vui long|please|could you|can you|i want you to|i want)\s+)+/, "").trim();
  const startsWithCreationAction = /^(?:tao|ve|dung|thiet ke|generate|create|draw|design|make)\b/.test(request);
  if (!startsWithCreationAction) return null;

  const subject = imageSubjectPattern.exec(request);
  const isDrawingRequest = /^(?:ve|draw)\b/.test(request) && request.length > 8;
  if (!subject && !isDrawingRequest) return null;

  if (subject) {
    const precedingText = request.slice(0, subject.index);
    if (documentSubjectPattern.test(precedingText)) return null;
  }

  return {
    prompt: text.trim(),
    aspectRatio: requestedAspectRatio(normalized),
    ...requestedImageCount(request),
  };
}
