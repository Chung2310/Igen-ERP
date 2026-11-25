import type { RequestCoverageItem } from './request-coverage';

/** Deferred requests are quoted user clauses, never newly invented commands.
 * Coverage for future work must not be mistaken for filters on today's step. */
export function separateAssistantGoalSteps(text: string, coverage: unknown, requests: readonly string[]):
  { ok: true; currentText: string; coverage: unknown } | { ok: false; clarification: string } {
  if (!requests.length) return { ok: true, currentText: text, coverage };
  const fail = { ok: false as const, clarification: 'Mình chưa tách rõ các phần việc để thực hiện đúng thứ tự và giữ đủ điều kiện. Bạn cho biết muốn làm phần nào trước nhé.' };
  if (!Array.isArray(coverage) || requests.length > 40) return fail;
  const source = text.normalize('NFC');
  const quotedData = [...source.matchAll(/"[^"\n]*"|“[^”]*”|‘[^’]*’/gu)].filter(match =>
    source.slice(0, match.index).trim() || source.slice(match.index! + match[0].length).trim());
  const spans: Array<{ start: number; end: number }> = [];
  const deferred = new Set<number>();
  const current: RequestCoverageItem[] = [];
  for (const item of coverage) {
    if (!item || !Array.isArray(item.mappedTo)) return fail;
    const targets = item.mappedTo.filter((target: unknown) => typeof target === 'string' && target.startsWith('remainingRequests.'));
    if (!targets.length) { current.push(item); continue; }
    if (targets.length !== 1 || item.mappedTo.length !== 1 || typeof item.evidence !== 'string' || item.unresolved) return fail;
    const match = targets[0].match(/^remainingRequests\.(0|[1-9]\d*)$/);
    const index = match ? Number(match[1]) : -1;
    if (index < 0 || index >= requests.length || deferred.has(index)) return fail;
    const quote = item.evidence.normalize('NFC').trim();
    if (!quote || quote !== requests[index].normalize('NFC').trim()) return fail;
    const start = source.indexOf(quote);
    if (start < 0 || source.indexOf(quote, start + 1) >= 0) return fail;
    const end = start + quote.length;
    if (quotedData.some(match => start >= match.index! && end <= match.index! + match[0].length)) return fail;
    if (start > 0 && /[\p{L}\p{N}]/u.test(source[start - 1])
      || end < source.length && /[\p{L}\p{N}]/u.test(source[end])) return fail;
    if (spans.some(span => start < span.end && end > span.start)) return fail;
    spans[index] = { start, end };
    deferred.add(index);
  }
  if (deferred.size !== requests.length || !current.length) return fail;
  if (spans.some((span, index) => index > 0 && span.start < spans[index - 1].end)) return fail;
  if (!current.some(item => typeof item.evidence === 'string' && item.mappedTo.includes('action')
    && source.indexOf(item.evidence.normalize('NFC')) >= 0 && source.indexOf(item.evidence.normalize('NFC')) < spans[0].start)) return fail;
  let currentText = source;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) currentText = currentText.slice(0, span.start) + ' ' + currentText.slice(span.end);
  currentText = currentText.trim().replace(/(?:[,;\s]+(?:rồi|và|sau đó|tiếp theo|đồng thời))+[,;.\s]*$/iu, '').trim();
  if (!currentText || currentText.length === source.length) return fail;
  return { ok: true, currentText, coverage: current };
}
