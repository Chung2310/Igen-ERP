import type { AssistantDataShape, AssistantTableAttachment } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";

export interface MappedAssistantTable {
  fieldKey: string;
  rows: unknown[];
  rowCount: number;
}

const aliases: Record<string, string[]> = {
  fullName: ["ho ten", "ho va ten", "ten day du", "ten nhan su", "ho ten nhan su", "ten lao dong", "ho ten lao dong", "ten hoc vien", "ho ten hoc vien", "ten nguoi lao dong", "ten hoc sinh", "ho ten hoc sinh", "ten"],
  displayName: ["ho ten", "ho va ten", "ten day du", "ten nhan su", "ten hien thi", "ten bien the"],
  name: ["ten", "ten doi tac", "ten doi tac gioi thieu", "ten cong tac vien", "ho va ten", "ho ten", "ten san pham", "ten sku", "ten don vi"],
  phone: ["so dien thoai", "sdt", "dien thoai", "so dt", "phone number", "mobile", "tel", "so dien thoai lien he"],
  email: ["email", "thu dien tu", "email ca nhan", "email hoc vien", "email lao dong", "email doi tac", "dia chi email", "mail"],
  birthday: ["ngay sinh", "sinh ngay", "nam sinh", "dob", "date of birth", "year of birth"],
  birthDate: ["ngay sinh", "sinh ngay", "nam sinh", "dob", "date of birth", "year of birth"],
  dateOfBirth: ["ngay sinh", "sinh ngay", "nam sinh", "dob", "date of birth", "year of birth"],
  idCard: ["cccd", "cmnd", "cccd cmnd", "so cccd", "so cmnd", "so cccd cmnd", "ma giay to", "so giay to", "dinh danh", "so dinh danh", "can cuoc", "can cuoc cong dan", "chung minh nhan dan"],
  rank: ["hang", "hang bang", "cap bac", "hang dao tao", "hang hoc", "phan hang"],
  address: ["dia chi", "noi o", "dia chi thuong tru", "dia chi hien tai", "que quan", "noi cu tru"],
  note: ["ghi chu", "ghi chu them", "mo ta"],
  notes: ["ghi chu", "ghi chu them", "mo ta"],
  monthlySalary: ["luong", "luong thang", "muc luong", "luong co ban"],
  department: ["phong ban", "ten phong ban"],
  division: ["bo phan", "ten bo phan"],
  qualification: ["trinh do", "trinh do chuyen mon", "bang cap"],
  fee: ["hoc phi", "muc hoc phi", "hoc phi du kien", "hoc phi vnd", "tong hoc phi", "tien hoc", "tuition", "course fee", "total fee"],
  batchCode: ["lop", "ten lop", "ma lop", "ma lop hoc", "lop hoc", "lop du an", "ten hoac ma lop", "khoa hoc", "ten khoa hoc", "batch", "class", "class code"],
  referral: ["nguoi gioi thieu", "ma gioi thieu", "doi tac gioi thieu", "nguon gioi thieu", "gioi thieu", "ctv gioi thieu", "cong tac vien"],
  status: ["trang thai", "tinh trang", "trang thai hoc", "trang thai ho so"],
  isActive: ["trang thai", "dang hoat dong", "kich hoat", "hoat dong"],
  laborType: ["loai lao dong", "hinh thuc lao dong", "phan loai lao dong"],
  nationality: ["quoc tich"],
  workPermitNumber: ["so giay phep lao dong", "so giay phep", "so visa", "giay phep lao dong"],
  workPermitExpiry: ["han giay phep lao dong", "ngay het han giay phep", "han visa", "ngay het han visa"],
  registrationDate: ["ngay dang ky", "ngay tao ho so", "ngay tiep nhan", "ngay lap ho so"],
  enrollmentDate: ["ngay nhap hoc", "ngay ghi danh", "ngay vao hoc", "nhap hoc", "ghi danh", "ngay bat dau hoc", "enrollment date"],
  bankName: ["ngan hang", "ten ngan hang"],
  bankAccountNo: ["so tai khoan", "so tai khoan ngan hang", "stk", "tai khoan ngan hang"],
  bankAccountName: ["chu tai khoan", "ten chu tai khoan", "nguoi thu huong"],
  commissionType: ["loai hoa hong", "hinh thuc hoa hong", "cach tinh hoa hong"],
  commissionValue: ["muc hoa hong", "gia tri hoa hong", "ty le hoa hong", "hoa hong"],
  sku: ["ma sku", "sku", "ma san pham"],
  barcode: ["ma vach", "barcode"],
  unitCode: ["don vi", "ma don vi", "don vi tinh"],
  trackingMode: ["theo doi ton kho", "che do theo doi"],
  weightGrams: ["trong luong g", "trong luong gram"],
  lengthMm: ["chieu dai mm", "chieu dai"],
  widthMm: ["chieu rong mm", "chieu rong"],
  heightMm: ["chieu cao mm", "chieu cao"],
  warrantyMonths: ["thoi han bao hanh", "bao hanh thang", "so thang bao hanh"],
  supplierWarrantyMonths: ["bao hanh nha cung cap", "bao hanh nha cung cap thang"],
  initialQuantity: ["so luong ban dau", "so luong ton kho", "so luong"],
  quantity: ["so luong", "so luong ban dau"],
  workerId: ["ten lao dong", "ma lao dong", "so dien thoai lao dong"],
  studentId: ["ten hoc vien", "ma hoc vien", "so dien thoai hoc vien"],
};

