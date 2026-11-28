import type { AssistantReply } from "../../src/shared/assistant-workflow";
import { formatAssistantResultTable, parseAssistantResultTable } from "../../src/shared/assistant-result-table";

export const assistantNaturalLanguageRule = "Viết tiếng Việt như một đồng nghiệp đang hỗ trợ trực tiếp, xưng mình–bạn. Nói ngay kết quả hoặc điều cần hỏi, dùng câu ngắn, rõ và ấm áp. Khi hỏi lại, chỉ hỏi phần thật sự còn thiếu và tận dụng ngữ cảnh đã có. Không bắt người dùng viết lại câu theo mẫu. Không mở đầu bằng ‘Mình hiểu yêu cầu’, ‘Mình kiểm tra giúp bạn rồi nhé’ hay lời xác nhận chung không có thông tin. Không lặp ‘nhé’, không dùng giọng hành chính như ‘cung cấp đầy đủ các trường’. Nêu hạn chế bằng việc chưa làm được và bước tiếp theo, không đổ lỗi cho cách hỏi của người dùng. Không dùng dấu chấm phẩy trong lời dẫn do bạn viết. Giữ nguyên dấu câu trong dữ liệu, tên, mã, ghi chú, trích dẫn, bảng, URL và mã nguồn. Tôn trọng định dạng người dùng yêu cầu. Không đổi trạng thái thao tác hoặc bịa dữ liệu để câu nghe trôi chảy hơn.";
export const assistantReplyPresentationRule = `Chỉ nói về yêu cầu, thông tin còn thiếu, xác nhận và kết quả nghiệp vụ. Không kể tên hay giải thích workflow đang dùng. Không liệt kê các trường được tự điền bằng giá trị mặc định. Giữ thông tin người dùng chủ động nhập, câu hỏi cần bổ sung và yêu cầu xác nhận. Nếu có biểu mẫu hoặc lựa chọn, hướng dẫn họ điền/chọn ngay ở đó. Không đưa API, workflow, mapping, payload hay lỗi ánh xạ vào lời giải thích nghiệp vụ. Không dùng tiêu đề Markdown, dấu ** hoặc mẫu [đối tượng], [thông tin cần sửa] trong lời dẫn. Giữ nguyên bảng và nội dung dữ liệu. Phân biệt không có dữ liệu với chưa đọc được dữ liệu, thiếu quyền với phân hệ chưa bật. Không nói đã tạo/sửa/xóa khi còn hỏi thêm hoặc chờ xác nhận. Không tự đổi bộ lọc hoặc phạm vi để đưa ra kết quả. ${assistantNaturalLanguageRule}`;

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
const fieldLine = /^([^:\r\n]{1,100}):\s*(.*)$/;

function conversationalFieldLabel(label: string) {
  return label.replace(/\s*\((?:DD\/MM\/YYYY|YYYY-MM-DD)[^)]*\)/giu, '').replace(/\s+/g, ' ').trim();
}

function naturalList(labels: readonly string[], type: "conjunction" | "disjunction" = "conjunction") {
  const items = [...new Set(labels.map(conversationalFieldLabel).filter(Boolean))].map(label => {
    if (label === "Điện thoại") return "số điện thoại";
    return /^[A-ZĐ]{2,}(?:\s|$)/u.test(label) ? label : label.charAt(0).toLocaleLowerCase("vi") + label.slice(1);
  });
  return new Intl.ListFormat("vi", { style: "long", type }).format(items);
}

export function assistantMissingInformationPrompt(labels: readonly string[], hasForm: boolean) {
  const fields = !labels.length || labels.length > 4 ? "các thông tin còn thiếu" : naturalList(labels);
  return hasForm ? `Bạn bổ sung ${fields} trong form bên dưới nhé.` : `Bạn cho mình biết ${fields} nhé.`;
}

export function assistantSelectionPrompt(labels: readonly string[]) {
  const subjects = labels.map(label => conversationalFieldLabel(label)
    .replace(/^(?:(?:Tên,?|Mã)\s+|hoặc\s+(?:mã|số điện thoại)\s+)+/iu, ''));
  const fields = subjects.length > 0 && subjects.length <= 3 ? naturalList(subjects) : 'thông tin cần dùng';
  return `Bạn chọn ${fields} bên dưới nhé.`;
}

export function assistantConfirmationPrompt(title: string) {
  const action = naturalOperationPhrase(title);
  return `Bạn xem lại thông tin rồi xác nhận để mình ${action || "thực hiện"} nhé.`;
}

function naturalOperationPhrase(title: string) {
  const text = title.trim().replace(/[.!?]+$/, "");
  if (!/^(?:Tạo|Thêm|Cập nhật|Sửa|Xóa|Hủy|Gỡ|Ghi nhận|Duyệt|Phê duyệt|Xác nhận|Gia hạn|Chuyển|Lập|Gửi|Đặt|Đóng|Mở|Hoàn tất|Bật|Tắt|Khôi phục|Thanh toán)\s/iu.test(text)) return "";
  return text.charAt(0).toLocaleLowerCase("vi") + text.slice(1);
}

export function assistantCompletedOperationSummary(title: string) {
  const action = naturalOperationPhrase(title);
  return action ? `Đã ${action}.` : "Đã thực hiện xong yêu cầu.";
}

