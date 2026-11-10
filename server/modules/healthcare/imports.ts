import { randomUUID } from "node:crypto";
import { Binary, MongoBulkWriteError, type Collection, type Db, type Filter } from "mongodb";
import PizZip from "pizzip";
import XLSX from "xlsx";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../../errors/app-error";
import { hospitalReportColumns, maxHospitalReportRows, type HealthcareList, type HealthcareRecord, type HospitalReportFields, type ImportJob, type ImportKind, type ImportRowResult, type ImportRowStatus, type Patient, type RecordInput, type Visit } from "../../../shared/healthcare";
import { listRecords, newRecord, records, scopeFilter, textMatches, type HealthcareActor, type HealthcareScope, type Stored } from "./store";
import { hospitalVisitInput, input, patientInput, visitInput } from "./validation";

const MAX_ROWS = 1000;
const MAX_EXPANDED_BYTES = 24 * 1024 * 1024;
const patientHeaders = ["ma_benh_nhan", "ho_ten", "so_dien_thoai", "ngay_sinh", "dia_chi", "ghi_chu"];
const visitHeaders = ["ma_luot_kham", "ma_benh_nhan", "ngay_kham", "ma_bac_si", "ma_phong", "ma_dich_vu", "trang_thai", "ghi_chu_thanh_toan", "ghi_chu"];
type PatientRow = { row: number; kind: "patients"; value: RecordInput<Patient> };
type VisitRow = { row: number; kind: "visits"; value: RecordInput<Visit> };
type HospitalRow = { row: number; sheet: string; kind: "hospital-report"; patient: RecordInput<Patient>; visit: Omit<RecordInput<Visit>, "patientId"> };
type ImportRow = PatientRow | VisitRow | HospitalRow;
type Batch = HealthcareScope & {
  _id: string;
  actorId: string;
  kind: ImportKind;
  filename: string;
  total: number;
  invalid: number;
  status?: ImportJob["status"] | "expiring";
  phase?: ImportJob["phase"];
  ready?: number;
  duplicates?: number;
  patientsReady?: number;
  processed?: number;
  createdAt?: string;
  queuedAt?: Date;
  leaseUntil?: Date;
  claimToken?: string;
  attempts?: number;
  previewUntil?: Date;
  retryUntil?: Date;
  error?: string;
  file?: Binary;
  rows?: ImportRow[];
  expiresAt?: Date;
  inserted?: number;
  patientsInserted?: number;
  skipped?: number;
  completedAt?: string;
};
type PreparedRow = Omit<ImportRowResult, "index"> & { input?: ImportRow };
type StagedRow = ImportRowResult & { batchId: string; input?: ImportRow };
const batches = (db: Db) => db.collection<Batch>("healthcare_imports");
const staged = (db: Db) => db.collection<StagedRow>("healthcare_import_rows");
const formatError = (message: string) => new ValidationError("VALIDATION_FAILED", message);

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("vi").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const aliases: Record<string, string> = {
  ma_bn: "ma_benh_nhan", ten_benh_nhan: "ho_ten", ho_va_ten: "ho_ten", sdt: "so_dien_thoai",
  dien_thoai: "so_dien_thoai", ma_phieu_kham: "ma_luot_kham", ngay_luot_kham: "ngay_kham",
};

function excelDate(value: unknown, date1904: boolean) {
  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!decoded) return "invalid";
    return [decoded.y, String(decoded.m).padStart(2, "0"), String(decoded.d).padStart(2, "0")].join("-");
  }
  const text = String(value ?? "").trim();
  const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  return parts ? `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}` : text;
}