const ignoredTableHeaders = new Set([
  "stt", "no", "so thu tu", "dong", "id", "ma", "ma ho so",
  "ma hoc vien", "ma hv", "student code", "ma lao dong", "ma doi tac", "ma ctv",
  "da dong", "da nop", "da thu", "da thanh toan", "paid", "paid amount",
  "con no", "no hoc phi", "con lai", "du no", "chua dong", "debt", "remaining", "remaining balance",
  "gioi tinh", "gender", "sex",
  "ghi chu", "ghi chu them", "note", "notes", "mo ta",
  "chi nhanh", "trung tam", "ma trung tam", "center id", "owner id", "branch", "branch id",
  "khoa hoc", "ten khoa hoc", "ma khoa hoc",
]);

const normalize = (value: string) => value.toLocaleLowerCase("vi")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const normalizeHeaderCandidates = (header: string): string[] => {
  const full = normalize(header);
  const stripped = normalize(header.replace(/\([^)]*\)|\[[^\]]*\]/g, ""));
  return stripped && stripped !== full ? [full, stripped] : [full];
};

function shapeLabels(shape: AssistantDataShape | undefined): string[] {
  if (!shape) return [];
  return [shape.label || "", ...Object.entries(shape.keys || {}).flatMap(([key, child]) => [key, child.label || ""])];
}

function aliasTargetWithScore(header: string, shape: AssistantDataShape): { key: string; score: number } | undefined {
  const candidates = normalizeHeaderCandidates(header);
  const keys = Object.keys(shape.keys || {}).filter(key => key !== "sourceRow");
  for (const normalized of candidates) {
    const exact = keys.find(key => normalize(key) === normalized)
      || keys.find(key => normalize(shape.keys?.[key]?.label || "") === normalized);
    if (exact) return { key: exact, score: 100 };
  }
  for (const normalized of candidates) {
    const matches = keys
      .map(key => {
        const idx = (aliases[key] || []).findIndex(alias => normalize(alias) === normalized);
        return idx >= 0 ? { key, score: 50 - idx } : null;
      })
      .filter((item): item is { key: string; score: number } => Boolean(item));
    if (matches.length === 1) return matches[0];
  }
  return undefined;
}

function aliasTarget(header: string, shape: AssistantDataShape): string | undefined {
  return aliasTargetWithScore(header, shape)?.key;
}

