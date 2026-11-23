import type { AssistantReply } from "../../src/shared/assistant-workflow";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

export const assistantNaturalLanguageRule = "Viết tiếng Việt như một đồng nghiệp đang hỗ trợ trực tiếp, xưng mình–bạn. Nói ngay kết quả hoặc điều cần hỏi, dùng câu ngắn, rõ và ấm áp. Khi hỏi lại, chỉ hỏi phần thật sự còn thiếu và tận dụng ngữ cảnh đã có. Không bắt người dùng viết lại câu theo mẫu. Không mở đầu bằng ‘Mình hiểu yêu cầu’, ‘Mình kiểm tra giúp bạn rồi nhé’ hay lời xác nhận chung không có thông tin. Không lặp ‘nhé’, không dùng giọng hành chính như ‘cung cấp đầy đủ các trường’. Nêu hạn chế bằng việc chưa làm được và bước tiếp theo, không đổ lỗi cho cách hỏi của người dùng. Không dùng dấu chấm phẩy trong lời dẫn do bạn viết. Giữ nguyên dấu câu trong dữ liệu, tên, mã, ghi chú, trích dẫn, bảng, URL và mã nguồn. Tôn trọng định dạng người dùng yêu cầu. Không đổi trạng thái thao tác hoặc bịa dữ liệu để câu nghe trôi chảy hơn.";
export const assistantReplyPresentationRule = `Chỉ nói về yêu cầu, thông tin còn thiếu, xác nhận và kết quả nghiệp vụ. Không kể tên hay giải thích workflow đang dùng. Không liệt kê các trường được tự điền bằng giá trị mặc định. Giữ thông tin người dùng chủ động nhập, câu hỏi cần bổ sung và yêu cầu xác nhận. Nếu có biểu mẫu hoặc lựa chọn, hướng dẫn họ điền/chọn ngay ở đó. Không đưa API, workflow, mapping, payload hay lỗi ánh xạ vào lời giải thích nghiệp vụ. Không dùng tiêu đề Markdown, dấu ** hoặc mẫu [đối tượng], [thông tin cần sửa] trong lời dẫn. Giữ nguyên bảng và nội dung dữ liệu. ${assistantNaturalLanguageRule}`;

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
const fieldLine = /^([^:\r\n]{1,100}):\s*(.*)$/;

function naturalList(labels: readonly string[], type: "conjunction" | "disjunction" = "conjunction") {
  const items = [...new Set(labels.map(label => label.trim()).filter(Boolean))].map(label => {
    if (label === "Điện thoại") return "số điện thoại";
    return /^[A-ZĐ]{2,}(?:\s|$)/u.test(label) ? label : label.charAt(0).toLocaleLowerCase("vi") + label.slice(1);
  });
  return new Intl.ListFormat("vi", { style: "long", type }).format(items);
}

export function assistantMissingInformationPrompt(labels: readonly string[], hasForm: boolean) {
  const fields = labels.length > 4 ? "các thông tin còn thiếu" : naturalList(labels);
  return hasForm ? `Bạn bổ sung ${fields} trong biểu mẫu bên dưới nhé.` : `Bạn cho mình biết ${fields} nhé.`;
}

export function assistantConfirmationPrompt(title: string) {
  const action = naturalOperationPhrase(title);
  return `Bạn xem lại thông tin bên dưới rồi xác nhận để mình ${action || "thực hiện"} nhé.`;
}

function naturalOperationPhrase(title: string) {
  const text = title.trim().replace(/[.!?]+$/, "");
  if (!/^(?:Tạo|Thêm|Cập nhật|Sửa|Xóa|Hủy|Gỡ|Ghi nhận|Duyệt|Phê duyệt|Xác nhận|Gia hạn|Chuyển|Lập|Gửi|Đặt|Đóng|Mở|Hoàn tất|Bật|Tắt|Khôi phục|Thanh toán)\s/iu.test(text)) return "";
  return text.charAt(0).toLocaleLowerCase("vi") + text.slice(1);
}

export function assistantCompletedOperationSummary(title: string) {
  const action = naturalOperationPhrase(title);
  return action ? `Mình đã ${action}.` : "Mình đã thực hiện xong yêu cầu.";
}