export function importTemplate(kind: Exclude<ImportKind, "hospital-report">) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([kind === "patients" ? patientHeaders : visitHeaders]), "Du lieu");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function openWorkbook(bytes: Buffer, multiSheet = false) {
  try {
    const archive = new PizZip(bytes);
    const entries = Object.values(archive.files);
    const expanded = entries.reduce((size, entry) => size + ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0), 0);
    if (entries.length > 200 || expanded > MAX_EXPANDED_BYTES || !archive.file("xl/workbook.xml")) {
      throw formatError("File Excel không hợp lệ hoặc vượt dung lượng giải nén cho phép.");
    }
    return XLSX.read(bytes, {
      type: "buffer", ...(multiSheet ? {} : { sheets: 0 }),
      sheetRows: multiSheet ? maxHospitalReportRows + 22 : MAX_ROWS + 2, cellFormula: false,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw formatError("Không đọc được file Excel. Vui lòng dùng file .xlsx theo mẫu.");
  }
}

function readWorkbook(bytes: Buffer, kind: Exclude<ImportKind, "hospital-report">) {
  const book = openWorkbook(bytes);
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet?.["!ref"]) throw formatError("File Excel chưa có dữ liệu.");
  const bounds = XLSX.utils.decode_range(sheet["!ref"]);
  if (bounds.e.c >= 50 || bounds.e.r > MAX_ROWS) throw formatError("File Excel hỗ trợ tối đa 1.000 dòng dữ liệu và 50 cột.");
  const [header = [], ...values] = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1, raw: true, defval: "", blankrows: true, range: { ...bounds, s: { r: 0, c: 0 } },
  });
  const columns = header.map(value => { const key = normalize(value); return aliases[key] || key; });
  const expected = kind === "patients" ? patientHeaders : visitHeaders;
  const required = kind === "patients" ? ["ma_benh_nhan", "ho_ten"] : ["ma_luot_kham", "ma_benh_nhan", "ngay_kham"];
  if (required.some(key => !columns.includes(key)) || expected.some(key => columns.filter(column => column === key).length > 1)) {
    throw formatError(`Kiểm tra tiêu đề dòng đầu. Cột bắt buộc gồm ${required.join(", ")}. Mỗi cột chỉ xuất hiện một lần.`);
  }
  const rows = values.map((cells, index) => ({
    row: index + 2,
    fields: Object.fromEntries(columns.flatMap((column, col) => expected.includes(column) ? [[column, cells[col] ?? ""]] : [])),
  })).filter(row => Object.values(row.fields).some(value => String(value).trim()));
  if (!rows.length) throw formatError("File Excel chưa có dòng dữ liệu.");
  return { rows, date1904: Boolean(book.Workbook?.WBProps?.date1904) };
}

const reportKeys = Object.keys(hospitalReportColumns) as (keyof HospitalReportFields)[];
const requiredReportKeys = ["ngay_gio_kham", "ma_phieu", "ten_benh_nhan", "ma_benh_nhan"];

function readHospitalReport(bytes: Buffer) {
  const book = openWorkbook(bytes, true);
  const date1904 = Boolean(book.Workbook?.WBProps?.date1904);
  const rows: { sheet: string; row: number; fields: HospitalReportFields; visitDate: unknown; birthDate: unknown; followUpDate: unknown }[] = [];
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const bounds = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
    if (bounds.e.c >= 50 || bounds.e.r >= maxHospitalReportRows + 20) throw formatError("Báo cáo hỗ trợ tối đa 10.000 dòng dữ liệu và 50 cột.");
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1, raw: true, defval: "", blankrows: true, range: { ...bounds, s: { r: 0, c: 0 } },
    });
    const headerIndex = values.slice(0, 20).findIndex(row => {
      const columns = row.map(normalize);
      return requiredReportKeys.every(key => columns.includes(key));
    });
    if (headerIndex < 0) throw formatError(`Không tìm thấy dòng tiêu đề báo cáo phiếu khám trong sheet ${sheetName}.`);
    const headers = values[headerIndex].map(normalize);
    if (reportKeys.some(key => headers.indexOf(key) !== headers.lastIndexOf(key))) {
      throw formatError(`Sheet ${sheetName} có cột báo cáo trùng tên.`);
    }
    const columns = Object.fromEntries(reportKeys.map(key => [key, headers.indexOf(key)])) as Record<keyof HospitalReportFields, number>;
    for (const [index, cells] of values.slice(headerIndex + 1).entries()) {
      if (normalize(cells[columns.stt]) === "tong" || !cells.some(cell => String(cell).trim())) continue;
      const fields = Object.fromEntries(reportKeys.map(key => [key, String(cells[columns[key]] ?? "").trim()])) as HospitalReportFields;
      rows.push({
        sheet: sheetName,
        row: headerIndex + index + 2,
        fields,
        visitDate: cells[columns.ngay_gio_kham],
        birthDate: cells[columns.ngay_sinh],
        followUpDate: cells[columns.ngay_hen_tai_kham],
      });
      if (rows.length > maxHospitalReportRows) throw formatError("Báo cáo hỗ trợ tối đa 10.000 dòng dữ liệu trong một file.");
    }
  }
  if (!rows.length) throw formatError("Báo cáo chưa có dòng phiếu khám.");
  return { rows, date1904 };
}

