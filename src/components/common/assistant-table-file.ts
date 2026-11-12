import type { AssistantTableAttachment } from "../../shared/assistant-workflow";

const maxFileBytes = 1_000_000;
const maxPayloadCharacters = 500_000;
const maxRows = 100;
const maxColumns = 40;
const maxCellLength = 2_000;

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiterCount = (delimiter: string) => {
    let quoted = false;
    let count = 0;
    for (let index = 0; index < firstLine.length; index++) {
      if (firstLine[index] === '"' && firstLine[index + 1] === '"' && quoted) index++;
      else if (firstLine[index] === '"') quoted = !quoted;
      else if (!quoted && firstLine[index] === delimiter) count++;
    }
    return count;
  };
  const delimiter = delimiterCount(";") > delimiterCount(",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => {
    pushCell();
    if (row.some(value => value.trim())) rows.push(row);
    row = [];
  };
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && character === delimiter) pushCell();
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      pushRow();
    } else cell += character;
  }
  if (quoted) throw new Error("Có ô văn bản chưa đóng dấu ngoặc kép trong tệp CSV.");
  if (cell.length || row.length) pushRow();
  return rows;
}

export async function readAssistantTableFile(file: File): Promise<AssistantTableAttachment> {
  if (!/\.(?:csv|xlsx|xls)$/i.test(file.name)) throw new Error("Chọn tệp CSV, XLSX hoặc XLS giúp mình nhé.");
  if (file.size > maxFileBytes) throw new Error("Tệp cần nhỏ hơn 1 MB để tải lên an toàn.");

  let matrix: unknown[][];
  if (/\.csv$/i.test(file.name)) matrix = parseCsv(await file.text());
  else {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet) throw new Error("Mình chưa thấy trang tính nào trong tệp.");
    const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: true });
    const formattedMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false, raw: false });
    matrix = rawMatrix.map((row, rowIndex) => row.map((value, columnIndex) => value instanceof Date
      ? value
      : formattedMatrix[rowIndex]?.[columnIndex] ?? value));
  }
  let headerRow = matrix.findIndex(row => row.some(value => String(value ?? "").trim()));
  if (headerRow < 0) throw new Error("Tệp đang trống. Dòng đầu tiên cần có tên các cột.");
  const countNonBlankCells = (row: unknown[] | undefined) => (row || []).filter(value => String(value ?? "").trim()).length;
  if (countNonBlankCells(matrix[headerRow]) <= 1) {
    const candidateOffset = matrix.slice(headerRow + 1, headerRow + 6).findIndex(row => countNonBlankCells(row) >= 2);
    if (candidateOffset >= 0) headerRow += candidateOffset + 1;
  }
  const headers = (matrix[headerRow] || []).map(value => String(value ?? "").trim());
  while (headers.length && !headers.at(-1)) headers.pop();
  if (!headers.length) throw new Error("Dòng đầu tiên cần có tên các cột.");
  if (headers.length > maxColumns) throw new Error(`Mình chỉ nhận tối đa ${maxColumns} cột trong một lần.`);
  if (headers.some(header => header.length > 120)) throw new Error("Tên cột không được dài quá 120 ký tự.");
  const nonBlankHeaders = headers.filter(Boolean);
  if (nonBlankHeaders.length !== headers.length) throw new Error("Có cột chưa đặt tên. Bạn bổ sung tên ở dòng đầu tiên rồi tải lại nhé.");

  const rows: Array<Record<string, string>> = [];
  for (const sourceRow of matrix.slice(headerRow + 1)) {
    const row = sourceRow.slice(0, headers.length).map(value => value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value ?? "").trim());
    if (!row.some(Boolean)) continue;
    if (row.some(value => value.length > maxCellLength)) throw new Error(`Mỗi ô dữ liệu chỉ được dài tối đa ${maxCellLength} ký tự.`);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
    if (rows.length > maxRows) throw new Error(`Mình chỉ nhận tối đa ${maxRows} dòng dữ liệu trong một lần.`);
  }
  if (!rows.length) throw new Error("Tệp có tiêu đề nhưng chưa có dòng dữ liệu.");
  const attachment = { fileName: file.name, headers, rows } satisfies AssistantTableAttachment;
  if (JSON.stringify(attachment).length > maxPayloadCharacters) throw new Error("Dữ liệu sau khi đọc vượt giới hạn 500 KB. Bạn rút gọn tệp rồi thử lại nhé.");
  return attachment;
}
