import type { AssistantReply } from "../../src/shared/assistant-workflow";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

export const assistantReplyPresentationRule = "Chỉ nói về yêu cầu, thông tin còn thiếu, xác nhận và kết quả nghiệp vụ. Không kể tên hay giải thích workflow đang dùng. Không liệt kê các trường được tự điền bằng giá trị mặc định. Giữ thông tin người dùng chủ động nhập, câu hỏi cần bổ sung và yêu cầu xác nhận.";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
const fieldLine = /^([^:\r\n]{1,100}):\s*(.*)$/;

/** Remove implementation narration, while leaving business values and questions intact. */
export function omitAssistantInternalNarration(text: string): string {
  return text.split("\n").flatMap(line => {
    const plain = normalize(line.replace(/^\s*\d+[.)]\s+/, "").replace(/^[\s*#>\-]+/, "").replace(/\*\*/g, ""));
    if (/^(?:workflow(?: (?:duoc su dung|duoc chon|su dung|dang dung|ap dung))?|quy trinh (?:duoc su dung|su dung|dang dung|ap dung)|(?:su dung|ap dung) workflow)\s*:/.test(plain)) return [];
    if (/^(?:cac )?(?:truong|thong tin|gia tri) (?:duoc tu dien|mac dinh)(?:\s*[:：]|\s+gom)/.test(plain)) return [];
    // A labelled business value is data, including names that happen to contain "workflow".
    const field = line.match(fieldLine);
    if (field && !/\b(?:minh|toi|he thong|tro ly)\b/.test(normalize(field[1]))) return [line];
    const content = line.replace(/^\s*\d+[.)]\s+/, "");
    const sentences = content.split(/(?<=[.!?])\s+(?=[A-ZÀ-ỸĐ])/u);
    const revised = sentences.flatMap(sentence => {
      const normalized = normalize(sentence);
      const workflowNarration = /\b(?:minh|toi|tro ly|he thong|yeu cau nay|thao tac nay)\b.{0,60}\b(?:su dung|dung|ap dung|chay|chon|thuc hien|xu ly)\b.{0,35}\bworkflow\b/.test(normalized)
        || /^(?:(?:dang|se|da) )?(?:su dung|dung|ap dung|chay) workflow\b/.test(normalized);
      const defaultNarration = /\b(?:minh|toi|tro ly|he thong)\b.{0,70}\b(?:dung|tu dien|dien|gan|ap dung|giu)\b.{0,35}\bmac dinh\b/.test(normalized);
      if (workflowNarration || defaultNarration) {
        const question = sentence.match(/[;,]\s*((?:Bạn|Vui lòng|Hãy|Mời bạn)\s.+)$/iu);
        return question ? [question[1]] : [];
      }
      return [sentence];
    }).join(" ");
    return [revised === content ? line : revised];
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Applied after response editing, for every module and every response status. */
export function presentAssistantReply(reply: AssistantReply, defaultedLabels: readonly string[] = []): AssistantReply {
  const hiddenLabels = new Set(defaultedLabels.map(normalize));
  const visibleField = (segment: string) => {
    const field = segment.match(fieldLine);
    return !field || !hiddenLabels.has(normalize(field[1]));
  };
  let filtered = reply.reply.split("\n").flatMap(line => {
    const numbered = line.match(/^(\s*\d+\.\s+)(.+)$/);
    if (numbered) {
      const fields = numbered[2].split(/\s+·\s+/).filter(visibleField);
      return fields.length ? [numbered[1] + fields.join(" · ")] : [];
    }
    return visibleField(line) ? [line] : [];
  }).join("\n");
  const table = hiddenLabels.size ? parseAssistantResultTable(reply.reply) : null;
  if (table && table.headers.some(label => hiddenLabels.has(normalize(label)))) {
    const records = table.rows.map(row => Object.fromEntries(Object.entries(row.values).filter(([label]) => !hiddenLabels.has(normalize(label)))));
    filtered = records.some(record => Object.keys(record).length)
      ? formatAssistantResultTable(table.before.join("\n"), records, table.after)
      : [...table.before, ...table.after].join("\n");
  }
  const fallback = reply.status === "confirmation" ? "Bạn kiểm tra thông tin rồi xác nhận để tiếp tục nhé."
    : reply.status === "collecting" ? "Bạn gửi giúp mình thông tin còn thiếu nhé."
      : reply.status === "completed" ? "Mình đã xử lý xong yêu cầu."
        : "Mình chưa thể hoàn tất yêu cầu. Bạn thử lại giúp mình nhé.";
  return {
    ...reply,
    reply: omitAssistantInternalNarration(filtered) || fallback,
    ...(reply.action ? { action: { ...reply.action, values: reply.action.values.filter(item => !item.defaulted) } } : {}),
  };
}