function hospitalVisitDate(value: unknown, date1904: boolean) {
  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value, { date1904 });
    const day = excelDate(value, date1904);
    const time = decoded ? [decoded.H, decoded.M, decoded.S].map(part => String(part).padStart(2, "0")).join(":") : "";
    return { day, local: time ? `${day}T${time}` : day };
  }
  const parts = /^(\S+)[ T]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(value ?? "").trim());
  const day = excelDate(parts ? parts[1] : value, date1904);
  return { day, local: parts ? `${day}T${parts[2]}:${parts[3]}:${parts[4] || "00"}` : day };
}

function hospitalRow(row: ReturnType<typeof readHospitalReport>["rows"][number], date1904: boolean): HospitalRow {
  const { fields } = row;
  const rawBirthDate = row.birthDate;
  const numericBirthYear = typeof rawBirthDate === "number" && Number.isInteger(rawBirthDate)
    && rawBirthDate >= 1900 && rawBirthDate <= new Date().getFullYear()
    ? String(rawBirthDate)
    : undefined;
  const birthYear = numericBirthYear || (/^\d{4}$/.test(fields.ngay_sinh) ? fields.ngay_sinh : undefined);
  const normalizedBirthDate = birthYear ? "" : excelDate(rawBirthDate, date1904);
  const followUpOn = excelDate(row.followUpDate, date1904);
  const phone = fields.so_dien_thoai.split("/").map(part => part.trim()).find(part => /^\+?\d[\d ().-]{0,38}$/.test(part)) || "";
  const patient = input(patientInput, {
    code: fields.ma_benh_nhan, name: fields.ten_benh_nhan.normalize("NFC"), phone, address: fields.dia_chi,
    dateOfBirth: normalizedBirthDate,
  });
  const date = hospitalVisitDate(row.visitDate, date1904);
  const visit = input(hospitalVisitInput, {
    code: fields.ma_phieu, visitedOn: date.day,
    status: "imported", paymentNote: fields.thanh_toan,
  });
  return {
    row: row.row, sheet: row.sheet, kind: "hospital-report",
    patient: { ...patient, hospitalProfile: { gender: fields.gioi_tinh, birthYear, phoneText: fields.so_dien_thoai } },
    visit: {
      ...visit, doctorName: fields.bac_si.normalize("NFC"), report: {
        visitedAt: date.local.includes("T") ? new Date(date.local + "+07:00").toISOString() : "",
        department: fields.phong_ban.normalize("NFC"), doctor: fields.bac_si.normalize("NFC"),
        service: fields.dich_vu_dieu_tri.normalize("NFC").slice(0, 160), sourceStatus: fields.trang_thai.normalize("NFC"),
        followUpOn,
        fields: {
          ...fields,
          ngay_gio_kham: date.local,
          ngay_sinh: birthYear || normalizedBirthDate,
          ngay_hen_tai_kham: followUpOn,
        },
      },
    },
  };
}

async function prepareHospitalReport(db: Db, actor: HealthcareActor, bytes: Buffer) {
  const { rows, date1904 } = readHospitalReport(bytes);
  const scope = scopeFilter(actor);
  const [patients, visits] = await Promise.all([
    records(db, "patients").distinct("code", { ...scope, code: { $in: rows.map(row => row.fields.ma_benh_nhan.toUpperCase()) } }),
    records(db, "visits").distinct("code", { ...scope, code: { $in: rows.map(row => row.fields.ma_phieu.toUpperCase()) } }),
  ]);
  const existingPatients = new Set(patients);
  const existingVisits = new Set(visits);
  const patientCodes = new Set<string>();
  const seen = new Map<string, HospitalRow>();
  const prepared: PreparedRow[] = [];
  for (const row of rows) {
    try {
      const candidate = hospitalRow(row, date1904);
      const { code, visitedOn } = candidate.visit;
      const previous = seen.get(code);
      if (previous && JSON.stringify(previous.visit) !== JSON.stringify(candidate.visit)) {
        throw formatError("Mã phiếu xuất hiện nhiều lần với dữ liệu khác nhau.");
      }
      const duplicate = existingVisits.has(code) || Boolean(previous);
      if (!previous) seen.set(code, candidate);
      if (!duplicate && !existingPatients.has(candidate.patient.code)) patientCodes.add(candidate.patient.code);
      prepared.push({
        sheet: row.sheet, row: row.row, code, label: `${candidate.patient.code} · ${visitedOn}`,
        status: duplicate ? "skipped" : "ready", preview: candidate.visit.report?.fields,
        ...(duplicate ? {} : { input: candidate }),
      });
    } catch (error) {
      prepared.push(invalidRow(row, row.fields.ma_phieu, error, row.fields));
    }
  }
  return { rows: prepared, patientsReady: patientCodes.size };
}

