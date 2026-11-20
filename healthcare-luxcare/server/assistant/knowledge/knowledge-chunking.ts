import crypto from "node:crypto";
export function normalizeKnowledgeText(text: string): string {
  return String(text || "")
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
const STOP_WORDS = new Set(
  "la va cua cho cac nhung mot toi duoc co thi sao nhu nao bao nhieu ve trong voi hay xin ban the gi con khong".split(
    " ",
  ),
);
export function knowledgeTokens(text: string): string[] {
  return (
    normalizeKnowledgeText(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .match(/[a-z0-9]{2,}/g) || []
  ).filter((token) => !STOP_WORDS.has(token));
}
export function chunkKnowledgeText(text: string, metadata: { title: string }): string[] {
  const body = normalizeKnowledgeText(text);
  if (!body) return [];
  if (body.startsWith("Bảng: ")) {
    return body.split(/\n\n(?=Bảng: )/).flatMap((sheet) => {
      const [name, columns = "", ...rows] = sheet.split("\n");
      return chunkBody(rows.join("\n") || columns, metadata.title, `${name.slice(0, 200)}\n${columns.slice(0, 400)}\n`);
    });
  }
  return chunkBody(body, metadata.title);
}
function chunkBody(body: string, title: string, context = ""): string[] {
  const prefix = `Tài liệu: ${normalizeKnowledgeText(title)}\n${context}`;
  const chunks: string[] = [];
  let start = 0;
  while (start < body.length) {
    let end = Math.min(start + 1100, body.length);
    if (end < body.length) {
      const boundaries = [...body.slice(start, end).matchAll(/\n|[.!?]\s/g)].map(
        (match) => match.index! + match[0].length,
      );
      const boundary = boundaries.filter((value) => value >= 600).pop();
      if (boundary) end = start + boundary;
    }
    chunks.push(`${prefix}${body.slice(start, end)}`.trim());
    if (end === body.length) break;
    const overlapStart = end - 160;
    const nextBoundary = body.slice(overlapStart, end).search(/\n|[.!?]\s/);
    start = Math.max(start + 1, nextBoundary >= 0 ? overlapStart + nextBoundary + 1 : overlapStart);
  }
  return chunks;
}
/** Legacy compatibility only. Never use these hashes as semantic evidence. */
export function embedKnowledgeText(text: string): number[] {
  const vector = new Array<number>(96).fill(0);
  for (const token of knowledgeTokens(text)) {
    const value = crypto.createHash("md5").update(token).digest().readUInt32BE(0);
    vector[value % 96] += value % 2 === 0 ? 1 : -1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => value / norm);
}
export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm ? a.reduce((sum, value, index) => sum + value * b[index], 0) / norm : 0;
}
export interface RankableKnowledgeChunk {
  id: string;
  title: string;
  text: string;
  embedding?: number[];
  documentId?: string;
  semanticScore?: number;
}
export function rankKnowledgeChunks<T extends RankableKnowledgeChunk>(
  query: string,
  chunks: T[],
  options: { semanticThreshold?: number } = {},
) {
  const queryTokens = new Set(knowledgeTokens(query));
  const lines = query.trim().split("\n");
  const focus = new Set(knowledgeTokens(lines.at(-1) || query));
  const corpus = chunks.map((chunk) => new Set(knowledgeTokens(`${chunk.title} ${chunk.text}`)));
  const weight = (token: string) =>
    Math.log(1 + (chunks.length + 1) / (1 + corpus.filter((tokens) => tokens.has(token)).length)) *
    (lines.length > 1 && focus.has(token) ? 2 : 1);
  const weights = new Map([...queryTokens].map((token) => [token, weight(token)]));
  const totalWeight = [...weights.values()].reduce((sum, value) => sum + value, 0) || 1;
  return chunks
    .map((chunk) => {
      const body = new Set(knowledgeTokens(chunk.text));
      const title = new Set(knowledgeTokens(chunk.title));
      const matches = [...queryTokens].filter((token) => body.has(token) || title.has(token));
      const coverage = matches.reduce((sum, token) => sum + weights.get(token)!, 0) / totalWeight;
      const titleCoverage =
        [...queryTokens].filter((token) => title.has(token)).reduce((sum, token) => sum + weights.get(token)!, 0) /
        totalWeight;
      const lexical = coverage * 0.9 + titleCoverage * 0.1;
      const semantic = chunk.semanticScore ?? 0;
      const relevant = coverage >= 0.45 || semantic >= (options.semanticThreshold ?? 0.78);
      return { ...chunk, score: relevant ? Math.max(lexical, semantic * 0.9) : 0, coverage };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function selectKnowledgeEvidence<T extends RankableKnowledgeChunk & { score: number }>(
  ranked: T[],
  topK = 5,
  maxCharacters = 8000,
  maxPerDocument = 2,
): T[] {
  const selected: T[] = [];
  const counts = new Map<string, number>();
  let characters = 0;
  for (const item of ranked) {
    if (item.score <= 0 || characters + item.text.length > maxCharacters) continue;
    const key = item.documentId || item.id;
    if ((counts.get(key) || 0) >= maxPerDocument) continue;
    if (
      selected.some((prior) => {
        // Similar wording across documents may hide contradictory amounts or
        // different applicability. Only collapse overlaps from the same source.
        if ((prior.documentId || prior.id) !== (item.documentId || item.id)) return false;
        // Near duplicates can differ by one amount, date or negation, including
        // within the same file. Deduplicate exact normalized passages only.
        return normalizeKnowledgeText(prior.text) === normalizeKnowledgeText(item.text);
      })
    )
      continue;
    selected.push(item);
    counts.set(key, (counts.get(key) || 0) + 1);
    characters += item.text.length;
    if (selected.length >= topK) break;
  }
  return selected;
}