/** Keep restored replies from the previous wording usable by the same follow-up flow. */
export function hasAssistantOptionalInformationPrompt(text?: string): boolean {
  if (!text) return false;
  const table = parseAssistantResultTable(text);
  return /^Bạn có muốn bổ sung(?: [^?\r\n]+)? không\?(?:\s|$)/mu.test(table ? table.after.join('\n') : text);
}

export function assistantOptionalInformationPrompt(labels: readonly string[]) {
  const shown = labels.slice(0, 3);
  const remaining = labels.length > shown.length;
  const options = remaining ? naturalList([...shown, "thông tin còn thiếu khác"], "disjunction") : naturalList(shown, 'disjunction');
  return options ? `Bạn có muốn bổ sung ${options} không? Có thể nói “bỏ qua” để thêm sau.`
    : 'Bạn có muốn bổ sung thông tin khác không? Có thể nói “bỏ qua” để thêm sau.';
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
    if (filter) return `Mình chưa áp dụng được điều kiện “${filter[1]}”. Phần yêu cầu này chưa được thực hiện.`;
    const ranking = line.match(/^Tiêu chí xếp hạng “(.+)” chưa được gắn với phép xếp hạng cụ thể\. Mình chưa gọi API\.$/);
    if (ranking) return `Mình chưa xếp hạng được theo tiêu chí “${ranking[1]}”, nên chưa thể đưa ra kết quả.`;
    const missing = line.match(/^Mình chưa đưa đủ chi tiết “(.+)” vào kế hoạch tra cứu\. Mình chưa gọi API để tránh bỏ sót điều kiện; bạn xác nhận lại giúp mình nhé\.$/);
    if (missing) return `Mình chưa xử lý được chi tiết “${missing[1]}” trong yêu cầu, nên chưa thực hiện bước này.`;
    const mapping = line.match(/^Mình chưa ánh xạ được yêu cầu “(.+)” vào thông tin cần dùng\. Bạn làm rõ ý này giúp mình nhé\.$/);
    if (mapping) return `Mình chưa xác định được thông tin cần dùng cho “${mapping[1]}”. Bạn nói rõ phần này giúp mình nhé.`;
    const source = line.match(/^Yêu cầu “(.+)” chưa được ánh xạ vào nguồn dữ liệu cụ thể\.$/);
    if (source) return `Mình chưa tìm được thông tin để xử lý phần “${source[1]}”.`;
    if (line === 'Kế hoạch tổng hợp đang lặp một nguồn dữ liệu. Mình chưa gọi API nào.') return 'Mình chưa tổng hợp được kết quả đáng tin cậy cho yêu cầu này. Phần tra cứu chưa được thực hiện.';
    if (line === 'Kế hoạch tổng hợp chỉ được gọi các API đọc dữ liệu. Mình chưa thực hiện thao tác nào.') return 'Mình chưa thể kết hợp các phần việc này thành một báo cáo. Chưa có thao tác nào được thực hiện.';
    return line;
  }).join("\n");
}

function naturalOpening(text: string, status: AssistantReply['status']) {
  if (status === 'failed' || status === 'uncertain') return text;
  // Restrict cleanup to known wrapper sentences, never business rows, quotes,
  // names or source errors. Actual counts and the table protocol stay intact.
  return text.replace(/^Mình (?:hiểu yêu cầu của bạn|hiểu bạn muốn thực hiện yêu cầu này)\.\s*/u, '')
    .replace(/^Mình (?:đã )?kiểm tra giúp bạn rồi nhé:\s*\n/u, '')
    .replace(/^Xong rồi bạn nhé, mình đã /u, 'Đã ')
    .replace(/^Mình đã ((?:tạo|thêm|cập nhật|sửa|xóa|hủy|ghi nhận|chuyển|gia hạn|lập|gỡ|duyệt|khôi phục)\b[^\n]*)/iu, 'Đã $1')
    .replace(/^Chưa có kết quả phù hợp trong phạm vi đang xem\.(?: Bạn có thể thử tên hoặc mã khác, hay chọn lại phạm vi cần tìm\.)?$/u,
      'Không tìm thấy kết quả phù hợp trong phạm vi đang xem.');
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
  const fallback = reply.status === "confirmation" ? assistantConfirmationPrompt(reply.action?.title || '')
    : reply.status === "collecting" ? reply.referenceSelections?.length ? assistantSelectionPrompt(reply.referenceSelections.map(group => group.label))
      : reply.inputForm?.fields.length ? assistantMissingInformationPrompt(reply.inputForm.fields.map(field => field.label), true)
        : reply.workflowSelection ? 'Bạn chọn mục cần xử lý bên dưới nhé.' : "Bạn cho mình biết thông tin còn thiếu nhé."
      : reply.status === "completed" ? "Đã xử lý xong yêu cầu."
        : "Mình chưa thể hoàn tất yêu cầu. Bạn thử lại giúp mình nhé.";
  let presented = omitAssistantInternalNarration(filtered) || fallback;
  if (reply.status === 'collecting' && reply.referenceSelections?.length) {
    const legacySelection = new Set(['Mình đã tìm thấy lựa chọn phù hợp. Bạn chọn ngay bên dưới nhé.', 'Bạn chọn thông tin trong danh sách bên dưới nhé.']);
    presented = presented.split('\n').map(line => legacySelection.has(line.trim())
      ? assistantSelectionPrompt(reply.referenceSelections!.map(group => group.label)) : line).join('\n');
  }
  if (reply.status === "collecting" || reply.status === 'unsupported') presented = naturalClarification(presented);
  presented = naturalOpening(presented, reply.status);
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
