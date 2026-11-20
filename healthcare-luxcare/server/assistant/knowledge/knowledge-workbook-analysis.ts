import type { KnowledgeSheet, KnowledgeSheetCell } from "../../../shared/knowledge-extraction";

export function isWorkbookCalculationQuestion(question: string): boolean {
  return /\b(tong|dem|bao nhieu|so luong|thong ke|tinh|trung binh|lon nhat|nho nhat|cao nhat|thap nhat|so sanh|loc|liet ke|phan tram|ty le|chenh lech|sum|count|average)\b/.test(
    question
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase(),
  );
}

export interface WorkbookCalculation {
  sheetId: string;
  headerRow: number;
  operation: "sum" | "count" | "average" | "min" | "max" | "list";
  column?: number;
  groupBy?: number;
  filters: Array<{
    column: number;
    operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
    value: string | number | boolean;
  }>;
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .trim();
const format = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 20 });
const cellValue = (cell: KnowledgeSheetCell | undefined) => {
  if (cell?.type === "e" || cell?.formula)
    throw new Error(
      "Có ô lỗi hoặc công thức trong phạm vi tính. Hãy xuất bản chỉ chứa giá trị đã được kiểm tra trước khi tính toán.",
    );
  if (
    typeof cell?.value === "number" &&
    (!Number.isFinite(cell.value) || (Number.isInteger(cell.value) && !Number.isSafeInteger(cell.value)))
  )
    throw new Error("Giá trị số vượt giới hạn chính xác; chưa thể tính an toàn.");
  return cell?.value ?? null;
};

// Sum decimal values without accumulating binary floating point error (0.1 + 0.2).
function decimalSum(values: number[]): number {
  const parts = values.map((value) => {
    const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
    const scale = (mantissa.split(".")[1]?.length || 0) - Number(exponent);
    return { digits: BigInt(mantissa.replace(".", "")), scale };
  });
  const scale = parts.reduce((max, part) => Math.max(max, part.scale), 0);
  const total = parts.reduce((sum, part) => sum + part.digits * 10n ** BigInt(scale - part.scale), 0n);
  const result = Number(`${total}e-${scale}`);
  if (!Number.isFinite(result) || (Number.isInteger(result) && !Number.isSafeInteger(result)))
    throw new Error("Kết quả vượt giới hạn số hỗ trợ.");
  return result;
}

export function validateWorkbookCalculation(value: unknown): WorkbookCalculation {
  const plan = value as WorkbookCalculation;
  if (
    !plan ||
    typeof plan.sheetId !== "string" ||
    !Number.isInteger(plan.headerRow) ||
    plan.headerRow < 1 ||
    !["sum", "count", "average", "min", "max", "list"].includes(plan.operation) ||
    !Array.isArray(plan.filters) ||
    plan.filters.length > 8 ||
    (plan.column !== undefined && (!Number.isInteger(plan.column) || plan.column < 0)) ||
    (plan.groupBy !== undefined && (!Number.isInteger(plan.groupBy) || plan.groupBy < 0)) ||
    (!["count", "list"].includes(plan.operation) && plan.column === undefined) ||
    (plan.operation === "list" && plan.groupBy !== undefined) ||
    plan.filters.some(
      (filter) =>
        !filter ||
        !Number.isInteger(filter.column) ||
        filter.column < 0 ||
        !["eq", "neq", "gt", "gte", "lt", "lte", "contains"].includes(filter.operator) ||
        !["string", "number", "boolean"].includes(typeof filter.value) ||
        (typeof filter.value === "number" && !Number.isFinite(filter.value)),
    )
  ) {
    throw new Error("Chưa xác định được phép tính an toàn. Hãy nêu rõ sheet, cột và điều kiện lọc.");
  }
  return plan;
}