function invalidRow({ row, sheet }: { row: number; sheet?: string }, code: string, error: unknown, preview?: Record<string, string>): PreparedRow {
  if (!(error instanceof AppError)) throw error;
  const fields = error.details?.fields;
  return { row, sheet, code: code.slice(0, 100), label: "", status: "invalid",
    message: Array.isArray(fields) ? `${error.message} (${fields.join(", ")})` : error.message,
    ...(preview ? { preview } : {}),
  };
}

const statusAliases: Record<string, Visit["status"]> = {
  da_tiep_don: "registered", dang_kham: "in_progress", hoan_tat: "completed", da_huy: "cancelled",
};

async function prepareImport(db: Db, actor: HealthcareActor, kind: ImportKind, bytes: Buffer): Promise<{ rows: PreparedRow[]; patientsReady?: number }> {
  if (kind === "hospital-report") return prepareHospitalReport(db, actor, bytes);
  const { rows, date1904 } = readWorkbook(bytes, kind);
  const scope = scopeFilter(actor);
  const patientCodes = rows.map(row => String(row.fields.ma_benh_nhan).trim().toUpperCase());
  const codes = kind === "patients" ? patientCodes : rows.map(row => String(row.fields.ma_luot_kham).trim().toUpperCase());
  const [patients, visits, catalog] = await Promise.all([
    records(db, "patients").find({ ...scope, code: { $in: patientCodes } }).project<{ _id: string; code: string }>({ code: 1 }).toArray(),
    kind === "visits" ? records(db, "visits").find({ ...scope, code: { $in: codes } }).project<{ code: string }>({ code: 1 }).toArray() : [],
    kind === "visits" ? records(db, "catalog").find({ ...scope, code: { $in: rows.flatMap(row =>
      [row.fields.ma_bac_si, row.fields.ma_phong, row.fields.ma_dich_vu].map(value => String(value ?? "").trim().toUpperCase()),
    ) } }).project<{ _id: string; kind: string; code: string }>({ kind: 1, code: 1 }).toArray() : [],
  ]);
  const patientIds = new Map(patients.map(row => [row.code, row._id] as const));
  const catalogIds = new Map<string, string>(catalog.map(row => [`${row.kind}:${row.code}`, row._id] as const));
  const visitCodes = new Set(visits.map(row => row.code));
  const resolveCatalog = (value: unknown, type: string) => {
    const key = String(value ?? "").trim().toUpperCase();
    if (!key) return "";
    const id = catalogIds.get(`${type}:${key}`);
    if (!id) throw formatError("Mã bác sĩ, phòng hoặc dịch vụ không có trong danh mục chi nhánh.");
    return id;
  };
  const prepared: PreparedRow[] = [];
  const seen = new Map<string, string>();
  for (const { row, fields } of rows) {
    try {
      const patientCode = String(fields.ma_benh_nhan ?? "").trim().toUpperCase();
      let candidate: ImportRow;
      let label: string;
      if (kind === "patients") {
        if (typeof fields.so_dien_thoai === "number") throw formatError("Định dạng số điện thoại là văn bản để giữ số 0 ở đầu.");
        const value = input(patientInput, {
          code: patientCode, name: String(fields.ho_ten ?? ""), phone: String(fields.so_dien_thoai ?? ""),
          dateOfBirth: excelDate(fields.ngay_sinh, date1904), address: String(fields.dia_chi ?? ""), note: String(fields.ghi_chu ?? ""),
        });
        candidate = { row, kind, value };
        label = value.name;
      } else {
        const patientId = patientIds.get(patientCode);
        if (!patientId) throw formatError("Chưa có mã bệnh nhân này ở chi nhánh. Hãy nhập hồ sơ bệnh nhân trước.");
        const status = normalize(fields.trang_thai);
        const value = input(visitInput, {
          code: String(fields.ma_luot_kham ?? ""), patientId, visitedOn: excelDate(fields.ngay_kham, date1904),
          doctorId: resolveCatalog(fields.ma_bac_si, "doctor"), roomId: resolveCatalog(fields.ma_phong, "room"),
          serviceId: resolveCatalog(fields.ma_dich_vu, "service"), status: (statusAliases[status] || status) || "completed",
          paymentNote: String(fields.ghi_chu_thanh_toan ?? ""), note: String(fields.ghi_chu ?? ""),
        });
        candidate = { row, kind, value };
        label = `${patientCode} · ${value.visitedOn}`;
      }
      const { code } = candidate.value;
      const serialized = JSON.stringify(candidate.value);
      const previous = seen.get(code);
      if (previous && previous !== serialized) throw formatError("Mã bị lặp trong file với dữ liệu khác nhau.");
      const duplicate = Boolean(previous) || (kind === "patients" ? patientIds.has(code) : visitCodes.has(code));
      seen.set(code, serialized);
      prepared.push({ row, code, label, status: duplicate ? "skipped" : "ready", ...(duplicate ? {} : { input: candidate }) });
    } catch (error) {
      prepared.push(invalidRow({ row }, String(fields[kind === "patients" ? "ma_benh_nhan" : "ma_luot_kham"] ?? ""), error));
    }
  }
  return { rows: prepared };
}


