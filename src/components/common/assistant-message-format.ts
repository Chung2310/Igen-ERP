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

export interface AssistantSuccessCard {
  title: string;
  fields: { label: string; value: string }[];
  notes: string[];
}

/** Keep successful write results readable without changing the saved message. */
export function parseAssistantSuccessCard(content: string): AssistantSuccessCard | null {
  const [firstLine, ...remaining] = content.split(/\r?\n/);
  const match = firstLine?.trim().match(/^Xong rồi bạn nhé, mình đã (.+?)\.?$/i);
  if (!match) return null;

  const fields: AssistantSuccessCard["fields"] = [];
  const notes: string[] = [];
  for (const line of remaining) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const field = trimmed.match(/^([^:]{1,80}):\s*(.+)$/);
    if (field) fields.push({ label: field[1].trim(), value: field[2].trim() });
    else notes.push(trimmed);
  }
  if (!fields.length) return null;
  const action = match[1].trim();
  return { title: action.charAt(0).toLocaleUpperCase("vi") + action.slice(1), fields, notes };
}

const resultSummaryPattern = /^Mình tìm thấy (?:một|[\d.,]+) kết quả phù hợp cho bạn\.?$/i;
const rawResultSummaryPattern = /^.+\s·\s[\d.,]+\s+kết quả(?:\s+\(hiển thị\s+[\d.,]+\))?:?$/i;
const numberedRowPattern = /^\s*(\d+)\.\s+(.+?)\s*$/;

function parseNumberedRow(line: string): AssistantResultTableRow | null {
  const match = line.match(numberedRowPattern);
  if (!match) return null;

  const segments = match[2].split(/\s+·\s+/);
  const values: Record<string, string> = {};
  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex < 1) return { number: match[1], values: { "Thông tin": match[2].trim() } };

    const label = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!label || !value || Object.hasOwn(values, label)) {
      return { number: match[1], values: { "Thông tin": match[2].trim() } };
    }
    values[label] = value;
  }

  return { number: match[1], values };
}

/** Parse numbered data rows in conversational lookup results for consistent table display. */
export function parseAssistantResultTable(content: string): AssistantResultTable | null {
  const lines = content.split(/\r?\n/);
  if (!lines.some(line => resultSummaryPattern.test(line.trim()) || rawResultSummaryPattern.test(line.trim()))) return null;

  const firstRowIndex = lines.findIndex(line => numberedRowPattern.test(line));
  if (firstRowIndex < 0) return null;

  const rowLines: string[] = [];
  let nextLineIndex = firstRowIndex;
  while (nextLineIndex < lines.length && !lines[nextLineIndex].trim()) nextLineIndex += 1;
  while (nextLineIndex < lines.length && numberedRowPattern.test(lines[nextLineIndex])) {
    rowLines.push(lines[nextLineIndex]);
    nextLineIndex += 1;
  }

  const rows = rowLines.map(parseNumberedRow);
  if (rows.length === 0 || rows.some((row): row is null => row === null)) return null;

  const parsedRows = rows as AssistantResultTableRow[];
  const headers = [...new Set(parsedRows.flatMap(row => Object.keys(row.values)))];
  if (headers.length === 0) return null;

  return {
    before: lines.slice(0, firstRowIndex).filter(line => line.trim()),
    after: lines.slice(nextLineIndex).filter(line => line.trim()),
    headers,
    rows: parsedRows,
  };
}
