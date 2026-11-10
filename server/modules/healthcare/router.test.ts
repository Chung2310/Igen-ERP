import express, { type ErrorRequestHandler } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as XLSX from "xlsx";
import { afterAll, beforeAll, expect, it } from "vitest";
import { hospitalReportColumns, type Appointment, type CareTask, type CatalogItem, type ImportJob, type Patient, type Visit } from "../../../shared/healthcare";
import { requireModule } from "../../middleware/require-module";
import { BranchModel } from "../../model/branch.model";
import { CompanyModel } from "../../model/company.model";
import { RolePermissionModel } from "../../model/role-permission.model";
import { UserModel } from "../../model/user.model";
import { calendarDay } from "./operations";
import { healthcareRouter } from "./router";
import { processNextImport } from "./imports";
import { healthcareDb, newRecord, records } from "./store";

const companyCode = "MEDICAL_QA";
const branch = new mongoose.Types.ObjectId();
const otherBranch = new mongoose.Types.ObjectId();
const offBranch = new mongoose.Types.ObjectId();
const admin = new mongoose.Types.ObjectId();
const viewer = new mongoose.Types.ObjectId();
const off = new mongoose.Types.ObjectId();
const actors = {
  admin: { id: String(admin), companyCode, branchId: String(branch), role: "admin" },
  viewer: { id: String(viewer), companyCode, branchId: String(branch), role: "healthcare-viewer" },
  disabled: { id: String(off), companyCode: "MEDICAL_OFF", branchId: String(offBranch), role: "admin" },
};
let mongo: MongoMemoryServer;
let server: Server;
let origin: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await CompanyModel.collection.insertMany([
    { code: companyCode, name: "Cơ sở QA", enabledModules: ["healthcare"] },
    { code: "MEDICAL_OFF", name: "Cơ sở khác", enabledModules: ["hr"] },
  ]);
  await BranchModel.collection.insertMany([
    { _id: branch, companyCode, code: "MAIN", name: "Cơ sở A", isActive: true },
    { _id: otherBranch, companyCode, code: "B", name: "Cơ sở B", isActive: true },
    { _id: offBranch, companyCode: "MEDICAL_OFF", code: "MAIN", name: "Cơ sở khác", isActive: true },
  ]);
  await UserModel.collection.insertMany([
    { _id: admin, email: "healthcare-admin@example.test", companyCode, role: "admin", branchId: String(branch), displayName: "Nhân viên thử" },
    { _id: viewer, email: "healthcare-viewer@example.test", companyCode, role: "healthcare-viewer", branchId: String(branch), displayName: "Người xem thử" },
  ]);
  await RolePermissionModel.collection.insertOne({ companyCode, role: "healthcare-viewer", permissions: ["healthcare:read"] });
  const app = express();
  app.use(express.json(), (req, _res, next) => {
    Object.assign(req, { user: actors[req.get("x-fixture-actor") as keyof typeof actors] });
    next();
  });
  app.use("/api/v1/healthcare", requireModule("healthcare"), healthcareRouter);
  app.use(((error, _req, res, _next) => {
    res.status(error.status || 500).json({ message: error.message });
  }) as ErrorRequestHandler);
  server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/healthcare`;
}, 60_000);
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo?.stop();
});

function request(path: string, body?: object | FormData, opts: { actor?: keyof typeof actors; branchId?: string; method?: string } = {}) {
  const headers = new Headers({ "x-fixture-actor": opts.actor || "admin" });
  if (opts.branchId) headers.set("x-branch-id", opts.branchId);
  if (body && !(body instanceof FormData)) headers.set("Content-Type", "application/json");
  return fetch(origin + path, {
    headers, method: opts.method || (body ? "POST" : "GET"),
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}
async function created<T>(path: string, body: object): Promise<T> {
  const res = await request(path, body);
  const result = await res.json();
  expect(res.status, result.message).toBe(201);
  return result;
}
function sheet(rows: string[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Du lieu");
  return workbookForm(book);
}
function workbookForm(book: XLSX.WorkBook, filename = "qa.xlsx") {
  const form = new FormData();
  form.append("file", new Blob([XLSX.write(book, { type: "buffer", bookType: "xlsx" })]), filename);
  return form;
}

async function readJob(id: string) {
  return (await (await request(`/imports/${id}`)).json()) as ImportJob;
}
async function prepare(kind: string, form: FormData) {
  const response = await request(`/imports/preview/${kind}`, form);
  expect(response.status).toBe(202);
  const queued = await response.json() as ImportJob;
  expect(queued).toMatchObject({ phase: "check", status: "queued" });
  expect(await processNextImport(await healthcareDb())).toBe(true);
  return readJob(queued._id);
}
async function finish(id: string) {
  expect((await request(`/imports/${id}/commit`, {})).status).toBe(202);
  expect(await processNextImport(await healthcareDb())).toBe(true);
  return readJob(id);
}

it("limits read and write by module, company, branch and capability", async () => {
  const patient = await created<Patient>("/patients", { code: "QA01", name: "Hồ sơ thử", phone: "0900000000" });
  expect((await request(`/patients/${patient._id}`, undefined, { actor: "disabled" })).status).toBe(403);
  expect((await request(`/patients/${patient._id}`, undefined, { branchId: String(otherBranch) })).status).toBe(404);
  expect((await request(`/patients/${patient._id}`, undefined, { branchId: String(branch).toUpperCase() })).status).toBe(200);
  expect((await request("/patients/search", { q: "QA01" }, { actor: "viewer", branchId: String(otherBranch) })).status).toBe(403);
  expect((await request("/patients", { code: "QA02", name: "Thử ghi" }, { actor: "viewer" })).status).toBe(403);
  expect((await request("/visits", undefined, { actor: "viewer" })).status).toBe(403);
  expect(await (await request("/overview", undefined, { actor: "viewer" })).json())
    .toMatchObject({ visitCount: null, appointmentCount: null, careCount: null, patientReferences: [] });
  const fetched = await (await request(`/patients/${patient._id}`, undefined, { actor: "viewer" })).json();
  expect(fetched).toMatchObject({ _id: patient._id, name: patient.name });
  expect(fetched).not.toHaveProperty("audit");
  expect((await request(`/patients/${patient._id}`, { code: "NEW-ID", name: patient.name, revision: patient.revision }, { method: "PATCH" })).status).toBe(400);
});

it("creates the visit to follow-up to care flow and prevents concurrent interval collisions", async () => {
  const patient = await created<Patient>("/patients", { code: "FLOW01", name: "Bệnh nhân thử A", phone: "0900000000" });
  const second = await created<Patient>("/patients", { code: "FLOW02", name: "Bệnh nhân thử B", phone: "0900000000" });
  const doctor = await created<CatalogItem>("/catalog", { kind: "doctor", code: "BSQA", name: "Bác sĩ thử" });
  const visit = await created<Visit>("/visits", { code: "LKQA", patientId: patient._id, visitedOn: "2026-11-07", doctorId: doctor._id });
  const today = calendarDay();
  const booking = { startsAt: `${today}T09:00+07:00`, endsAt: `${today}T09:30+07:00`, doctorId: doctor._id };
  const results = await Promise.all([
    request("/appointments", { ...booking, patientId: patient._id, visitId: visit._id }),
    request("/appointments", { ...booking, startsAt: `${today}T09:15+07:00`, patientId: second._id }),
  ]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  const winner = await results.find(result => result.status === 201)!.json() as Appointment;
  const cancellation = { patientId: winner.patientId, visitId: winner.visitId, doctorId: winner.doctorId, roomId: winner.roomId,
    startsAt: winner.startsAt, endsAt: winner.endsAt, status: "cancelled", revision: winner.revision };
  expect((await request(`/appointments/${winner._id}`, cancellation, { method: "PATCH" })).status).toBe(200);
  expect((await request(`/appointments/${winner._id}`, cancellation, { method: "PATCH" })).status).toBe(409);
  const appointment = await created<Appointment>("/appointments", { ...booking, patientId: patient._id, visitId: visit._id });
  const task = {
    patientId: patient._id, appointmentId: appointment._id, assigneeId: String(admin), title: "Gọi xác nhận", dueOn: today,
  };
  const care = await created<CareTask>("/care", task);
  expect(care).toMatchObject({ appointmentId: appointment._id, status: "open" });
  expect((await request("/care", { ...task, patientId: second._id })).status).toBe(400);

  const reference = { _id: patient._id, code: patient.code, name: patient.name, phone: patient.phone };
  expect(await (await request("/visits/search", { q: "Bác sĩ thử" })).json()).toMatchObject({ total: 1, items: [{ _id: visit._id }] });
  for (const [path, id] of [["visits", visit._id], ["appointments", appointment._id], ["care", care._id]]) {
    const { items, patientReferences } = await (await request(`/${path}?id=${id}`)).json();
    expect(items).toHaveLength(1);
    expect(items[0]._id).toBe(id);
    expect(items[0]).not.toHaveProperty("audit");
    expect(items[0]).not.toHaveProperty("reservations");
    expect(patientReferences).toEqual([reference]);
  }
  const overview = await (await request("/overview")).json();
  expect(overview.todayAppointments).toEqual([{ _id: appointment._id, patientId: patient._id, startsAt: appointment.startsAt, status: "scheduled" }]);
  expect(overview.dueCare).toEqual([{ _id: care._id, patientId: patient._id, dueOn: today, title: task.title }]);
  expect(overview.patientReferences).toEqual([reference]);
  expect(await (await request("/appointments", undefined, { branchId: String(otherBranch) })).json())
    .toMatchObject({ items: [], total: 0, patientReferences: [] });
});

it("previews patients and visits, preserves source rows and replays Excel import without duplicating records", async () => {
  const patients = [["Mã bệnh nhân", "Họ và tên", "SĐT"], ["IMPORT01", "Hồ sơ nhập thử", "0901111111"]];
  const preview = await prepare("patients", sheet(patients));
  expect(preview).toMatchObject({ status: "preview", ready: 1, total: 1, duplicates: 0, invalid: 0 });
  expect((await request(`/imports/${preview._id}/commit`, {}, { branchId: String(otherBranch) })).status).toBe(404);
  const commits = await Promise.all([request(`/imports/${preview._id}/commit`, {}), request(`/imports/${preview._id}/commit`, {})]);
  expect(commits.map(response => response.status)).toEqual([202, 202]);
  expect(await commits[0].json()).toMatchObject({ status: "queued", phase: "write" });
  const db = await healthcareDb();
  // A second worker can reclaim a job if the original process stopped mid-import.
  const actor = { companyCode, branchId: String(branch), actorId: String(admin) };
  await records(db, "patients").insertOne(newRecord<Patient>(actor, {
    code: "IMPORT01", name: "Hồ sơ nhập thử", phone: "0901111111", dateOfBirth: "", address: "", note: "",
  }, { batchId: preview._id, row: 2 }));
  await db.collection<{ _id: string }>("healthcare_imports").updateOne({ _id: preview._id }, {
    $set: { status: "running", leaseUntil: new Date(0), attempts: 1 },
  });
  expect((await Promise.all([processNextImport(db), processNextImport(db)])).sort()).toEqual([false, true]);
  expect(await readJob(preview._id)).toMatchObject({ status: "completed", inserted: 1, skipped: 0 });
  expect((await request(`/imports/${preview._id}/commit`, {})).status).toBe(200);
  const repeated = await prepare("patients", sheet(patients));
  expect(repeated).toMatchObject({ duplicates: 1, ready: 0 });
  const invalid = await prepare("visits", sheet([["ma_luot_kham", "ma_benh_nhan", "ngay_kham"], ["LK001", "MISSING", "07/11/2026"]]));
  expect(invalid).toMatchObject({ invalid: 1, ready: 0 });
  expect((await request(`/imports/${invalid._id}/commit`, {})).status).toBe(409);
  expect(await (await request(`/imports/${invalid._id}/rows/search`, { status: "invalid" })).json())
    .toMatchObject({ total: 1, items: [{ row: 2, status: "invalid", code: "LK001" }] });
  const visits = await prepare("visits", sheet([["ma_luot_kham", "ma_benh_nhan", "ngay_kham"], ["LK001", "IMPORT01", "07/11/2026"]]));
  expect(visits).toMatchObject({ ready: 1, invalid: 0 });
  expect(await finish(visits._id)).toMatchObject({ status: "completed", processed: 1 });
  const list = await (await request("/visits?from=2026-11-07&to=2026-11-07")).json();
  expect(list.items).toContainEqual(expect.objectContaining({ code: "LK001", visitedOn: "2026-11-07", source: { row: 2, batchId: visits._id } }));
});

it("imports a multi-sheet hospital report, preserves source details and searches dated visits by patient or doctor", async () => {
  const book = XLSX.utils.book_new();
  const title = [["BÁO CÁO THỐNG KÊ PHIẾU KHÁM"], [], Object.values(hospitalReportColumns), ["Tổng"]];
  const excelSerial = (day: string) => Date.parse(`${day}T18:30:00Z`) / 86_400_000 + 25_569;
  const makeRow = (index: number, date: string) => [
    index, index, excelSerial(date), `BCQA-${index}`, "Nguyễn QA", "BN - 01", "Khách mới", "Thu phí",
    "Phòng thử", "Nữ", "1990", "36", "0900000000 / 0930000000", "Địa chỉ thử", "", "", "Chẩn đoán thử",
    "", "Dịch vụ thử", "30/10/2026", "Bác sĩ QA", "Chờ thực hiện", "X", "", "",
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([...title,
    ...Array.from({ length: 1001 }, (_, i) => makeRow(i + 1, "2026-09-01")),
  ]), "Tháng 9");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([...title, makeRow(1002, "2026-10-01")]), "Tháng 10");
  const upload = () => workbookForm(book, "Báo cáo thử.xlsx");
  const preview = await prepare("hospital-report", upload());
  expect(preview).toMatchObject({ filename: "Báo cáo thử.xlsx", total: 1002, ready: 1002, patientsReady: 1, duplicates: 0, invalid: 0 });
  const rowPath = `/imports/${preview._id}/rows/search`;
  const before = await (await request(rowPath, { page: 2, pageSize: 25 })).json();
  expect(before).toMatchObject({ total: 1002, page: 2, items: expect.arrayContaining([expect.objectContaining({ index: 25, status: "ready" })]) });
  expect(before.items).toHaveLength(25);
  expect(before.items[0].input).toBeUndefined();
  expect(await finish(preview._id)).toMatchObject({ status: "completed", inserted: 1002, patientsInserted: 1, skipped: 0, processed: 1002 });
  const outcomes = await (await request(rowPath, { status: "imported", q: "Tháng 10" })).json();
  expect(outcomes).toMatchObject({ total: 1, items: [{ sheet: "Tháng 10", row: 5, status: "imported", recordId: expect.any(String) }] });
  expect((await request(rowPath, {}, { branchId: String(otherBranch) })).status).toBe(404);

  const filters = { from: "2026-10-01", to: "2026-10-01", pageSize: 1 };
  const list = await (await request("/visits/search", { ...filters, q: "0930000000" })).json();
  expect(list).toMatchObject({ total: 1, items: [{
    code: "BCQA-1002", visitedOn: "2026-10-01", status: "imported",
    source: { sheet: "Tháng 10", row: 5 },
    report: { visitedAt: "2026-10-01T11:30:00.000Z", doctor: "Bác sĩ QA", sourceStatus: "Chờ thực hiện", followUpOn: "2026-10-30" },
  }] });
  expect(list.items[0].report.fields).toBeUndefined();
  const reportPath = `/visits/${list.items[0]._id}/report`;
  expect((await request(reportPath, undefined, { actor: "viewer" })).status).toBe(403);
  expect((await request(reportPath, undefined, { branchId: String(otherBranch) })).status).toBe(404);
  expect(await (await request(reportPath)).json()).toMatchObject({ fields: { chan_doan: "Chẩn đoán thử", thanh_toan: "X" } });
  expect(await (await request("/visits/search", { ...filters, q: "Bác sĩ QA" })).json()).toMatchObject({ total: 1 });
  expect(await (await request("/patients/search", { q: "0930000000", from: calendarDay(), to: calendarDay() })).json()).toMatchObject({
    total: 1, items: [{ code: "BN - 01", dateOfBirth: "", hospitalProfile: { birthYear: "1990" } }],
  });
  expect(await (await request("/visits/search", { ...filters, q: "0930000000" }, { branchId: String(otherBranch) })).json()).toMatchObject({ total: 0 });
  const replay = await prepare("hospital-report", upload());
  expect(replay).toMatchObject({ ready: 0, duplicates: 1002, patientsReady: 0 });
  expect(await finish(replay._id)).toMatchObject({ inserted: 0, patientsInserted: 0, skipped: 1002 });
}, 30_000);