function numberValue(value: string): number | undefined {
  let candidate = value.replace(/\s|₫|vnd/gi, "").replace(/[^\d.,+-]/g, "");
  if (!candidate || !/[\d]/.test(candidate)) return undefined;
  const comma = candidate.lastIndexOf(",");
  const dot = candidate.lastIndexOf(".");
  const decimalIndex = Math.max(comma, dot);
  if (decimalIndex >= 0 && candidate.length - decimalIndex - 1 > 0 && candidate.length - decimalIndex - 1 <= 2) {
    const decimal = candidate[decimalIndex];
    candidate = candidate.slice(0, decimalIndex).replace(/[.,]/g, "") + "." + candidate.slice(decimalIndex + 1).replace(/[.,]/g, "");
  } else candidate = candidate.replace(/[.,]/g, "");
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateValue(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  const dmy = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const ymd = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  const serial = Number(trimmed);
  if (Number.isInteger(serial) && serial >= 20_000 && serial <= 80_000) {
    return new Date(Date.UTC(1899, 11, 30 + serial)).toISOString().slice(0, 10);
  }
  return trimmed;
}

function convertValue(value: string, shape: AssistantDataShape, key: string): unknown {
  if (!value) return undefined;
  if (shape.type === "date") return dateValue(value);
  if (shape.type === "number") return numberValue(value) ?? value;
  if (key === "idCard" && /^[\d\s().-]+$/.test(value)) return value.replace(/\D/g, "");
  if (key === "phone" && /^[\d\s()+.-]+$/.test(value)) {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 9) return `0${digits}`;
    if (digits.length === 10) return digits;
  }
  if (shape.type === "boolean") {
    const normalized = normalize(value);
    if (["true", "1", "co", "bat", "yes", "active", "hoat dong", "dang hoat dong"].includes(normalized)) return true;
    if (["false", "0", "khong", "tat", "no", "inactive", "nghi", "ngung hoat dong"].includes(normalized)) return false;
  }
  if (shape.options?.length) {
    const normalized = normalize(value);
    const optionAliases: Record<string, string[]> = {
      active: ["dang hoat dong", "dang lam viec", "con lam", "hoat dong"],
      inactive: ["nghi viec", "ngung hoat dong", "khong hoat dong"],
      placed: ["da bo tri", "da duoc bo tri"],
      official: ["chinh thuc"],
      seasonal: ["thoi vu"],
      foreign: ["nuoc ngoai", "lao dong nuoc ngoai"],
      percentage: ["phan tram", "ty le"],
      fixed: ["co dinh", "so tien"],
      physical: ["hang hoa", "san pham vat ly"],
      service: ["dich vu"],
      bundle: ["combo", "goi san pham"],
    };
    const option = shape.options.find(candidate => normalize(String(candidate)) === normalized)
      || shape.options.find(candidate => (optionAliases[String(candidate)] || []).includes(normalized));
    if (option !== undefined) return option;
  }
  if ((["phone", "tel"].includes(shape.type) || key === "phone") && /^\d{9}$/.test(value)) return `0${value}`;
  return value;
}

function stringArrayFieldValue(file: AssistantTableAttachment, field: AssistantOperation["fields"][number]): unknown[] {
  const shape = field.structure!;
  const itemShape = shape.items;
  if (!itemShape) throw new Error(`Tệp không khớp danh sách “${field.label}”.`);
  const directLabels = [field.key, field.label, ...shapeLabels(itemShape)].map(normalize).filter(Boolean);
  const possibleHeaders = file.headers.filter(header => directLabels.includes(normalize(header))
    || (aliases[field.key] || []).some(alias => normalize(alias) === normalize(header)));
  const header = possibleHeaders[0] || (file.headers.length === 1 ? file.headers[0] : undefined);
  if (!header || possibleHeaders.length > 1) throw new Error(`Chưa rõ cột nào trong tệp là “${field.label}”. Hãy để danh sách này trong một cột có tiêu đề phù hợp.`);
  return file.rows.map(row => row[header]?.trim()).filter((value): value is string => Boolean(value));
}