const CHUNK_SIZE = 250;
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;
const rowProjection = { _id: 0, batchId: 0, input: 0 };
const batchProjection = { file: 0, rows: 0 };

function jobOf(batch: Batch, actorId: string): ImportJob {
  const status = batch.status && batch.status !== "expiring" ? batch.status : batch.completedAt ? "completed" : "preview";
  return {
    _id: batch._id, kind: batch.kind, filename: batch.filename, status, phase: batch.phase || (batch.completedAt ? "write" : "check"),
    total: batch.total, ready: batch.ready ?? batch.inserted ?? 0, invalid: batch.invalid, duplicates: batch.duplicates ?? batch.skipped ?? 0,
    processed: batch.processed ?? (batch.completedAt ? batch.total : 0), patientsReady: batch.patientsReady,
    inserted: batch.inserted, patientsInserted: batch.patientsInserted, skipped: batch.skipped, createdAt: batch.createdAt,
    completedAt: batch.completedAt, error: batch.error,
    retryable: status === "failed" && batch.actorId === actorId && Boolean(batch.retryUntil && batch.retryUntil > new Date()),
  };
}

export async function queueImportFile(db: Db, actor: HealthcareActor, kind: ImportKind, filename: string, bytes: Buffer) {
  const now = new Date();
  const batch: Batch = {
    ...scopeFilter(actor), _id: randomUUID(), actorId: actor.actorId, kind,
    filename: filename.replace(/[\u0000-\u001f]/g, "").split(/[\\/]/).pop()?.slice(0, 160) || "du-lieu.xlsx",
    phase: "check", status: "queued", queuedAt: now, createdAt: now.toISOString(),
    total: 0, invalid: 0, file: new Binary(bytes),
  };
  await batches(db).insertOne(batch);
  return jobOf(batch, actor.actorId);
}

function visibleJobs(actor: HealthcareActor): Filter<Batch> {
  return {
    ...scopeFilter(actor), status: { $ne: "expiring" },
    $or: [{ phase: "write" }, { completedAt: { $exists: true } }, { actorId: actor.actorId, status: { $exists: true } }],
  };
}

async function findVisibleJob(db: Db, actor: HealthcareActor, id: string) {
  const batch = await batches(db).findOne({ ...visibleJobs(actor), _id: id }, { projection: batchProjection });
  if (!batch) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy lượt nhập Excel.");
  return batch;
}

export async function getImportJob(db: Db, actor: HealthcareActor, id: string) {
  return jobOf(await findVisibleJob(db, actor, id), actor.actorId);
}

export async function importHistory(db: Db, actor: HealthcareActor) {
  const history = await batches(db).find(visibleJobs(actor), { projection: batchProjection })
    .sort({ createdAt: -1, completedAt: -1, _id: -1 }).limit(50).toArray();
  return history.map(batch => jobOf(batch, actor.actorId));
}

