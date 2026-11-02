import type { AssistantDataShape, AssistantTableAttachment } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";

export interface MappedAssistantTable {
  fieldKey: string;
  rows: unknown[];
  rowCount: number;
}

const aliases: Record<string, string[]> = {
  fullName: ["ho ten", "ho va ten", "ten day du", "ten nhan su", "ho ten nhan su", "ten lao dong", "ho ten lao dong", "ten hoc vien", "ho ten hoc vien", "ten nguoi lao dong"],
  displayName: ["ho ten", "ho va ten", "ten day du", "ten nhan su", "ten hien thi", "ten bien the"],
  name: ["ten", "ten doi tac", "ten doi tac gioi thieu", "ten san pham", "ten sku", "ten don vi"],
  phone: ["so dien thoai", "sdt", "dien thoai", "so dt", "phone number", "mobile"],
  email: ["email", "thu dien tu", "email ca nhan"],
  birthday: ["ngay sinh", "sinh ngay"],
  birthDate: ["ngay sinh", "sinh ngay"],
  dateOfBirth: ["ngay sinh", "sinh ngay"],
  idCard: ["cccd", "cmnd", "so cccd", "so cmnd", "ma giay to", "so giay to"],
  address: ["dia chi", "noi o"],
  note: ["ghi chu", "ghi chu them"],
  notes: ["ghi chu", "ghi chu them"],
  monthlySalary: ["luong", "luong thang", "muc luong", "luong co ban"],
  department: ["phong ban", "ten phong ban"],
  division: ["bo phan", "ten bo phan"],
  qualification: ["trinh do", "trinh do chuyen mon", "bang cap"],
  fee: ["hoc phi", "muc hoc phi", "hoc phi du kien"],
  batchCode: ["lop", "ten lop", "ma lop", "khoa hoc", "ten khoa hoc"],
  referral: ["nguoi gioi thieu", "ma gioi thieu", "doi tac gioi thieu"],
  status: ["trang thai"],
  laborType: ["loai lao dong", "hinh thuc lao dong"],
  nationality: ["quoc tich"],
  workPermitNumber: ["so giay phep lao dong", "so giay phep", "so visa"],
  workPermitExpiry: ["han giay phep lao dong", "ngay het han giay phep", "han visa"],
  registrationDate: ["ngay dang ky", "ngay tao ho so"],
  bankName: ["ngan hang", "ten ngan hang"],
  bankAccountNo: ["so tai khoan", "so tai khoan ngan hang"],
  bankAccountName: ["chu tai khoan", "ten chu tai khoan"],
  commissionType: ["loai hoa hong", "hinh thuc hoa hong"],
  commissionValue: ["muc hoa hong", "gia tri hoa hong", "ty le hoa hong"],
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

const normalize = (value: string) => value.toLocaleLowerCase("vi")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

function shapeLabels(shape: AssistantDataShape | undefined): string[] {
  if (!shape) return [];
  return [shape.label || "", ...Object.entries(shape.keys || {}).flatMap(([key, child]) => [key, child.label || ""])];
}

function aliasTarget(header: string, shape: AssistantDataShape): string | undefined {
  const normalized = normalize(header);
  const keys = Object.keys(shape.keys || {});
  const exact = keys.find(key => normalize(key) === normalized)
    || keys.find(key => normalize(shape.keys?.[key]?.label || "") === normalized);
  if (exact) return exact;
  const matches = keys.filter(key => (aliases[key] || []).some(alias => normalize(alias) === normalized));
  return matches.length === 1 ? matches[0] : undefined;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dmy = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const serial = Number(value);
  if (Number.isInteger(serial) && serial >= 20_000 && serial <= 80_000) {
    return new Date(Date.UTC(1899, 11, 30 + serial)).toISOString().slice(0, 10);
  }
  return value;
}

function convertValue(value: string, shape: AssistantDataShape, key: string): unknown {
  if (!value) return undefined;
  if (shape.type === "date") return dateValue(value);
  if (shape.type === "number") return numberValue(value) ?? value;
  if (shape.type === "boolean") {
    const normalized = normalize(value);
    if (["true", "1", "co", "bat", "yes", "active", "hoat dong"].includes(normalized)) return true;
    if (["false", "0", "khong", "tat", "no", "inactive", "nghi"].includes(normalized)) return false;
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
  if (op.method !== "POST") throw new Error("Tệp bảng chỉ dùng được với workflow tạo dữ liệu hàng loạt.");
  const candidates = op.fields.filter(field => field.structure?.type === "array" && field.structure.items);
  if (!candidates.length) throw new Error("Workflow này chưa có trường danh sách để nhập từ tệp. Hãy chọn chức năng tạo hàng loạt phù hợp nhé.");

  const objectCandidates = candidates.flatMap(field => {
    const shape = field.structure!.items!;
    if (shape.type !== "object" || !shape.keys) return [];
    const mappedHeaders = file.headers.map(header => ({ header, key: aliasTarget(header, shape) }));
    const mappedCount = mappedHeaders.filter(item => item.key).length;
    return mappedCount ? [{ field, shape, mappedHeaders, mappedCount }] : [];
  }).sort((a, b) => b.mappedCount - a.mappedCount);

  if (objectCandidates.length) {
    const top = objectCandidates[0];
    const tied = objectCandidates.filter(candidate => candidate.mappedCount === top.mappedCount);
    if (tied.length > 1) throw new Error("Tệp có thể thuộc nhiều danh sách của thao tác này. Hãy nói rõ danh sách nào cần nhập.");
    const duplicates = new Set<string>();
    const mapped = top.mappedHeaders.filter(item => item.key);
    mapped.forEach(item => { if (duplicates.has(item.key!)) throw new Error(`Có nhiều cột cùng khớp với “${top.shape.keys![item.key!]!.label || item.key}”. Gộp các cột đó trước khi tải lên nhé.`); duplicates.add(item.key!); });
    const ignored = top.mappedHeaders.filter(item => !item.key && !["stt", "no", "so thu tu", "dong"].includes(normalize(item.header)));
    if (ignored.length) throw new Error(`Mình chưa nhận diện được cột ${ignored.map(item => `“${item.header}”`).join(", ")}. Đổi tiêu đề cột theo tên trường hoặc bỏ cột này rồi tải lại nhé; dữ liệu chưa được thay đổi.`);
    const rows = file.rows.map(row => Object.fromEntries(mapped.flatMap(({ header, key }) => {
      const value = convertValue(row[header] || "", top.shape.keys![key!]!, key!);
      return value === undefined ? [] : [[key!, value]];
    })));
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
