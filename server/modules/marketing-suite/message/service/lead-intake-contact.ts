import { normalizeIntakeText, normalizeIntakeValue } from "./normalize-intake-fields";

export type LeadContactField = "name" | "phone" | "email";

export function isLeadContactField(field: string | undefined): field is LeadContactField {
  return field === "name" || field === "phone" || field === "email";
}

export function isLeadGreeting(text: string) {
  return /^(?:(?:hi+|hello+|hey+|alo+|chao|xin chao)(?: (?:a|ad|admin|anh|chi|em|ban|shop|bac si|phong kham|moi nguoi|nha|nhe|oi))*|good (?:morning|afternoon|evening))$/
    .test(normalizeIntakeText(text));
}

function normalizeName(text: string) {
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

export function isLeadName(value: string) {
  const name = normalizeName(value);
  return name.length <= 200
    && /^[\p{L}\p{M}]+(?:[ '’.-][\p{L}\p{M}]+)*$/u.test(name)
    && !isLeadGreeting(name)
    && !/^(?:ok(?:ay|e|i)?|yes|no|dạ|vâng|ừ|uh|uhm|có|không|cảm ơn|thanks|chưa rõ|không rõ)(?: ạ)?$/iu.test(name);
}

export function leadMessageParts(text: string) {
  const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line, index) => line.startsWith(`${index + 1}. `))) {
    return lines.map(line => line.slice(line.indexOf(".") + 2));
  }
  return lines;
}

const nameIntro = /(?:^|[\s,;])(?:(?:em|anh|ch[iị]|m[iì]nh|t[oô]i|ch[aá]u|t[oớ]|con|tui)\s+(?:t[eê]n(?:\s+l[aà])?|l[aà])|(?:h[oọ](?:\s+v[aà])?\s+t[eê]n|t[eê]n(?:\s+(?:em|anh|ch[iị]|m[iì]nh|t[oô]i|kh[aá]ch h[aà]ng))?)(?:\s+l[aà]|\s*:)|my name is|i am)\s*:?\s*/giu;
const endsName = /^(?=$|[\s,;.!?])(?:\s*(?:[,;.!?]|$)|\s+(?:ạ|nhé|nha|muốn|cần|ở|đăng ký|đặt lịch|số điện thoại|sđt|email)(?=$|[\s,;.!?]))/iu;
const dateLike = /^(?:\d{4}[-.]\d{1,2}[-.]\d{1,2}|\d{1,2}[-.]\d{1,2}[-.]\d{4})$/u;

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
}

export function readStandaloneContact(field: "phone" | "email", text: string) {
  if (field === "phone" && dateLike.test(text.trim())) return undefined;
  return normalizeIntakeValue({ key: field, label: field, question: "", type: field }, text);
}

export function hasLeadContactEvidence(field: LeadContactField, value: string, parts: string[], allowStandaloneName = true) {
  if (field === "name") {
    const name = normalizeName(value);
    return parts.some(part => {
      const text = normalizeName(part);
      if (allowStandaloneName && text.replace(/^dạ[, ]+/, "").replace(/(?:\s+(?:ạ|nhé|nha))?[.!?]*$/iu, "") === name) return true;
      if (allowStandaloneName && text.startsWith(name) && /^[,;]\s*\+?\d/u.test(text.slice(name.length))) return true;
      return Array.from(text.matchAll(nameIntro), match => text.slice(match.index + match[0].length))
        .some(answer => answer.startsWith(name) && endsName.test(answer.slice(name.length)));
    });
  }
  if (field === "email") {
    return parts.some(part => Array.from(part.matchAll(/[^\s<>(),;:"']+@[^\s<>(),;:"']+\.[\p{L}\p{N}]+/gu))
      .some(([address]) => address.toLowerCase() === value.toLowerCase()));
  }
  return parts.some(part => Array.from(part.matchAll(/(?:^|[^\p{L}\p{N}@])(\+?\(?\d[\d(). -]*\d)(?![\p{L}\p{N}@])/gu))
    .some(([, phone]) => readStandaloneContact("phone", phone) && phoneDigits(phone) === phoneDigits(value)));
}
