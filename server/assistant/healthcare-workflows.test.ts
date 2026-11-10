import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
vi.mock("./workflows", async () => {
  const { operationById } = await import("./catalog");
  return { assertOperation: vi.fn((_req, id: string) => operationById(id)), actorScope: () => ({ userId: "actor", companyCode: "TEST" }) };
});
import { ASSISTANT_OPERATIONS, defaultWorkflow } from "./catalog";
import { collectValues } from "./policy";
import { callOperation, lookupRecords, resolveReferences, suggestReferenceOptions, UncertainExecutionError } from "./executor";
import { healthcareAttachment } from "./healthcare-executor";
import { formatHealthcareResult, healthcareValue } from "./healthcare-result";
import { appointmentInput, patientInput, versioned } from "../modules/healthcare/validation";
import { parseAssistantResultTable } from "../../src/components/common/assistant-message-format";

const branch = "507f1f77bcf86cd799439012";
const otherBranch = "507f1f77bcf86cd799439013";
const patientId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb17";
const appointmentId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb18";
const visitId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb19";
const doctorId = "27ee9bae-54ef-43bf-b4ef-d96c53d3fb20";
const patient = { _id: patientId, revision: 3, code: "BN-001", name: "Nguyễn An", phone: "0901234567", dateOfBirth: "1990-01-01", address: "Địa chỉ hiện tại", note: "Ghi chú hiện tại" };
const req = { user: { id: "actor", companyCode: "TEST", role: "admin", branchId: branch }, headers: { authorization: "Bearer scoped", host: "attacker.invalid" }, socket: { localPort: 4050, localAddress: "127.0.0.1" } } as any;
const op = (id: string) => ASSISTANT_OPERATIONS.find(o => o.id === `healthcare.${id}`)!;
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());

it("registers every healthcare business workflow with branch scope and confirmation on mutations", () => {
  const workflows = ASSISTANT_OPERATIONS.filter(o => o.module === "healthcare");
  expect(workflows).toHaveLength(28);
  for (const operation of workflows) {
    expect(operation.permissionGroups).toContainEqual(["healthcare:read"]);
    expect(operation.fields[0]).toMatchObject({ key: "targetBranch", systemRequired: true, reference: "branch.list" });
    expect(defaultWorkflow(operation).confirmationLocked).toBe(!operation.readOnly);
    expect(defaultWorkflow(operation).instructions).toContain("không yêu cầu mã nội bộ");
  }
  expect(op("patient.update").fields.some(f => f.key === "code" || f.key === "revision")).toBe(false);
  expect(op("appointment.update").fields.some(f => f.key === "patientId" || f.key === "visitId")).toBe(false);
});

it("keeps patient search terms in POST bodies and uses only the authenticated branch header", async () => {
  const fetcher = vi.fn(async () => response({ items: [patient], total: 1 }));
  vi.stubGlobal("fetch", fetcher);
  await callOperation(req, op("patient.list"), { targetBranch: branch, q: "Nguyễn An", page: 2, pageSize: 25 });
  const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.origin).toBe("http://127.0.0.1:4050");
  expect(url.pathname).toBe("/api/v1/healthcare/patients/search");
  expect(url.search).toBe("");
  expect(init.headers).toMatchObject({ Authorization: "Bearer scoped", "x-branch-id": branch });
  expect(JSON.parse(String(init.body))).toEqual({ q: "Nguyễn An", page: 2, pageSize: 25 });
});

it("continues resolving previously saved reference labels after localizing preview times", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ items: [{ ...patient, createdAt: "2026-11-11T00:00:00.000Z" }], total: 1 })));
  const previousLabel = "Nguyễn An · BN-001 · 0901234567 · 07:00 11/11/2026";
  const selected = await resolveReferences(req, op("appointment.create"), { targetBranch: branch, patientId: previousLabel });
  expect(selected.errors).toEqual([]);
  expect(selected.values.patientId).toBe(patientId);
  expect(selected.labels.patientId).toBe(previousLabel);
});

it("blocks missing branches, non-admin branch changes and invalid UUIDs before dispatch", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(callOperation({ ...req, user: { ...req.user, branchId: "" } }, op("patient.list"), {})).rejects.toThrow("Chọn chi nhánh");
  await expect(callOperation({ ...req, user: { ...req.user, role: "member" } }, op("patient.list"), { targetBranch: otherBranch })).rejects.toThrow("chi nhánh đã được gán");
  await expect(callOperation(req, op("patient.detail"), { path_id: "../../admin" })).rejects.toThrow("Chọn đúng hồ sơ");
  expect(fetcher).not.toHaveBeenCalled();
});

it("asks for required appointment dates instead of inventing an end time", () => {
  const result = collectValues(defaultWorkflow(op("appointment.create")), { targetBranch: branch, patientId: "BN-001", startsAt: "2026-11-10T09:00:00+07:00" });
  expect(result.missing).toContain("Thời gian kết thúc");
});

