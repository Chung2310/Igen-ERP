export interface AssistantResultTableRow {
  number: string;
  values: Record<string, string>;
}
export interface AssistantResultTable {
  before: string[];
  after: string[];
  headers: string[];
  rows: AssistantResultTableRow[];
}

const friendlySummary = /^Mình tìm thấy (?:một|[\d.,]+) kết quả phù hợp cho bạn\.?$/i;
const countedSummary = /^.+\s·\s[\d.,]+\s+kết quả(?:\s+\(hiển thị\s+[\d.,]+\))?:?$/i;
const numberedRow = /^\s*(\d+)\.\s+(.+?)\s*$/;
const successSummary = /^(?:Xong rồi bạn nhé, mình đã|Mình đã|Đã|Hoàn tất|Mình tìm thấy|Mình kiểm tra)\s/i;
const prose = /^(?:Mình|Bạn|Nếu|Vui lòng|Có thể)\s/i;
const fieldLine = /^([^:\r\n]{1,80}):\s*(.*)$/;
const cell = (value: string) => value.replace(/[\r\n\u2028\u2029]+/g, "; ").replace(/\s+·\s+/g, " • ").trim() || "—";

/** Module formatters supply public labelled values; the shared layer owns the table protocol. */
export function formatAssistantResultTable(summary: string, records: Array<Record<string, string>>, after: string[] = []): string {
  if (!records.length) return `${summary}\nKhông có kết quả phù hợp.`;
  const heading = friendlySummary.test(summary) || countedSummary.test(summary)
    ? summary : `${summary.replace(/[.:]+$/, "")} · ${records.length} kết quả:`;
  return [heading, ...records.map((record, index) => `${index + 1}. ${Object.entries(record).map(([label, value]) => `${label}: ${cell(value)}`).join(" · ")}`), ...after].join("\n");
}

function parseRow(line: string): AssistantResultTableRow | null {
  const match = line.match(numberedRow);
  if (!match) return null;
  const values: Record<string, string> = Object.create(null);
  for (const segment of match[2].split(/\s+·\s+/)) {
    const field = segment.match(fieldLine);
    if (!field || Object.hasOwn(values, field[1].trim())) return { number: match[1], values: { "Thông tin": match[2].trim() } };
    values[field[1].trim()] = field[2].trim() || "—";
  }
  return { number: match[1], values };
}

/** Recognize data structure independently of module names or an adapter's opening sentence. */
export function parseAssistantResultTable(content: string): AssistantResultTable | null {
  const lines = content.split(/\r?\n/);
  const summary = lines.some(line => friendlySummary.test(line.trim()) || countedSummary.test(line.trim()));
  for (let start = 0; start < lines.length; start++) {
    if (!numberedRow.test(lines[start])) continue;
    let end = start;
    const rows: AssistantResultTableRow[] = [];
    while (end < lines.length && numberedRow.test(lines[end])) rows.push(parseRow(lines[end++])!);
    const structured = rows.every(row => Object.keys(row.values).length >= 2);
    if (!summary && !structured) { start = end - 1; continue; }
    return {
      before: lines.slice(0, start).filter(line => line.trim()), after: lines.slice(end).filter(line => line.trim()),
      headers: [...new Set(rows.flatMap(row => Object.keys(row.values)))], rows,
    };
  }
  if (!successSummary.test(lines[0]?.trim() || "")) return null;
  let start = 1;
  while (start < lines.length && !lines[start].trim()) start++;
  let end = start;
  const values: Record<string, string> = Object.create(null);
  while (end < lines.length && !prose.test(lines[end].trim())) {
    const field = lines[end].trim().match(fieldLine);
    if (!field || Object.hasOwn(values, field[1].trim())) break;
    values[field[1].trim()] = field[2].trim() || "—";
    end++;
  }
  if (!Object.keys(values).length) return null;
  return { before: lines.slice(0, start).filter(line => line.trim()), after: lines.slice(end).filter(line => line.trim()), headers: Object.keys(values), rows: [{ number: "1", values }] };
}
