import type { AssistantReply, AssistantValue } from "../../src/shared/assistant-workflow";
import { formatAssistantResultTable } from "../../src/shared/assistant-result-table";
import { safeAssistantHttpUrl } from "../../src/components/common/assistant-link-utils";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const legalTopic = /\b(?:phap luat|phap ly|bo luat|luat\s+\S+|nghi dinh|thong tu|van ban quy pham|thu vien phap luat|kho van ban|rag|quy dinh ve|theo luat|dieu\s+\d+|khoan\s+\d+)\b/;
const legalSubject = /\b(?:nghi phep|thai san|bao hiem xa hoi|bhxh|bao hiem that nghiep|thue\s+(?:vat|gtgt|tncn|tndn|thu nhap|gia tri gia tang)|luong toi thieu|xu phat|boi thuong|cham dut hop dong|thu viec)\b/;
const knowledgeQuestion = /\b(?:bao nhieu|the nao|duoc khong|co duoc|khi nao|dieu kien|quy dinh|muc phat|thoi han|thoi gian|ty le|quyen loi)\b/;
const isLegalQuestion = (text: string) => legalTopic.test(text) || (legalSubject.test(text) && knowledgeQuestion.test(text));
const mutation = /^(?:(?:hay|giup toi|giup minh|vui long)\s+)*(?:tao|them|sua|cap nhat|xoa|dong bo|tai len|duyet|nhap|xuat|lap)\b/;
const applicationDate = /\b(?:tai ngay|vao ngay|ngay ap dung|ap dung ngay|tinh den ngay)\s+(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/-](\d{1,2})[/-](\d{4}))\b/;

/** Route knowledge questions only; record changes remain in the ERP interpreter. */
export function legalQuestionValues(question: string, messages: Array<{ role: string; content: string }> = [], lastLink?: string): Record<string, AssistantValue> | null {
  const text = normalize(question).trim();
  if (!text || mutation.test(text)) return null;
  const followUp = lastLink === "/van-ban-phap-luat"
    && /^(?:con\b|vay\b|the\b|neu\b|truong hop\b|giai thich\b|noi ro\b|chi tiet\b|ap dung\b|tai ngay\b|vao ngay\b)/.test(text);
  if (!isLegalQuestion(text) && !followUp) return null;
  const prior = followUp ? [...messages].reverse().find(message => message.role === "user" && isLegalQuestion(normalize(message.content)))?.content : undefined;
  const query = prior ? `Câu hỏi trước: ${prior}\nCâu hỏi tiếp: ${question}` : question;
  // Do not silently truncate the user's question or its legal conditions.
  const values: Record<string, AssistantValue> = { query };
  const priorUserMessages = followUp ? [...messages].reverse().filter(message => message.role === "user") : [];
  const topicIndex = priorUserMessages.findIndex(message => isLegalQuestion(normalize(message.content)));
  const date = text.match(applicationDate) || (topicIndex >= 0
    ? priorUserMessages.slice(0, topicIndex + 1).map(message => normalize(message.content).match(applicationDate)).find(Boolean)
    : null);
  if (date) values.asOf = date[1] ? `${date[1]}-${date[2]}-${date[3]}` : `${date[6]}-${date[5].padStart(2, "0")}-${date[4].padStart(2, "0")}`;
  return values;
}

export function legalAnswerReply(result: unknown): AssistantReply {
  const envelope = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
  const data = envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data) ? envelope.data as Record<string, unknown> : envelope;
  // Keep numbered explanations from being mistaken for rows by the shared table parser.
  const answer = typeof data.answer === "string" ? data.answer.trim().replace(/^(\s*\d+)\.\s+/gm, "$1) ") : "";
  if (!answer) return { status: "failed", reply: "Chưa nhận được câu trả lời từ kho văn bản pháp luật. Bạn thử lại nhé." };
  const records = (Array.isArray(data.sources) ? data.sources : []).filter(source => source && typeof source === "object").map(source => {
    const value = (key: string) => typeof source[key] === "string" ? source[key] : "";
    const url = safeAssistantHttpUrl(value("sourceUrl"));
    return {
      "Trích dẫn": value("citation"),
      "Văn bản": [value("symbol"), value("title")].filter(Boolean).join(" — "),
      "Điều khoản": [value("article"), value("clause") && `Khoản ${value("clause")}`, value("point") && `Điểm ${value("point")}`].filter(Boolean).join(" / "),
      "Cơ quan ban hành": value("issuingAuthority"),
      ...(url ? { "Nguồn": url } : {}),
    };
  });
  return {
    status: "completed",
    reply: records.length ? `${answer}\n\n${formatAssistantResultTable("Nguồn văn bản pháp luật", records)}` : answer,
    link: "/van-ban-phap-luat",
  };
}