export async function queueImportCommit(db: Db, actor: HealthcareActor, id: string) {
  const key = { ...scopeFilter(actor), _id: id, actorId: actor.actorId };
  const now = new Date();
  const queued = await batches(db).findOneAndUpdate({
    ...key, invalid: 0, completedAt: { $exists: false },
    $or: [
      { status: "preview", previewUntil: { $gt: now } },
      { status: { $exists: false }, expiresAt: { $gt: now }, rows: { $exists: true } },
    ],
  }, {
    $set: { phase: "write", status: "queued", queuedAt: now, attempts: 0 },
    $unset: { expiresAt: "", previewUntil: "", error: "" },
  }, { returnDocument: "after", projection: batchProjection });
  if (queued) return jobOf(queued, actor.actorId);
  const existing = await batches(db).findOne(key, { projection: batchProjection });
  if (!existing) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy lượt nhập Excel.");
  if (existing.completedAt || existing.phase === "write") return jobOf(existing, actor.actorId);
  throw new ConflictError("CONFLICT", "Lượt xem trước đã hết hạn, chưa kiểm tra xong hoặc còn dòng lỗi.");
}

export async function retryImportJob(db: Db, actor: HealthcareActor, id: string) {
  const batch = await batches(db).findOneAndUpdate({
    ...scopeFilter(actor), _id: id, actorId: actor.actorId, status: "failed", retryUntil: { $gt: new Date() },
  }, {
    $set: { status: "queued", queuedAt: new Date(), attempts: 0 },
    $unset: { retryUntil: "", error: "" },
  }, { returnDocument: "after", projection: batchProjection });
  if (batch) return jobOf(batch, actor.actorId);
  const existing = await findVisibleJob(db, actor, id);
  if (existing.actorId === actor.actorId && (existing.status === "queued" || existing.status === "running")) return jobOf(existing, actor.actorId);
  throw new ConflictError("CONFLICT", "Lượt nhập này không thể thử lại.");
}