export function mapAssistantTableAttachment(op: AssistantOperation, file: AssistantTableAttachment): MappedAssistantTable {
  if (!["POST", "PUT", "PATCH"].includes(op.method)) throw new Error("Tệp bảng chỉ dùng được với workflow tạo hoặc cập nhật dữ liệu hàng loạt.");
  const candidates = op.fields.filter(field => field.structure?.type === "array" && field.structure.items);
  if (!candidates.length) throw new Error("Workflow này chưa có trường danh sách để nhập từ tệp. Hãy chọn chức năng tạo hàng loạt phù hợp nhé.");

  const objectCandidates = candidates.flatMap(field => {
    const shape = field.structure!.items!;
    if (shape.type !== "object" || !shape.keys) return [];
    const mappedHeaders = file.headers.map(header => {
      const match = aliasTargetWithScore(header, shape);
      return { header, key: match?.key, score: match?.score ?? 0 };
    });
    const mappedCount = mappedHeaders.filter(item => item.key).length;
    return mappedCount ? [{ field, shape, mappedHeaders, mappedCount }] : [];
  }).sort((a, b) => b.mappedCount - a.mappedCount);

  if (objectCandidates.length) {
    const top = objectCandidates[0];
    const tied = objectCandidates.filter(candidate => candidate.mappedCount === top.mappedCount);
    if (tied.length > 1) throw new Error("Tệp có thể thuộc nhiều danh sách của thao tác này. Hãy nói rõ danh sách nào cần nhập.");
    const groupedByKey = new Map<string, Array<{ header: string; key: string; score: number }>>();
    for (const item of top.mappedHeaders) {
      if (!item.key) continue;
      const group = groupedByKey.get(item.key) || [];
      group.push({ header: item.header, key: item.key, score: item.score });
      groupedByKey.set(item.key, group);
    }
    for (const [key, group] of groupedByKey) {
      group.sort((a, b) => b.score - a.score);
      if (group.length > 1 && normalize(group[0].header) === normalize(group[1].header)) {
        throw new Error(`Có nhiều cột cùng khớp với “${top.shape.keys![key]!.label || key}”. Gộp các cột đó trước khi tải lên nhé.`);
      }
    }
    const requiredKeys = Object.entries(top.shape.keys || {})
      .filter(([, child]) => child.required)
      .map(([key]) => key);
    const missingRequiredKeys = requiredKeys.filter(key => !groupedByKey.has(key));
    const ignored = top.mappedHeaders.filter(item => !item.key && !normalizeHeaderCandidates(item.header).some(candidate => ignoredTableHeaders.has(candidate)));
    if (ignored.length && (missingRequiredKeys.length > 0 || groupedByKey.size === 0)) {
      throw new Error(`Mình chưa nhận diện được cột ${ignored.map(item => `“${item.header}”`).join(", ")}. Đổi tiêu đề cột theo tên trường hoặc bỏ cột này rồi tải lại nhé; dữ liệu chưa được thay đổi.`);
    }
    const rows = file.rows.map((row, rowIndex) => {
      const mapped = Object.fromEntries([...groupedByKey.entries()].flatMap(([key, group]) => {
        for (const { header } of group) {
          const value = convertValue(row[header] || "", top.shape.keys![key]!, key);
          if (value !== undefined) return [[key, value]];
        }
        return [];
      }));
      if (top.field.key === "students" && top.shape.keys?.sourceRow) mapped.sourceRow = rowIndex + 2;
      return mapped;
    });
    return { fieldKey: top.field.key, rows, rowCount: rows.length };
  }

  const scalarCandidates = candidates.filter(field => field.structure!.items!.type !== "object");
  if (scalarCandidates.length === 1) {
    const field = scalarCandidates[0];
    const rows = stringArrayFieldValue(file, field);
    return { fieldKey: field.key, rows, rowCount: rows.length };
  }
  throw new Error("Mình chưa khớp được tên cột với các trường trong workflow. Hãy kiểm tra tiêu đề cột trong tệp rồi tải lại nhé; dữ liệu chưa được thay đổi.");
}
