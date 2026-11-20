import type { RankableKnowledgeChunk } from "./knowledge-chunking";
import { selectKnowledgeEvidence } from "./knowledge-chunking";
import type { AssistantEvidence } from "../assistant.types";

export interface KnowledgeReference {
  key: string;
  clause: string;
  article: string;
}

/** Conservative, explicit point/clause/article references to a named law.
 * Preserve đ versus d and do not infer an unnamed law from nearby text.
 */
export function knowledgeReferences(text: string): KnowledgeReference[] {
  const normalized = text.normalize("NFC").toLowerCase();
  const pattern =
    /điểm\s+([a-zđ](?:\s*(?:,|và|hoặc)\s*[a-zđ])*)\s+khoản\s+(\d+)\s+điều\s+(\d+)\s+(?:của\s+)?(luật\s+[^.;:\n]{3,100})/gu;
  const refs = new Map<string, KnowledgeReference>();
  for (const match of normalized.matchAll(pattern)) {
    const law = match[4]
      .replace(/\s+/g, " ")
      .split(/\s+và\s+(?:khoản|điều|điểm|các|nghị định)\b/u)[0]
      .trim();
    const points = match[1].split(/\s*(?:,|và|hoặc)\s*/u);
    for (const point of points) {
      const key = `${law}|${match[3]}|${match[2]}|${point.trim()}`;
      refs.set(key, { key, clause: match[2], article: match[3] });
    }
  }
  return [...refs.values()].slice(0, 24);
}

export function sharesKnowledgeReference(a: string, b: string): boolean {
  const keys = new Set(knowledgeReferences(a).map((r) => r.key));
  return knowledgeReferences(b).some((r) => keys.has(r.key));
}

/** Linked context is useful together with the seed, never a standalone answer. */
export function referencePartners<T extends RankableKnowledgeChunk>(
  seed: RankableKnowledgeChunk,
  candidates: T[],
  query: string,
): T[] {
  const quantity = /bao nhiêu|tỷ lệ|tỉ lệ|phần trăm/i.test(query);
  const hasAmount = (item: T) => /\d+(?:[,.]\d+)?\s*(?:%|đồng|ngày|tháng|năm|giờ)/i.test(item.text);
  return candidates
    .filter(
      (item) =>
        item.id !== seed.id && item.documentId === seed.documentId && sharesKnowledgeReference(seed.text, item.text),
    )
    .filter((item) => !quantity || hasAmount(item))
    .sort((a, b) => {
      const amount = (item: T) => (quantity && hasAmount(item) ? 1 : 0);
      return amount(b) - amount(a) || a.id.localeCompare(b.id);
    })
    .slice(0, 2);
}

export function selectReferenceEvidence<T extends RankableKnowledgeChunk & { score: number }>(
  seeds: T[],
  groups: T[][],
  budget: { topK: number; maxCharacters: number; maxPerDocument: number },
): T[] {
  // Interleave the supporting passages: a higher-ranked procedural seed must not
  // consume every slot before the seed identifying the subject can bring its rate.
  const partners = [0, 1].flatMap((index) => groups.flatMap((group) => (group[index] ? [group[index]] : [])));
  const unique = [...new Map([...seeds, ...partners].map((item) => [item.id, item])).values()];
  return selectKnowledgeEvidence(unique, budget.topK, budget.maxCharacters, Math.max(budget.maxPerDocument, 4));
}

/** Structural navigation hints, not generated facts or replacement citations. */
export function evidenceReferenceLinks(evidence: AssistantEvidence[]) {
  const links: Array<{ sourceIds: string[]; reference: string }> = [];
  for (let i = 0; i < evidence.length; i++) {
    const a = evidence[i];
    if (!a.citation?.documentId || !a.citation.revision || a.documentType === "legal_review") continue;
    const keys = new Set(knowledgeReferences(a.content).map((r) => r.key));
    for (const b of evidence.slice(i + 1)) {
      if (
        a.citation.documentId !== b.citation?.documentId ||
        a.citation.revision !== b.citation?.revision ||
        b.documentType === "legal_review"
      )
        continue;
      for (const ref of knowledgeReferences(b.content)) {
        if (keys.has(ref.key)) links.push({ sourceIds: [a.id, b.id], reference: ref.key });
        if (links.length >= 24) return links;
      }
    }
  }
  return links;
}