export async function listImportRows(
  db: Db, actor: HealthcareActor, id: string, { page, pageSize, q, status }: { page: number; pageSize: number; q: string; status?: ImportRowStatus },
): Promise<HealthcareList<ImportRowResult>> {
  const batch = await findVisibleJob(db, actor, id);
  if (!batch.status && batch.completedAt) {
    if (status && status !== "imported") return { items: [], total: 0, page, pageSize };
    const filter = { "source.batchId": id, ...(q ? { $or: textMatches(q, ["code", "name", "source.sheet"]) } : {}) };
    const sort = { "source.sheet": 1, "source.row": 1, _id: 1 } as const;
    const list = batch.kind === "patients"
      ? await listRecords(records(db, "patients"), actor, filter, sort, page, pageSize)
      : await listRecords(records(db, "visits"), actor, filter, sort, page, pageSize);
    return { ...list, items: list.items.map((item, offset): ImportRowResult => ({
      index: (page - 1) * pageSize + offset, row: item.source?.row ?? 0, sheet: item.source?.sheet,
      code: item.code, label: "name" in item ? item.name : item.visitedOn, status: "imported", recordId: item._id,
    })) };
  }
  if (batch.phase === "check" && batch.status !== "preview") return { items: [], total: 0, page, pageSize };
  const filter = { batchId: id, ...(status ? { status } : {}), ...(q ? { $or: textMatches(q, ["code", "label", "sheet"]) } : {}) };
  const [items, total] = await Promise.all([
    staged(db).find(filter, { projection: rowProjection }).sort({ index: 1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    staged(db).countDocuments(filter),
  ]);
  return { items, total, page, pageSize };
}

type ImportEntry<T extends Patient | Visit> = { value: RecordInput<T>; source: NonNullable<HealthcareRecord["source"]> };

async function upsertImportRecords<T extends Patient | Visit>(
  collection: Collection<Stored<T>>, actor: HealthcareActor, entries: ImportEntry<T>[],
) {
  if (!entries.length) return;
  try {
    await collection.bulkWrite(entries.map(({ value, source }) => ({
      updateOne: {
        filter: { ...scopeFilter(actor), code: value.code } as Filter<Stored<T>>,
        update: { $setOnInsert: newRecord<T>(actor, value, source) },
        upsert: true,
      },
    })), { ordered: false });
  } catch (error) {
    if (!(error instanceof MongoBulkWriteError) || error.result.getWriteConcernError()) throw error;
    const failures = Array.isArray(error.writeErrors) ? error.writeErrors : [error.writeErrors];
    if (!failures.length || failures.some(item => item.code !== 11000)) throw error;
  }
}

async function saveRows(db: Db, batchId: string, rows: PreparedRow[], renew: () => Promise<void>) {
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    await renew();
    await staged(db).bulkWrite(rows.slice(offset, offset + CHUNK_SIZE).map((row, i) => {
      const index = offset + i;
      return { replaceOne: { filter: { batchId, index }, replacement: { ...row, batchId, index }, upsert: true } };
    }), { ordered: false });
  }
}

type WriteSource = Pick<Patient | Visit, "_id" | "code" | "source">;
async function writeImportRows(db: Db, actor: HealthcareActor, id: string, kind: ImportKind, rows: StagedRow[]) {
  const patients = records(db, "patients");
  const visits = records(db, "visits");
  const scope = scopeFilter(actor);
  const patientEntries = new Map<string, ImportEntry<Patient>>();
  const visitEntries: ImportEntry<Visit>[] = [];
  const hospitalRows: HospitalRow[] = [];
  for (const { input: row } of rows) {
    if (!row) throw new Error("IMPORT_ROW_MISSING");
    const source = { batchId: id, row: row.row, ...(row.kind === "hospital-report" ? { sheet: row.sheet } : {}) };
    if (row.kind === "visits") visitEntries.push({ value: row.value, source });
    else {
      const value = row.kind === "patients" ? row.value : row.patient;
      if (!patientEntries.has(value.code)) patientEntries.set(value.code, { value, source });
      if (row.kind === "hospital-report") hospitalRows.push(row);
    }
  }
  await upsertImportRecords(patients, actor, [...patientEntries.values()]);
  const importedPatients = new Map((await patients.find({ ...scope, code: { $in: [...patientEntries.keys()] } })
    .project<WriteSource>({ _id: 1, code: 1, source: 1 }).toArray()).map(patient => [patient.code, patient]));
  for (const row of hospitalRows) {
    const patientId = importedPatients.get(row.patient.code)?._id;
    if (!patientId) throw new Error("IMPORT_PATIENT_NOT_FOUND");
    visitEntries.push({ value: { ...row.visit, patientId }, source: { batchId: id, row: row.row, sheet: row.sheet } });
  }
  await upsertImportRecords(visits, actor, visitEntries);
  const imported = kind === "patients" ? importedPatients : new Map((await visits.find({
    ...scope, code: { $in: visitEntries.map(entry => entry.value.code) },
  }).project<WriteSource>({ _id: 1, code: 1, source: 1 }).toArray()).map(visit => [visit.code, visit]));
  await staged(db).bulkWrite(rows.map(row => {
    const record = imported.get(row.code);
    if (!record) throw new Error("IMPORT_RECORD_NOT_FOUND");
    return {
      updateOne: {
        filter: { batchId: id, index: row.index, status: "ready" as const },
        update: { $set: { recordId: record._id, status: record.source?.batchId === id ? "imported" as const : "skipped" as const }, $unset: { input: "" } },
      },
    };
  }), { ordered: false });
}

export async function processNextImport(db: Db) {
  const now = new Date();
  const claimToken = randomUUID();
  const batch = await batches(db).findOneAndUpdate({
    $or: [{ status: "queued", queuedAt: { $lte: now } }, { status: "running", leaseUntil: { $lte: now } }],
  }, {
    $set: { status: "running", claimToken, leaseUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 },
  }, { sort: { queuedAt: 1, _id: 1 }, returnDocument: "after" });
  if (!batch) return false;

  const key = { _id: batch._id, status: "running" as const, claimToken };
  const renew = async (processed?: number) => {
    const updated = await batches(db).updateOne(key, {
      $set: { leaseUntil: new Date(Date.now() + LEASE_MS), ...(processed === undefined ? {} : { processed }) },
    });
    if (!updated.matchedCount) throw new Error("IMPORT_CLAIM_LOST");
  };
  const actor = { ...scopeFilter(batch), actorId: batch.actorId };
  try {
    if ((batch.attempts || 0) > MAX_ATTEMPTS) throw new Error("IMPORT_RETRIES_EXHAUSTED");
    if (batch.phase === "check") {
      if (!batch.file) throw new Error("IMPORT_FILE_MISSING");
      const prepared = await prepareImport(db, actor, batch.kind, Buffer.from(batch.file.value()));
      await saveRows(db, batch._id, prepared.rows, renew);
      const invalid = prepared.rows.filter(row => row.status === "invalid").length;
      const duplicates = prepared.rows.filter(row => row.status === "skipped").length;
      const total = prepared.rows.length;
      await batches(db).updateOne(key, {
        $set: { status: "preview", total, invalid, duplicates, ready: total - invalid - duplicates,
          ...(prepared.patientsReady === undefined ? {} : { patientsReady: prepared.patientsReady }),
          processed: 0, previewUntil: new Date(Date.now() + 30 * 60_000) },
        $unset: { file: "", leaseUntil: "", claimToken: "", error: "" },
      });
    } else {
      if (batch.rows) {
        const legacyRows: PreparedRow[] = batch.rows.map(row => ({
          row: row.row, sheet: row.kind === "hospital-report" ? row.sheet : undefined,
          code: row.kind === "hospital-report" ? row.visit.code : row.value.code, label: "", status: "ready", input: row,
        }));
        await saveRows(db, batch._id, legacyRows, renew);
        await batches(db).updateOne(key, { $set: { ready: legacyRows.length, duplicates: batch.total - legacyRows.length }, $unset: { rows: "" } });
      }
      let processed = batch.total - await staged(db).countDocuments({ batchId: batch._id, status: "ready" });
      for (;;) {
        await renew(processed);
        const rows = await staged(db).find({ batchId: batch._id, status: "ready" }).sort({ index: 1 }).limit(CHUNK_SIZE).toArray();
        if (!rows.length) break;
        await writeImportRows(db, actor, batch._id, batch.kind, rows);
        processed += rows.length;
      }
      const byBatch = { ...scopeFilter(actor), "source.batchId": batch._id };
      const [patientsInserted, visitsInserted] = await Promise.all([
        batch.kind !== "visits" ? records(db, "patients").countDocuments(byBatch) : 0,
        batch.kind !== "patients" ? records(db, "visits").countDocuments(byBatch) : 0,
      ]);
      const inserted = batch.kind === "patients" ? patientsInserted : visitsInserted;
      await batches(db).updateOne(key, {
        $set: { status: "completed", processed: batch.total, completedAt: new Date().toISOString(), inserted, skipped: batch.total - inserted,
          ...(batch.kind === "hospital-report" ? { patientsInserted } : {}) },
        $unset: { leaseUntil: "", claimToken: "", error: "", retryUntil: "" },
      });
    }
  } catch (error) {
    const invalidFile = error instanceof ValidationError;
    const autoRetry = !invalidFile && (batch.attempts || 0) < MAX_ATTEMPTS;
    const retryUntil = new Date(Date.now() + 24 * 60 * 60_000);
    await batches(db).updateOne(key, {
      $set: autoRetry ? { status: "queued", queuedAt: new Date(Date.now() + 5_000) } : {
        status: "failed", error: invalidFile ? error.message : "Lượt nhập bị gián đoạn. Bạn có thể thử lại trong 24 giờ.",
        ...(invalidFile ? { previewUntil: retryUntil } : { retryUntil }),
      },
      $unset: { claimToken: "", leaseUntil: "", ...(invalidFile ? { file: "" } : {}) },
    });
  }
  return true;
}

export async function cleanupExpiredImports(db: Db) {
  const now = new Date();
  const expired = await batches(db).findOneAndUpdate({
    $or: [{ status: "preview", previewUntil: { $lte: now } },
      { status: "failed", phase: "check", $or: [{ previewUntil: { $lte: now } }, { retryUntil: { $lte: now } }] },
      { status: "expiring" }],
  }, { $set: { status: "expiring" } }, { projection: { _id: 1 } });
  if (expired) {
    await staged(db).deleteMany({ batchId: expired._id });
    await batches(db).deleteOne({ _id: expired._id, status: "expiring" });
  }
  const failed = await batches(db).findOne({ status: "failed", phase: "write", retryUntil: { $lte: now } }, { projection: { _id: 1 } });
  if (failed) {
    await staged(db).updateMany({ batchId: failed._id, status: "ready" },
      { $set: { status: "invalid", message: "Lượt nhập đã hết thời gian thử lại." }, $unset: { input: "" } });
    await batches(db).updateOne({ _id: failed._id, status: "failed" }, { $set: { error: "Lượt nhập đã hết thời gian thử lại. Hãy tải lại file." }, $unset: { retryUntil: "", rows: "" } });
  }
}
