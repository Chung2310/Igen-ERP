import type { AuthenticatedRequest } from "../middleware/auth";
import type { AssistantField, AssistantTableAttachment, AssistantValue } from "../../src/shared/assistant-workflow";
import type { AssistantOperation } from "./catalog";
import type { AssistantRecord } from "./executor";
import { HEALTHCARE_OPERATIONS } from "./healthcare-catalog";
import { AssistantError } from "./policy";
import { appointmentInput, careInput, catalogInput, patientInput, visitInput } from "../modules/healthcare/validation";
import * as XLSX from "xlsx";
import { healthcareValue } from "./healthcare-result";

type Values = Record<string, AssistantValue>;
type Row = Record<string, any>;
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const objectId = /^[a-f\d]{24}$/i;
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
const operation = (id: string) => HEALTHCARE_OPERATIONS.find(op => op.id === id)!;
const bodyFields = (op: AssistantOperation) => op.fields.filter(f => f.source === "body");
const rowsOf = (result: any): Row[] => Array.isArray(result) ? result : Array.isArray(result?.items) ? result.items : result?._id ? [result] : [];
export class HealthcareUncertainExecutionError extends Error {}

function selectedBranch(req: AuthenticatedRequest, values: Values) {
  if (!req.user?.id || !req.user.companyCode || req.user.companyCode === "SYSTEM") throw new AssistantError("Cần tài khoản doanh nghiệp để dùng workflow y tế.", 403);
  const assigned = req.user.branchId || "";
  const requested = String(values.targetBranch || assigned);
  if (!objectId.test(requested)) throw new AssistantError("Chọn chi nhánh y tế theo tên trước khi tiếp tục.");
  if (req.user.role !== "admin" && requested !== assigned) throw new AssistantError("Bạn chỉ được thao tác tại chi nhánh đã được gán.", 403);
  return requested;
}

