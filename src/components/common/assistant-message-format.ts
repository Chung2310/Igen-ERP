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

const resultSummaryPattern = /^Mình tìm thấy (?:một|[\d.,]+) kết quả phù hợp cho bạn\.?$/i;
const numberedRowPattern = /^\s*(\d+)\.\s+(.+?)\s*$/;

function parseNumberedRow(line: string): AssistantResultTableRow | null {
  const match = line.match(numberedRowPattern);
  if (!match) return null;

  const segments = match[2].split(/\s+·\s+/);
  if (segments.length < 2) return null;

  const values: Record<string, string> = {};
  for (const segment of segments) {
    const separatorIndex = segment.indexOf(":");
    if (separatorIndex < 1) return null;

    const label = segment.slice(0, separatorIndex).trim();
    const value = segment.slice(separatorIndex + 1).trim();
    if (!label || !value || Object.hasOwn(values, label)) return null;
    values[label] = value;
  }

  return { number: match[1], values };
}

/** Parse only conversational result summaries whose numbered rows share labeled fields. */
export function parseAssistantResultTable(content: string): AssistantResultTable | null {
  const lines = content.split(/\r?\n/);
  if (!lines.some(line => resultSummaryPattern.test(line.trim()))) return null;

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
  if (rows.length < 2 || rows.some((row): row is null => row === null)) return null;

  const parsedRows = rows as AssistantResultTableRow[];
  const headers = [...new Set(parsedRows.flatMap(row => Object.keys(row.values)))];
  if (headers.length < 2) return null;

  return {
    before: lines.slice(0, firstRowIndex).filter(line => line.trim()),
    after: lines.slice(nextLineIndex).filter(line => line.trim()),
    headers,
    rows: parsedRows,
  };
}
