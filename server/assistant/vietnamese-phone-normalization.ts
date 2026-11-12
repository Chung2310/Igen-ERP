import type { AssistantDocumentContent } from "./document-export";

type UploadedTableContext = { title: string; content: unknown };

export type UploadedPhoneNormalization =
  | { document: AssistantDocumentContent; normalizedCount: number }
  | { error: string };

const normalizeText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\u0111/gi, "d")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function phoneHeader(header: string) {
  const normalized = normalizeText(header);
  return /\b(?:sdt|dt|so dien thoai|dien thoai|phone|mobile|telephone|tel)\b/.test(normalized);
}

function nameHeader(header: string) {
  return /^(?:ho ten|ho va ten|ten hoc vien|ho ten hoc vien|ten nguoi hoc|nguoi hoc|hoc vien|full name|fullname|student name|learner name|name)$/.test(normalizeText(header));
}

export function isVietnamesePhoneNormalizationRequest(question: string) {
  const normalized = normalizeText(question);
  const mentionsPhone = /\b(?:sdt|so dien thoai|dien thoai|phone|mobile|telephone)\b/.test(normalized);
  const requestsChange = /\b(?:chuan hoa|chuan|dinh dang|format|thay|sua|doi|cap nhat|normalize|standardize)\b/.test(normalized);
  const mentionsVietnameseFormat = /\b(?:viet nam|viet|vn|vietnamese)\b/.test(normalized);
  return mentionsPhone && requestsChange && mentionsVietnameseFormat;
}

function standardVietnameseMobile(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("0084") && digits.length === 13) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  else if (/^[35789]\d{8}$/.test(digits)) digits = `0${digits}`;

  return /^0[35789]\d{8}$/.test(digits) ? digits : null;
}

export function normalizeUploadedVietnamesePhones(context: UploadedTableContext): UploadedPhoneNormalization {
  const table = context.content as { type?: unknown; headers?: unknown; rows?: unknown } | null;
  if (table?.type !== "uploaded-table" || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
    return { error: "Mình chưa đọc được bảng dữ liệu đính kèm. Hãy tải lại tệp CSV hoặc Excel rồi thử lại nhé." };
  }

  const headers = table.headers.filter((header): header is string => typeof header === "string");
  const phoneHeaders = headers.filter(phoneHeader);
  if (phoneHeaders.length !== 1) {
    return { error: phoneHeaders.length
      ? `Mình thấy nhiều cột có thể là số điện thoại (${phoneHeaders.join(", ")}). Hãy giữ lại một cột số điện thoại hoặc nói rõ cột cần chuẩn hóa rồi gửi lại tệp.`
      : `Mình chưa nhận diện được cột số điện thoại trong tệp. Tên cột hiện có: ${headers.join(", ") || "không có"}. Hãy kiểm tra tiêu đề cột rồi gửi lại tệp nhé.` };
  }

  const phoneColumn = phoneHeaders[0];
  const identityColumn = headers.find(nameHeader);
  const invalidRows: string[] = [];
  let normalizedCount = 0;
  const rows = table.rows.map((source, index) => {
    const row = source && typeof source === "object" && !Array.isArray(source)
      ? source as Record<string, unknown>
      : {};
    const original = String(row[phoneColumn] ?? "");
    const normalized = standardVietnameseMobile(original);
    const identity = identityColumn ? String(row[identityColumn] ?? "").trim() : "";
    const who = identity ? ` · ${identity.slice(0, 120)}` : "";

    if (!normalized) {
      invalidRows.push(`Mục ${index + 1}${who} · ${phoneColumn}: ${original.trim() ? `“${original.trim().slice(0, 80)}” không thể chuẩn hóa an toàn` : "đang để trống"}.`);
      return headers.map(header => String(row[header] ?? ""));
    }

    normalizedCount++;
    return headers.map(header => header === phoneColumn ? normalized : String(row[header] ?? ""));
  });

  if (invalidRows.length) {
    const visible = invalidRows.slice(0, 20);
    const remaining = invalidRows.length > visible.length ? `\nCòn ${invalidRows.length - visible.length} dòng cần kiểm tra.` : "";
    return { error: `Mình chưa xuất tệp vì không thể tự đoán số điện thoại còn thiếu hoặc sai định dạng. Hãy gửi số đúng cho các dòng này:\n${visible.join("\n")}${remaining}` };
  }

  const title = context.title.replace(/\.[^.]+$/, "").trim() || "Danh sách học viên";
  const sheetName = title.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31).trim() || "Danh sách";
  return {
    normalizedCount,
    document: {
      title,
      sections: [],
      sheets: [{ name: sheetName, columns: headers, rows }],
    },
  };
}