export function calculateWorkbookSheet(sheet: KnowledgeSheet, value: unknown) {
  const plan = validateWorkbookCalculation(value);
  const header = sheet.rows.find((row) => row.number === plan.headerRow);
  if (!header) throw new Error("Không tìm thấy hàng tiêu đề đã chọn.");
  const columns = header.cells.map((cell) => cell.text.trim());
  const used = [
    ...plan.filters.map((filter) => filter.column),
    ...(plan.column === undefined ? [] : [plan.column]),
    ...(plan.groupBy === undefined ? [] : [plan.groupBy]),
  ];
  if (
    used.some(
      (index) =>
        !columns[index] ||
        header.cells[index].type !== "s" ||
        columns.filter((name) => normalize(name) === normalize(columns[index])).length !== 1,
    )
  )
    throw new Error("Tiêu đề cột trống, trùng hoặc không rõ. Hãy chuẩn hóa hàng tiêu đề trước khi tính.");
  if (!columns.some(Boolean) || sheet.mergedRanges.length)
    throw new Error("Sheet có ô gộp hoặc thiếu tiêu đề. Hãy xuất bảng phẳng với một hàng tiêu đề.");
  const rows = sheet.rows.filter((row) => row.number > plan.headerRow);
  const filtered = rows.filter((row) =>
    plan.filters.every((filter) => {
      if (row.cells[filter.column]?.type === "d")
        throw new Error("Chưa hỗ trợ lọc cột ngày trong bảng tính; hãy tạo cột kỳ/tháng dạng văn bản rõ ràng.");
      const actual = cellValue(row.cells[filter.column]);
      if (actual === null) return false;
      if (["gt", "gte", "lt", "lte"].includes(filter.operator)) {
        if (typeof actual !== "number" || typeof filter.value !== "number")
          throw new Error(`Cột ${columns[filter.column]} không phải số thuần; chưa thể so sánh lớn/nhỏ.`);
        return filter.operator === "gt"
          ? actual > filter.value
          : filter.operator === "gte"
            ? actual >= filter.value
            : filter.operator === "lt"
              ? actual < filter.value
              : actual <= filter.value;
      }
      if (filter.operator === "contains") {
        if (typeof filter.value !== "string" || typeof actual !== "string")
          throw new Error("Điều kiện chứa chỉ áp dụng cho cột văn bản.");
        return normalize(actual).includes(normalize(filter.value));
      }
      const equal =
        typeof actual === "string" && typeof filter.value === "string"
          ? normalize(actual) === normalize(filter.value)
          : actual === filter.value;
      return filter.operator === "eq" ? equal : !equal;
    }),
  );
  if (
    filtered.some((row) =>
      row.cells
        .slice(0, 3)
        .some((cell) => /^(tong|tong cong|cong|subtotal|total|grand total)(\s|:|$)/.test(normalize(cell.text))),
    )
  )
    throw new Error("Phạm vi có dòng tổng/tổng phụ; hãy lọc rõ các dòng dữ liệu để tránh tính trùng.");
  if (
    filtered.some((row) => row.cells.every((cell, index) => normalize(cell.text) === normalize(columns[index] || "")))
  )
    throw new Error("Bảng chứa tiêu đề lặp lại; cần chuẩn hóa trước khi tính.");
  const operatorLabels = { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", contains: "chứa" };
  const scope = `Sheet “${sheet.name}”, tiêu đề dòng ${plan.headerRow}, dữ liệu dòng ${rows[0]?.number ?? "—"}–${rows.at(-1)?.number ?? "—"} (bao gồm dòng ẩn); ${plan.filters.length ? plan.filters.map((filter) => `${columns[filter.column]} ${operatorLabels[filter.operator]} ${String(filter.value)}`).join(" và ") : "không lọc"}`;
  if (plan.operation === "list") {
    if (filtered.length > 100)
      throw new Error(`Có ${filtered.length} dòng phù hợp. Hãy thêm điều kiện lọc để hiển thị tối đa 100 dòng.`);
    const lines = filtered.map(
      (row) =>
        `Dòng ${row.number}: ${row.cells
          .map((cell, index) => {
            cellValue(cell);
            return `${columns[index] || `Cột ${index + 1}`}: ${cell.text}`;
          })
          .join("; ")}`,
    );
    return { reply: `${scope}.\n${filtered.length} dòng phù hợp.\n${lines.join("\n")}`, matchedRows: filtered.length };
  }
  const groups = new Map<string, typeof filtered>();
  for (const row of filtered) {
    const group = plan.groupBy === undefined ? "" : String(cellValue(row.cells[plan.groupBy]) ?? "(trống)");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(row);
  }
  if (plan.groupBy === undefined && !groups.size) groups.set("", []);
  if (groups.size > 100) throw new Error("Có hơn 100 nhóm; hãy thu hẹp điều kiện lọc.");
  const lines = [...groups].map(([group, matching]) => {
    let result: number;
    let note = "";
    if (plan.operation === "count") result = matching.length;
    else {
      const values = matching
        .map((row) => cellValue(row.cells[plan.column!]))
        .filter((item) => item !== null && item !== "");
      if (!values.length) return `${group ? `${group}: ` : ""}Không có giá trị số để tính.`;
      if (values.some((item) => typeof item !== "number" || !Number.isFinite(item)))
        throw new Error(
          `Cột ${columns[plan.column!]} chứa giá trị không phải số. Không tự đoán dấu phân cách hoặc đơn vị.`,
        );
      const numbers = values as number[];
      result =
        plan.operation === "min"
          ? numbers.reduce((a, b) => Math.min(a, b))
          : plan.operation === "max"
            ? numbers.reduce((a, b) => Math.max(a, b))
            : decimalSum(numbers) / (plan.operation === "average" ? numbers.length : 1);
      note = ` (${values.length} ô số; bỏ qua ${matching.length - values.length} ô trống)`;
    }
    const labels = { sum: "Tổng", count: "Số dòng", average: "Trung bình", min: "Nhỏ nhất", max: "Lớn nhất" };
    return `${group ? `${columns[plan.groupBy!]} = ${group}: ` : ""}${labels[plan.operation as keyof typeof labels]}${plan.operation === "count" ? "" : ` cột “${columns[plan.column!]}”`}: ${format(result)}${note}.`;
  });
  return { reply: `${scope}.\n${filtered.length} dòng phù hợp.\n${lines.join("\n")}`, matchedRows: filtered.length };
}