it("pins the patient revision during selection and preserves every unchanged input on update", async () => {
  const writes: any[] = [];
  const fetcher = vi.fn(async (_url: URL, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      expect(versioned(patientInput).validate(body).error).toBeUndefined();
      writes.push(body); return response({ ...patient, ...body, revision: 4 });
    }
    return response(patient);
  });
  vi.stubGlobal("fetch", fetcher);
  const checked = await resolveReferences(req, op("patient.update"), { targetBranch: branch, path_id: patientId, phone: "0912345678" });
  expect(checked.errors).toEqual([]);
  expect(checked.values.revision).toBe(3);
  await callOperation(req, op("patient.update"), checked.values);
  expect(writes[0]).toEqual({ code: patient.code, name: patient.name, phone: "0912345678", dateOfBirth: patient.dateOfBirth, address: patient.address, note: patient.note, revision: 3 });
});

it("rejects a changed revision after confirmation without issuing a PATCH", async () => {
  const fetcher = vi.fn(async () => response({ ...patient, revision: 4 })); vi.stubGlobal("fetch", fetcher);
  await expect(resolveReferences(req, op("patient.update"), { targetBranch: branch, path_id: patientId, revision: 3, phone: "0912345678" })).rejects.toThrow("đã thay đổi");
  await expect(callOperation(req, op("patient.update"), { targetBranch: branch, path_id: patientId, revision: 3, phone: "0912345678" })).rejects.toThrow("đã thay đổi");
  expect(fetcher.mock.calls.every((call: any) => call[1].method !== "PATCH")).toBe(true);
});

it("rechecks selected UUIDs beyond the first page using exact patient detail", async () => {
  const fetcher = vi.fn(async () => response(patient)); vi.stubGlobal("fetch", fetcher);
  const records = await lookupRecords(req, "healthcare.patient.list", patientId, { targetBranch: branch });
  expect(records[0].id).toBe(patientId);
  expect(new URL(String((fetcher.mock.calls[0] as any)[0])).pathname).toBe(`/api/v1/healthcare/patients/${patientId}`);
  expect(JSON.stringify(records)).not.toContain("revision");
});

it("disambiguates same-name patients instead of silently picking one", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response({ items: [patient, { ...patient, _id: appointmentId, code: "BN-002" }], total: 2 })));
  const result = await resolveReferences(req, op("appointment.create"), { targetBranch: branch, patientId: "Nguyễn An" });
  expect(result.unresolvedReferenceKeys).toContain("patientId");
  expect(result.errors.join(" ")).toContain("trùng tên");
  const options = await suggestReferenceOptions(req, op("appointment.create"), op("appointment.create").fields.find(f => f.key === "patientId")!, { targetBranch: branch });
  expect(options[0]).toContain("BN-001"); expect(options[1]).toContain("BN-002");
});

it("offers only active doctors for a doctor field, excluding rooms and inactive doctors", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => response([
    { _id: doctorId, kind: "doctor", name: "Bác sĩ Lan", code: "BS-LAN", active: true },
    { _id: visitId, kind: "room", name: "Phòng Lan", code: "P-LAN", active: true },
    { _id: appointmentId, kind: "doctor", name: "Bác sĩ nghỉ", code: "BS-OFF", active: false },
  ])));
  const options = await suggestReferenceOptions(req, op("appointment.create"), op("appointment.create").fields.find(f => f.key === "doctorId")!, { targetBranch: branch });
  expect(options).toHaveLength(1); expect(options[0]).toContain("Bác sĩ Lan");
  const selected = await resolveReferences(req, op("appointment.create"), { targetBranch: branch, doctorId: "Bác sĩ Lan" });
  expect(selected.values.doctorId).toBe(doctorId);
  const rechecked = await resolveReferences(req, op("appointment.create"), selected.values);
  expect(rechecked.errors).toEqual([]);
  expect(rechecked.values.doctorId).toBe(doctorId);
});

it("constrains linked appointments to the selected patient", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.pathname.endsWith(`/patients/${patientId}`) ? response(patient) : response({
    items: [{ _id: appointmentId, patientId: visitId, startsAt: "2026-11-10T02:00:00Z", status: "scheduled" }], patientReferences: [], total: 1,
  })));
  const result = await resolveReferences(req, op("care.create"), { targetBranch: branch, patientId, appointmentId });
  expect(result.unresolvedReferenceKeys).toContain("appointmentId");
});

it("preserves a linked visit when rescheduling and sends a schema-valid complete appointment", async () => {
  const existing = { _id: appointmentId, revision: 2, patientId, visitId, doctorId: "", roomId: "", startsAt: "2026-11-10T02:00:00Z", endsAt: "2026-11-10T02:30:00Z", status: "scheduled", note: "Ghi chú lịch" };
  const fetcher = vi.fn(async (_url: URL, init?: RequestInit) => init?.method === "PATCH" ? response({ ...existing, ...JSON.parse(String(init.body)) }) : response({ items: [existing] }));
  vi.stubGlobal("fetch", fetcher);
  await callOperation(req, op("appointment.update"), { targetBranch: branch, path_id: appointmentId, revision: 2, startsAt: "2026-11-10T10:00:00+07:00", endsAt: "2026-11-10T10:30:00+07:00" });
  const body = JSON.parse(String((fetcher.mock.calls.at(-1) as any)[1].body));
  expect(body).toMatchObject({ patientId, visitId, revision: 2, note: "Ghi chú lịch", status: "scheduled" });
  expect(versioned(appointmentInput).validate(body).error).toBeUndefined();
});