export function assistantOptionalInformationPrompt(labels: readonly string[]) {
  const shown = labels.slice(0, 3);
  const remaining = labels.length > shown.length;
  const options = remaining ? naturalList([...shown, "thông tin còn thiếu khác"], "disjunction") : naturalList(shown);
  return `Bạn có muốn bổ sung không? Mình có thể thêm ${options}. Bạn gửi thông tin cần thêm, hoặc nói “bỏ qua” nhé.`;
}

/** Only presentation wrappers are changed. Result rows, labelled data, quoted
 * values, URLs and code keep their literal spelling and punctuation. */
function tidyAssistantProse(text: string) {
  let fenced = false;
  return text.split("\n").map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    if (fenced || /^\s*\d+\.\s/.test(line)
      || fieldLine.test(line) && !/\s·\s[\d.,]+\s+kết quả(?:\s+\(hiển thị\s+[\d.,]+\))?:$/.test(line)) return line;
    const values: string[] = [];
    const protectedLine = line.replace(/“[^”]*”|"[^"\n]*"|`[^`\n]+`|https?:\/\/\S+/g, value => {
      values.push(value); return `\u0000${values.length - 1}\u0000`;
    });
    const cleaned = protectedLine.replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/\*\*([^*\n]+)\*\*/g, "$1")
      .replace(/__([^_\n]+)__/g, "$1");
    return cleaned.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => values[Number(index)]);
  }).join("\n");
}

/** These are trusted server diagnostics. Translate only their whole known
 * sentences after validation, so routing/repair logic still sees its original
 * diagnostics and quoted business conditions keep their exact meaning. */
function naturalClarification(text: string) {
  return text.split("\n").map(line => {
    const filter = line.match(/^Điều kiện “(.+)” chưa được gắn với (?:trường lọc|bộ lọc của nguồn dữ liệu)\. Mình chưa gọi API\.$/);
    if (filter) return `Mình chưa xử lý được điều kiện “${filter[1]}”. Phần yêu cầu này chưa được thực hiện.`;
    const ranking = line.match(/^Tiêu chí xếp hạng “(.+)” chưa được gắn với phép xếp hạng cụ thể\. Mình chưa gọi API\.$/);
    if (ranking) return `Mình chưa xếp hạng được theo tiêu chí “${ranking[1]}”, nên chưa thể đưa ra kết quả.`;
    const missing = line.match(/^Mình chưa đưa đủ chi tiết “(.+)” vào kế hoạch tra cứu\. Mình chưa gọi API để tránh bỏ sót điều kiện; bạn xác nhận lại giúp mình nhé\.$/);
    if (missing) return `Mình chưa xử lý được chi tiết “${missing[1]}” trong yêu cầu, nên chưa thực hiện bước này.`;
    const mapping = line.match(/^Mình chưa ánh xạ được yêu cầu “(.+)” vào thông tin cần dùng\. Bạn làm rõ ý này giúp mình nhé\.$/);
    if (mapping) return `Mình chưa xác định được thông tin cần dùng cho “${mapping[1]}”. Bạn nói rõ phần này giúp mình nhé.`;
    const source = line.match(/^Yêu cầu “(.+)” chưa được ánh xạ vào nguồn dữ liệu cụ thể\.$/);
    if (source) return `Mình chưa xác định được nguồn thông tin phù hợp để xử lý “${source[1]}”.`;
    return line;
  }).join("\n");
}

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
  let presented = omitAssistantInternalNarration(filtered) || fallback;
  if (reply.status === "collecting") presented = naturalClarification(presented);
  // A single record is already clear from the table; avoid the mechanical
  // “· 1 kết quả” suffix when the shared parser can retain its structure.
  const resultTable = parseAssistantResultTable(presented);
  if (resultTable?.rows.length === 1 && Object.keys(resultTable.rows[0].values).length >= 2) {
    const candidate = presented.replace(/^(.*?)\s·\s1\s+kết quả:\s*$/m, "$1");
    if (parseAssistantResultTable(candidate)) presented = candidate;
  }
  return {
    ...reply,
    reply: reply.status === "failed" || reply.status === "uncertain" ? presented : tidyAssistantProse(presented),
    ...(reply.action ? { action: { ...reply.action, values: reply.action.values.filter(item => !item.defaulted) } } : {}),
  };
}