async function request(req: AuthenticatedRequest, branchId: string, path: string, method: string, body?: unknown, binary = false): Promise<any> {
  if (!req.socket.localPort) throw new AssistantError("Không xác định được máy chủ nghiệp vụ.", 503);
  const host = req.socket.localAddress === "::1" ? "[::1]" : "127.0.0.1";
  const url = new URL(`/api/v1${path}`, `http://${host}:${req.socket.localPort}`);
  const multipart = body instanceof FormData;
  const headers = { Authorization: req.headers.authorization || "", "x-branch-id": branchId,
    ...(multipart ? {} : { "Content-Type": "application/json" }) };
  let response: Response;
  const mutation = method !== "GET" && !path.includes("/search") && !path.endsWith("/bulk-delete-preview");
  try {
    response = await fetch(url, { method, headers, body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  } catch {
    if (mutation) throw new HealthcareUncertainExecutionError("Chưa xác định được kết quả thao tác y tế. Kiểm tra hồ sơ hoặc tiến độ nhập trước khi thử lại.");
    throw new AssistantError("Không kết nối được dữ liệu y tế. Vui lòng thử lại.", 503);
  }
  let result: any;
  try { result = binary && response.ok ? Buffer.from(await response.arrayBuffer()) : await response.json(); }
  catch {
    if (mutation && response.ok) throw new HealthcareUncertainExecutionError("Máy chủ đã nhận thao tác y tế nhưng chưa đọc được kết quả. Kiểm tra hồ sơ trước khi thử lại.");
    throw new AssistantError("Không đọc được phản hồi dữ liệu y tế.", 502);
  }
  if (!response.ok) {
    if (path.endsWith("/patients/bulk-delete") && response.status >= 500) throw new HealthcareUncertainExecutionError("Chưa xác định được kết quả xóa hồ sơ y tế. Kiểm tra lại danh sách bệnh nhân và dữ liệu liên quan trước khi thử lại.");
    throw new AssistantError(String(result?.message || result?.error?.message || "Không thể thực hiện thao tác y tế.").slice(0, 1000), response.status);
  }
  return result;
}

function pathFor(op: AssistantOperation, values: Values) {
  return op.path.replace(/:([A-Za-z]+)/g, (_, key: string) => {
    const field = op.fields.find(f => f.source === "path" && f.apiKey === key);
    const value = String(field ? values[field.key] || "" : "");
    if (key === "id" ? !uuid.test(value) : !field?.options?.includes(value)) throw new AssistantError("Chọn đúng hồ sơ hoặc loại dữ liệu y tế cần xử lý.");
    return encodeURIComponent(value);
  });
}

const schemaByEntity = { patient: patientInput, visit: visitInput, appointment: appointmentInput, care: careInput, catalog: catalogInput };
const bulkPatientAction = (op: AssistantOperation) => ["healthcare.patient.bulk-delete", "healthcare.patient.bulk-delete-preview"].includes(op.id);
const deletionSnapshotKey = "__assistantHealthcareDeletionSnapshot";
function patientSelections(value: unknown): string[] {
  let selected: unknown;
  try { selected = typeof value === "string" ? JSON.parse(value) : value; } catch { /* validated below */ }
  if (!Array.isArray(selected) || selected.length < 1 || selected.length > 500 || selected.some(item => typeof item !== "string" || !item.trim())) {
    throw new AssistantError("Chọn từ 1 đến 500 bệnh nhân theo tên, mã hoặc số điện thoại.");
  }
  return selected.map(item => item.trim());
}
function deletionSnapshot(items: Row[]) {
  return JSON.stringify(items.map(row => ({ id: row._id, code: row.code, name: row.name, phone: row.phone,
    visits: row.visits, appointments: row.appointments, care: row.care })).sort((a, b) => String(a.id).localeCompare(String(b.id))));
}
async function deletionPreview(req: AuthenticatedRequest, values: Values, ids: string[]) {
  const preview = await request(req, selectedBranch(req, values), "/healthcare/patients/bulk-delete-preview", "POST", { ids });
  const rows: Row[] = preview?.items;
  if (!Array.isArray(rows) || rows.length !== ids.length || new Set(rows.map(row => row._id)).size !== ids.length
    || rows.some(row => !ids.includes(row._id) || [row.visits, row.appointments, row.care].some(count => !Number.isSafeInteger(count) || count < 0))) {
    throw new AssistantError("Chưa kiểm tra được đầy đủ hồ sơ và dữ liệu liên quan; chưa thực hiện xóa.", 409);
  }
  return rows;
}
function assertDeletionUnchanged(values: Values, rows: Row[]) {
  if (values[deletionSnapshotKey] !== deletionSnapshot(rows)) throw new AssistantError("Hồ sơ hoặc dữ liệu liên quan đã thay đổi. Gửi lại yêu cầu để xem lại dữ liệu sẽ xóa và xác nhận lại.", 409);
}
async function currentRecord(req: AuthenticatedRequest, op: AssistantOperation, values: Values): Promise<Row> {
  const entity = op.id.split(".")[1];
  const id = String(values.path_id || "");
  const list = operation(`healthcare.${entity}.list`);
  const response = entity === "patient"
    ? await request(req, selectedBranch(req, values), `/healthcare/patients/${id}`, "GET")
    : await callHealthcareOperation(req, list, { targetBranch: values.targetBranch, ...(entity === "catalog" ? {} : { id, pageSize: 100 }) });
  const row = rowsOf(response).find(row => row._id === id);
  if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new AssistantError("Không đọc được hồ sơ và phiên bản hiện tại; chưa cập nhật.", 409);
  return row;
}

export async function callHealthcareOperation(req: AuthenticatedRequest, op: AssistantOperation, values: Values): Promise<any> {
  const branchId = selectedBranch(req, values);
  const path = pathFor(op, values);
  const body: Row = {};
  for (const f of bodyFields(op)) if (values[f.key] !== undefined) body[f.apiKey || f.key] = values[f.key];
  if (bulkPatientAction(op)) {
    const ids = patientSelections(values.patientIds);
    if (ids.some(id => !uuid.test(id)) || new Set(ids).size !== ids.length) throw new AssistantError("Chọn đúng các hồ sơ bệnh nhân khác nhau trước khi tiếp tục.");
    if (op.id === "healthcare.patient.bulk-delete") {
      if (!values[deletionSnapshotKey]) throw new AssistantError("Cần xem trước hồ sơ và dữ liệu liên quan rồi xác nhận trước khi xóa.", 409);
      assertDeletionUnchanged(values, await deletionPreview(req, values, ids));
    }
    return request(req, branchId, path, "POST", { ids });
  }
  if (op.readOnly && op.method === "POST") {
    // Only search fields go into the body; patient identifiers never enter URLs or logs.
    if (values.id && op.id !== "healthcare.patient.list") body.id = values.id;
    if (op.id === "healthcare.patient.list" && values.__assistantPatientSelection) body.mode = "selection";
    return request(req, branchId, path, "POST", body);
  }
  if (op.id === "healthcare.import.template") {
    const bytes = await request(req, branchId, path, "GET", undefined, true);
    return { filename: values.path_kind === "patients" ? "mau-benh-nhan.xlsx" : "mau-luot-kham.xlsx", __assistantWorkbook: bytes };
  }
  if (op.id === "healthcare.import.preview") {
    let rows: unknown;
    try { rows = JSON.parse(String(values.rows || "")); } catch { /* handled below */ }
    if (!Array.isArray(rows) || !rows.length || rows.length > 100 || rows.some(r => !r || typeof r !== "object" || Array.isArray(r))) throw new AssistantError("Đính kèm bảng Excel có từ 1 đến 100 dòng để kiểm tra.");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Dữ liệu");
    const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    if (bytes.length > 4 * 1024 * 1024) throw new AssistantError("Tệp Excel vượt quá 4 MB.");
    const form = new FormData();
    const filename = String(values.filename || "du-lieu-y-te.xlsx").replace(/[^\p{L}\p{N} ._-]/gu, "_").replace(/(?:\.xlsx)?$/i, ".xlsx");
    form.append("file", new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
    return request(req, branchId, path, "POST", form);
  }
  if (op.method === "PATCH") {
    const existing = await currentRecord(req, op, values);
    if (!Number.isSafeInteger(values.revision) || values.revision !== existing.revision) throw new AssistantError("Hồ sơ y tế đã thay đổi sau bản xem trước. Gửi lại yêu cầu để kiểm tra và xác nhận phiên bản mới.", 409);
    const entity = op.id.split(".")[1] as keyof typeof schemaByEntity;
    const create = operation(`healthcare.${entity}.create`);
    const merged = Object.fromEntries(bodyFields(create).map(f => [f.apiKey || f.key, existing[f.apiKey || f.key]]));
    if (["visit", "appointment"].includes(entity) && typeof body.doctorName === "string" && body.doctorName.trim() && body.doctorId === undefined) merged.doctorId = "";
    const checked = schemaByEntity[entity].validate({ ...merged, ...body }, { abortEarly: false });
    if (checked.error) throw new AssistantError("Thông tin y tế chưa hợp lệ. Kiểm tra ngày giờ và các trường bắt buộc.");
    return request(req, branchId, path, "PATCH", { ...checked.value, revision: values.revision });
  }
  if (op.method !== "GET") return request(req, branchId, path, op.method, body);
  const query = new URLSearchParams();
  for (const f of op.fields) if (f.source === "query" && f.apiKey !== "branchId" && !op.assistantOnlyFields?.includes(f.key) && values[f.key] !== undefined) query.set(f.apiKey || f.key, String(values[f.key]));
  const result = await request(req, branchId, `${path}${query.size ? `?${query}` : ""}`, "GET");
  if (op.id === "healthcare.catalog.list") return rowsOf(result).filter(row =>
    (!values.kind || row.kind === values.kind) && (values.active === undefined || row.active === values.active)
    && (!values.q || normalize(`${row.code} ${row.name}`).includes(normalize(String(values.q)))));
  return result;
}

export function projectHealthcareRecords(op: AssistantOperation, response: any): AssistantRecord[] {
  const patients = new Map<string, Row>((response?.patientReferences || []).map((p: Row) => [p._id, p]));
  return rowsOf(response).map(row => {
    const patient = patients.get(row.patientId);
    const safe: AssistantRecord = { id: String(row._id || "") };
    for (const key of op.resultFields) if (["string", "number", "boolean"].includes(typeof row[key])) safe[key] = row[key];
    if (patient) { safe.patientName = patient.name; safe.patientCode = patient.code; safe.patientPhone = patient.phone || ""; }
    if (!safe.doctorName && row.report?.doctor) safe.doctorName = row.report.doctor;
    if (row.preview && typeof row.preview === "object") Object.defineProperty(safe, "__assistantImportPreview", { value: row.preview, enumerable: false });
    const label = row.name || row.title || row.filename || patient?.name || row.code || "Hồ sơ y tế";
    const timestamp = row.startsAt || row.visitedOn || row.dueOn || row.createdAt;
    // Reference option values can be saved in pending conversations; preserve their existing date punctuation.
    const timeLabel = timestamp && healthcareValue("date", timestamp).replace(/(\d{2}:\d{2}), (?=\d{2}\/\d{2}\/\d{4})/, "$1 ");
    safe.displayName = [label, row.code || patient?.code, row.phone || patient?.phone, row.kind && healthcareValue("kind", row.kind), timeLabel, row.status && healthcareValue("status", row.status)].filter(Boolean).join(" · ");
    Object.defineProperty(safe, "__assistantHealthcareRecord", { value: row, enumerable: false });
    return safe;
  });
}

export async function lookupHealthcareRecords(req: AuthenticatedRequest, op: AssistantOperation, search: string, extra: Values = {}) {
  const values: Values = { ...extra, targetBranch: extra.targetBranch || req.user?.branchId || "", page: 1, pageSize: 100 };
  let response: any;
  if (uuid.test(search) && op.id === "healthcare.patient.list") {
    response = await request(req, selectedBranch(req, values), `/healthcare/patients/${search}`, "GET");
  } else if (uuid.test(search) && op.id === "healthcare.import.list") {
    response = await request(req, selectedBranch(req, values), `/healthcare/imports/${search}`, "GET");
  } else {
    if (uuid.test(search) && ["healthcare.visit.list", "healthcare.appointment.list", "healthcare.care.list"].includes(op.id)) values.id = search;
    else if (!uuid.test(search) && op.fields.some(f => f.key === "q")) values.q = search.split(" · ")[0];
    response = await callHealthcareOperation(req, op, values);
  }
  let projected = projectHealthcareRecords(op, response);
  if (op.id === "healthcare.patient.list" && /^[+\d ().-]+$/.test(search) && search.replace(/\D/g, "").length >= 6
    && !projected.some(row => String(row.code) === search || patientPhoneMatches(row, search))) {
    const selected = projectHealthcareRecords(op, await callHealthcareOperation(req, op, { ...values, q: search, __assistantPatientSelection: true }));
    projected = [...projected, ...selected.filter(row => !projected.some(candidate => candidate.id === row.id))];
  }
  return projected.filter(row => !search || row.id === search || patientPhoneMatches(row, search) || normalize(String(row.displayName)).includes(normalize(search))
    || op.resultFields.some(k => typeof row[k] === "string" && normalize(String(row[k])).includes(normalize(search))));
}

type Lookup = (req: AuthenticatedRequest, id: string, search?: string, extra?: Values) => Promise<AssistantRecord[]>;
type Matches = (row: Row, search: string) => boolean;
function patientPhoneMatches(row: Row, search: string) {
  const digits = search.replace(/\D/g, "");
  return /^[+\d ().-]+$/.test(search) && digits.length >= 6 && String(row.phone || "").replace(/\D/g, "").endsWith(digits.slice(-10));
}
type ReferenceResolution = {
  values: Values; labels: Record<string, string>; errors: string[];
  confirmationDetails: Record<string, Array<{ label: string; value: string }>>;
  unresolvedReferenceKeys: string[]; unresolvedReferenceErrors: Record<string, string>;
};
async function referenceCandidates(req: AuthenticatedRequest, op: AssistantOperation, field: AssistantField, values: Values, search: string, lookup: Lookup) {
  const context: Values = { targetBranch: values.targetBranch || req.user?.branchId || "", ...field.referenceContext };
  if (field.referenceParentKey && values[field.referenceParentKey]) context[field.referenceParentKey] = values[field.referenceParentKey];
  const candidates = await lookup(req, field.reference!, search, context);
  return candidates.filter(row => {
    const raw = row.__assistantHealthcareRecord as unknown as Row | undefined;
    if (field.referenceParentKey && values[field.referenceParentKey] && raw?.patientId !== values[field.referenceParentKey]) return false;
    if (field.reference === "healthcare.catalog.list") {
      if (context.kind && row.kind !== context.kind) return false;
      if (context.active !== undefined && row.active !== context.active) return false;
    }
    if (op.id === "healthcare.import.commit" && field.key === "path_id" && (raw?.status !== "preview" || raw?.phase !== "check")) return false;
    if (op.id === "healthcare.import.retry" && field.key === "path_id" && (raw?.status !== "failed" || raw?.retryable !== true)) return false;
    return true;
  });
}

export async function resolveHealthcareReferences(req: AuthenticatedRequest, op: AssistantOperation, input: Values, lookup: Lookup, matches: Matches): Promise<ReferenceResolution> {
  const values = { ...input };
  const labels: Record<string, string> = {};
  const unresolvedReferenceErrors: Record<string, string> = {};
  const errors: string[] = [];
  const confirmationDetails: ReferenceResolution["confirmationDetails"] = {};
  const fail = (key: string, message: string) => { errors.push(message); unresolvedReferenceErrors[key] = message; };
  const assigned = req.user?.branchId;
  if (assigned && (!values.targetBranch || values.targetBranch === assigned)) {
    values.targetBranch = assigned; labels.targetBranch = "Chi nhánh của bạn";
  } else if (values.targetBranch) {
    const branches = (await lookup(req, "branch.list", String(values.targetBranch))).filter(row => matches(row, String(values.targetBranch)));
    if (branches.length === 1) { values.targetBranch = String(branches[0].id); labels.targetBranch = String(branches[0].name); }
    else fail("targetBranch", "Chọn đúng một chi nhánh y tế theo tên.");
  }
  if (!values.targetBranch || unresolvedReferenceErrors.targetBranch) return { values, labels, errors, confirmationDetails: {}, unresolvedReferenceKeys: Object.keys(unresolvedReferenceErrors), unresolvedReferenceErrors };
  selectedBranch(req, values);
  const fields = op.fields.filter(f => f.reference && f.key !== "targetBranch").sort((a, b) => Number(b.key === "patientId") - Number(a.key === "patientId"));
  for (const field of fields) {
    if (!values[field.key]) continue;
    if (field.referenceParentKey && (!values[field.referenceParentKey] || unresolvedReferenceErrors[field.referenceParentKey])) {
      fail(field.key, `Chọn đúng bệnh nhân trước khi chọn ${field.label.toLowerCase()}.`); continue;
    }
    const search = String(values[field.key]);
    const candidates = await referenceCandidates(req, op, field, values, search, lookup);
    const exact = candidates.filter(row => row.id === search || row.displayName === search || matches(row, search)
      || (field.reference === "healthcare.patient.list" && patientPhoneMatches(row, search)));
    if (exact.length !== 1) { fail(field.key, `${field.label}: ${exact.length > 1 ? "có nhiều hồ sơ trùng tên, hãy chọn đúng hồ sơ" : "không tìm thấy hồ sơ phù hợp trong chi nhánh đã chọn"}.`); continue; }
    const row = exact[0];
    values[field.key] = String(row.id);
    labels[field.key] = String(row.displayName || row.name || row.code);
    if (op.method === "PATCH" && field.key === "path_id") {
      const record = row.__assistantHealthcareRecord as unknown as Row;
      if (!Number.isSafeInteger(record?.revision) || record.revision < 1) fail(field.key, "Không đọc được phiên bản hồ sơ y tế.");
      else if (values.revision !== undefined && values.revision !== record.revision) throw new AssistantError("Hồ sơ y tế đã thay đổi sau bản xem trước. Gửi lại yêu cầu để kiểm tra và xác nhận lại.", 409);
      else values.revision = record.revision;
    }
  }
  if (values.doctorName && values.doctorId) fail("doctorName", "Chọn bác sĩ trong danh mục hoặc nhập tên bác sĩ ngoài danh mục để xác định đúng thông tin cần lưu.");
  if (bulkPatientAction(op) && values.patientIds !== undefined) {
    const selected = patientSelections(values.patientIds);
    const resolved: string[] = [];
    const patientField: AssistantField = { key: "patientIds", label: "Bệnh nhân", type: "reference", reference: "healthcare.patient.list" };
    for (const [index, search] of selected.entries()) {
      const candidates = await referenceCandidates(req, op, patientField, values, search, lookup);
      const exact = candidates.filter(row => row.id === search || row.displayName === search || matches(row, search) || patientPhoneMatches(row, search));
      if (exact.length !== 1) { fail(`patientIds[${index + 1}]`, `Bệnh nhân ${index + 1}: ${exact.length > 1 ? "có nhiều hồ sơ trùng khớp, hãy chọn đúng bệnh nhân" : "không tìm thấy trong chi nhánh đã chọn"}.`); continue; }
      resolved.push(String(exact[0].id));
    }
    if (!errors.length && new Set(resolved).size !== resolved.length) fail("patientIds", "Danh sách có hồ sơ bệnh nhân bị chọn lặp lại. Bạn kiểm tra lại danh sách nhé.");
    if (!errors.length) {
      values.patientIds = JSON.stringify(resolved);
      labels.patientIds = `${resolved.length} bệnh nhân đã chọn`;
      if (op.id === "healthcare.patient.bulk-delete") {
        const rows = await deletionPreview(req, values, resolved);
        if (values[deletionSnapshotKey]) assertDeletionUnchanged(values, rows);
        values[deletionSnapshotKey] = deletionSnapshot(rows);
        confirmationDetails.patientIds = rows.map((row, index) => ({ label: `Bệnh nhân ${index + 1}`, value:
          `${row.code} · ${row.name}${row.phone ? ` · ${row.phone}` : ""} · ${row.visits} lượt khám · ${row.appointments} lịch hẹn · ${row.care} việc chăm sóc` }));
      }
    }
  }
  return { values, labels, errors, confirmationDetails, unresolvedReferenceKeys: Object.keys(unresolvedReferenceErrors), unresolvedReferenceErrors };
}

export async function suggestHealthcareReferences(req: AuthenticatedRequest, op: AssistantOperation, field: AssistantField, input: Values, lookup: Lookup, matches: Matches) {
  if (field.key === "targetBranch") return (await lookup(req, "branch.list")).map(row => String(row.name || row.code)).slice(0, 8);
  const values = { ...input };
  if (!values.targetBranch && req.user?.branchId) values.targetBranch = req.user.branchId;
  if (!objectId.test(String(values.targetBranch || ""))) return [];
  if (field.referenceParentKey && !uuid.test(String(values[field.referenceParentKey] || ""))) {
    const parent = op.fields.find(f => f.key === field.referenceParentKey);
    if (!parent || !values[parent.key]) return [];
    const candidates = (await lookup(req, parent.reference!, String(values[parent.key]), { targetBranch: values.targetBranch })).filter(row => matches(row, String(values[parent.key])));
    if (candidates.length !== 1) return [];
    values[parent.key] = String(candidates[0].id);
  }
  return (await referenceCandidates(req, op, field, values, "", lookup)).slice(0, 8).map(row => String(row.displayName || row.name || row.code));
}

export function healthcareAttachment(file: AssistantTableAttachment) {
  if (!file.rows.length || file.rows.length > 100) throw new AssistantError("Nhập Excel y tế qua chat hỗ trợ từ 1 đến 100 dòng; tệp lớn hơn dùng màn hình Nhập Excel.");
  return { fieldKey: "rows", rows: file.rows, rowCount: file.rows.length };
}

export async function decorateHealthcareResult(req: AuthenticatedRequest, op: AssistantOperation, result: any, values: Values) {
  // Aggregate summaries and report documents are not collections of identified records.
  if (["healthcare.overview", "healthcare.visit.report", "healthcare.patient.bulk-delete"].includes(op.id)) return result;
  const rows = projectHealthcareRecords(op, result);
  const raw = rowsOf(result);
  const clinical = ["visit", "appointment", "care"].includes(op.id.split(".")[1]);
  if (clinical && raw.length) {
    if (!op.readOnly && raw.length === 1 && uuid.test(String(raw[0].patientId || ""))) try {
      const patient = await request(req, selectedBranch(req, values), `/healthcare/patients/${raw[0].patientId}`, "GET");
      rows[0].patientName = patient.name; rows[0].patientCode = patient.code; rows[0].patientPhone = patient.phone || "";
    } catch { /* A successful clinical write remains successful if an optional name lookup fails. */ }
    // Name enrichment must not turn a successful write into an apparent failure.
    try {
      const catalog: Row[] = await callHealthcareOperation(req, operation("healthcare.catalog.list"), { targetBranch: values.targetBranch });
      const names = new Map(catalog.map(row => [row._id, row.name]));
      rows.forEach((row, i) => { for (const kind of ["doctor", "room", "service"]) if (names.has(raw[i][`${kind}Id`])) row[`${kind}Name`] = names.get(raw[i][`${kind}Id`]); });
    } catch { /* Return the successfully read or written clinical record. */ }
    if (op.id.startsWith("healthcare.care.")) try {
      const staff: Row[] = await callHealthcareOperation(req, operation("healthcare.staff.list"), { targetBranch: values.targetBranch });
      const names = new Map(staff.map(row => [row._id, row.name]));
      rows.forEach((row, i) => { if (names.has(raw[i].assigneeId)) row.assigneeName = names.get(raw[i].assigneeId); });
    } catch { /* Staff labels are optional. */ }
  }
  return { items: rows, ...(typeof result.total === "number" ? { total: result.total } : {}) };
}
