import type { AssistantOperation } from './catalog';

export const normalizeRequestWords = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** “đã … chưa” asks whether the stated fact holds. Only the final particle
 * is framing; “chưa thanh toán” in the body remains a negative predicate. */
function completionQuestionBody(text: string): string | undefined {
  const source=text.normalize('NFC');
  const ending=/\s+(?:hay\s+)?chưa(?:\s+(?:nhỉ|nhé|ạ))?[?!.]*\s*$/iu.exec(source);
  if(!ending)return;
  const body=source.slice(0,ending.index);
  const question=/(?:^|\s)(?:đã|có)\s/iu.test(body);
  if(!question || /(?:tên|mã|giá trị|ghi chú)\s*[:=]?\s*$/iu.test(body))return;
  return body;
}

export function isCompletionQuestionParticle(text: string, evidence: string) {
  const body=completionQuestionBody(text);
  if(body===undefined || /(?:^|\s)chưa(?=\s|[,.!?;:]|$)/iu.test(body))return false;
  return ['chua','hay chua'].includes(normalizeRequestWords(evidence));
}

/** Discourse is stripped at the edges only. Negated predicates and names in
 * the body remain data and must still be accounted for by coverage. */
export function stripRequestFraming(text: string) {
  let result = text.replace(/^\s*(?:(?:mình|tôi|chúng tôi)\s+(?:chỉ\s+)?muốn\s+)/iu, '');
  result = result.replace(/^\s*(?:mình|tôi)\s+hỏi\s+/iu,'');
  result = completionQuestionBody(result) ?? result;
  if (/(?:^|\s)có\s+/iu.test(result)) result = result.replace(/\s+không[?!.]*\s*$/iu,'');
  result = result.replace(/^\s*(?:(?:vui lòng|nhờ bạn|giúp mình|giúp tôi|kiểm tra(?:\s+xem)?|xem|tìm|liệt kê(?:\s+danh sách)?|lọc(?:\s+danh sách)?)\s+)+/iu, '');
  // "nào không" is a polar-question ending, unlike "không có/chưa...".
  result = result.replace(/\s+(?:nào\s+không|hay\s+không)(?:\s+(?:nhé|ạ))?[?!.]*\s*$/iu, '');
  return result;
}

/** Match a capability's stated meaning, never an arbitrary union of words
 * from unrelated clauses. Unknown names, dates, numbers and negation survive. */
export function canonicalActionEvidence(text: string, operation: AssistantOperation) {
  let phrase = normalizeRequestWords(stripRequestFraming(text));
  if (operation.method === 'GET' || operation.readOnly) {
    phrase = phrase.replace(/^(?:(?:bao cao|tra cuu|thong ke|tong hop|danh sach|tinh hinh|loc|xem) )+/, '');
    phrase = phrase.replace(/^co ai (.+?)(?: khong)?$/, '$1');
  } else {
    phrase = phrase.replace(/^(?:sua(?: lai)?|dieu chinh|cap nhat) /, 'cap nhat ');
  }
  phrase = phrase.replace(/\bchuan bi het han\b/g, 'sap het han')
    .replace(/\b(?:di tre|di lam tre)\b/g, 'di muon')
    .replace(/\bquen cham cong\b/g, 'chua cham cong');
  if ((operation.method === 'GET' || operation.readOnly) && /\bhom nay\b/.test(phrase)) {
    phrase = `${phrase.replace(/\bhom nay\b/g, '').trim()} hom nay`;
  }
  // These are entity/grammar words, not predicates. Keep khong/chua/chi and all
  // numeric/date/scope words so an extra business restriction cannot disappear.
  return phrase.replace(/\b(?:nhan su|nhan vien)\b/g, ' ')
    .replace(/\b(?:ai|nao|cac|nhung|cua|trong)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** An asserted motive for a single-record mutation is not an "only if"
 * execution condition. Keep it in the preview; never send it as an API field. */
export function assistantRequestReason(text: string, operation: AssistantOperation, values: Record<string, unknown>) {
  if (operation.method === 'GET' || operation.readOnly) return undefined;
  if (!operation.fields.some(field => field.reference
    && (field.source === 'path' || operation.path.split('/').includes(`:${field.apiKey || field.key.replace(/^path_/, '')}`))
    && typeof values[field.key] === 'string' && values[field.key])) return undefined;
  const match = /(?:^|\s)((?:vì|bởi vì|do)\s+(.+?))[.!?]*\s*$/iu.exec(text);
  if (!match) return undefined;
  const reason = match[2].trim();
  const normalized = normalizeRequestWords(reason);
  if (/\b(?:neu|chi khi|truoc khi|sau khi|voi dieu kien|ngoai tru|tru khi)\b/.test(normalized)
    || /\b(?:va|roi|xong)\s+(?:xoa|sua|tao|them|chuyen|gui|cap nhat|thay|doi)\b/.test(normalized)) return undefined;
  const start = match.index + match[0].indexOf(match[1]);
  // A name containing a causal-looking word is still an indivisible value.
  for (const value of Object.values(values)) {
    if (typeof value !== 'string' || !value) continue;
    const index = text.toLocaleLowerCase('vi').indexOf(value.toLocaleLowerCase('vi'));
    if (index >= 0 && index <= start && index + value.length > start) return undefined;
  }
  return { evidence: match[1], reason };
}

export function isExplicitEmptyFieldValue(operation: AssistantOperation, key: string, value: unknown) {
  const field = operation.fields.find(field => field.key === key);
  return value === '' && operation.clearableFields?.includes(key) === true
    && Boolean(field && !field.reference && !field.required && !field.systemRequired && field.type === 'text');
}

export function isFieldClearEvidence(evidence: string, operation: AssistantOperation, key: string, value: unknown) {
  if (!isExplicitEmptyFieldValue(operation, key, value)) return false;
  const phrase = normalizeRequestWords(evidence);
  const labels = key === 'jobTitle' ? ['chuc danh', 'chuc vu'] : [normalizeRequestWords(operation.fields.find(field => field.key === key)!.label)];
  return /\b(?:xoa|huy|bo|go|lam trong)\b/.test(phrase) && labels.some(label => phrase.includes(label));
}