it("uploads an attached table as multipart Excel through the existing preview API", async () => {
  const file = { fileName: "benh-nhan.xlsx", headers: ["ma_benh_nhan", "ho_ten"], rows: [{ ma_benh_nhan: "BN-001", ho_ten: "Nguyễn An" }] };
  const mapped = healthcareAttachment(file);
  const fetcher = vi.fn(async () => response({ status: "queued", filename: file.fileName }, 202)); vi.stubGlobal("fetch", fetcher);
  await callOperation(req, op("import.preview"), { targetBranch: branch, path_kind: "patients", filename: file.fileName, rows: JSON.stringify(mapped.rows) });
  const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.pathname).toBe("/api/v1/healthcare/imports/preview/patients");
  expect(init.headers).not.toHaveProperty("Content-Type");
  const blob = (init.body as FormData).get("file") as File;
  const book = XLSX.read(await blob.arrayBuffer(), { type: "array" });
  expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]])).toEqual(file.rows);
});

it("rejects excessive import rows and never exposes technical metadata in results", () => {
  expect(() => healthcareAttachment({ fileName: "large.xlsx", headers: ["a"], rows: Array.from({ length: 101 }, () => ({ a: "b" })) })).toThrow("100 dòng");
  const text = formatHealthcareResult(op("appointment.list"), { items: [{ _id: appointmentId, revision: 99, patientName: "Nguyễn An", status: "confirmed", startsAt: "2026-11-10T02:00:00Z" }], total: 1 });
  expect(text).toContain("Đã xác nhận"); expect(text).toContain("09:00");
  expect(text).not.toContain(appointmentId); expect(text).not.toContain("revision");
});

it("localizes healthcare times in tables and report fields while preserving date-like business text", () => {
  const iso = "2026-11-11T07:00:00+07:00";
  const text = formatHealthcareResult(op("appointment.list"), { items: [{ patientName: "Nguyễn An", startsAt: iso, endsAt: "2026-11-11T00:30:00Z" }], total: 1 });
  expect(parseAssistantResultTable(text)?.rows[0].values).toMatchObject({ "Bắt đầu": "07:00, 11/11/2026", "Kết thúc": "07:30, 11/11/2026" });
  const report = formatHealthcareResult(op("visit.report"), { fields: { ngay_gio_kham: iso, ngay_sinh: "1992-03-15", ma_phieu: "2026-11-11" } });
  expect(report).toContain("07:00, 11/11/2026");
  expect(report).toContain("15/03/1992");
  expect(report).toContain("2026-11-11");
  expect(report).not.toContain(iso);
  expect(healthcareValue("note", iso)).toBe(iso);
  expect(healthcareValue("code", "2026-11-11")).toBe("2026-11-11");
});

it("formats created patients and lookups as existing chat tables, including empty optional columns", () => {
  for (const action of ["patient.create", "patient.update", "patient.detail", "patient.list"]) {
    const text = formatHealthcareResult(op(action), { items: [{ ...patient, phone: "", dateOfBirth: "", address: "", note: "" }], total: 1 });
    const table = parseAssistantResultTable(text);
    expect(table?.headers).toEqual(["Mã bệnh nhân", "Họ tên bệnh nhân", "Số điện thoại", "Ngày sinh", "Địa chỉ", "Ghi chú"]);
    expect(table?.rows[0].values).toMatchObject({ "Mã bệnh nhân": "BN-001", "Họ tên bệnh nhân": "Nguyễn An", "Số điện thoại": "—" });
    expect(text).not.toContain(patientId); expect(text).not.toContain("revision");
  }
});

it("keeps multiline clinical notes inside one cell and preserves table detection for paginated results", () => {
  const text = formatHealthcareResult(op("patient.list"), { items: [{ ...patient, note: "Đã gọi\n1. Nội dung riêng · Ghi chú: cần liên hệ" }], total: 26 });
  const table = parseAssistantResultTable(text);
  expect(table?.rows).toHaveLength(1);
  expect(table?.headers).toHaveLength(6);
  expect(table?.rows[0].values["Ghi chú"]).toBe("Đã gọi; 1. Nội dung riêng • Ghi chú: cần liên hệ");
  expect(table?.after.join(" ")).toContain("1 trong 26 kết quả");
});

it("treats an ambiguous write timeout as uncertain and preserves API conflict messages", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket reset"); }));
  await expect(callOperation(req, op("patient.create"), { targetBranch: branch, code: "BN-001", name: "An" })).rejects.toBeInstanceOf(UncertainExecutionError);
  vi.stubGlobal("fetch", vi.fn(async () => response({ message: "Bệnh nhân, bác sĩ hoặc phòng đã có lịch trong khoảng giờ này." }, 409)));
  await expect(callOperation(req, op("appointment.create"), { targetBranch: branch })).rejects.toThrow("đã có lịch");
});
