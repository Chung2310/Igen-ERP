export const SCORE_LIMITS = { fidelity: 25, objective: 15, platform: 15, hook: 15, conversion: 10, readability: 10, novelty: 10 } as const;
export type ScoreDetails = Record<keyof typeof SCORE_LIMITS, number>;
export function normalizeScores(input: Record<string, unknown>): ScoreDetails {
  return Object.fromEntries(Object.entries(SCORE_LIMITS).map(([key, limit]) => {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid candidate score: ${key}`);
    return [key, Math.max(0, Math.min(limit, value))];
  })) as ScoreDetails;
}
export function candidateCount(value?: number) {
  return Math.min(5, Math.max(2, Math.trunc(Number.isFinite(value) ? value! : 3)));
}
function words(text: string) {
  return new Set(text.toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 2));
}
export function contentSimilarity(left: string, right: string) {
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}
export function validateCandidate(
  draft: { title: string; bodyText: string; outline: string; mediaPrompt: string; voiceScript?: string },
  platform: "Facebook" | "TikTok",
  rules: { forbiddenTerms?: string[]; requiredCta?: string; requiredHashtags?: string[] },
  recent: string[],
  humanVideo = false,
) {
  const errors: string[] = [];
  for (const field of ["title", "bodyText", "outline", "mediaPrompt"] as const) if (!draft[field]?.trim()) errors.push(`Thiếu trường ${field}.`);
  if (draft.bodyText.length > (platform === "TikTok" ? 2200 : 10000)) errors.push("Nội dung vượt giới hạn nền tảng.");
  if (/\[(?:tên|số điện thoại|địa chỉ|link|sản phẩm|hotline|giá)[^\]]{0,80}\]/i.test(draft.bodyText)) errors.push("Nội dung còn placeholder.");
  if (platform === "TikTok" && /(?:^|\n)\s*(?:cảnh\s*\d+|scene\s*\d+|storyboard|voice[- ]?over)\s*[:：]/i.test(draft.bodyText)) errors.push("Caption TikTok chứa chỉ dẫn dựng cảnh.");
  const body = draft.bodyText.toLocaleLowerCase("vi");
  for (const term of rules.forbiddenTerms || []) if (term.trim() && body.includes(term.toLocaleLowerCase("vi"))) errors.push(`Chứa từ cấm: ${term}`);
  if (rules.requiredCta?.trim() && !body.includes(rules.requiredCta.trim().toLocaleLowerCase("vi"))) errors.push("Thiếu CTA bắt buộc.");
  for (const tag of rules.requiredHashtags || []) if (tag.trim() && !body.includes(tag.trim().toLocaleLowerCase("vi"))) errors.push(`Thiếu hashtag: ${tag}`);
  if (humanVideo && !draft.voiceScript?.trim()) errors.push("Thiếu kịch bản lời nói.");
  if (recent.some((text) => contentSimilarity(text, draft.bodyText) >= 0.85)) errors.push("Nội dung quá giống bài gần đây hoặc phương án khác.");
  return errors;
}
