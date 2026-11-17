import { Router, type RequestHandler, type Response } from "express";
import Joi from "joi";
import multer from "multer";
import type { Db, Filter } from "mongodb";
import { getEffectivePermissions, hasAnyPermission, requirePermission, type AuthenticatedRequest } from "../../middleware/auth";
import { NotFoundError, PayloadTooLargeError, ValidationError } from "../../errors/app-error";
import { appointmentStatuses, careStatuses, visitStatuses, type HealthcareList, type HealthcareOverview, type HealthcarePatientList, type ImportKind, type ImportRowStatus } from "../../../shared/healthcare";
import { getImportJob, importHistory, importTemplate, listImportRows, queueImportCommit, queueImportFile, retryImportJob } from "./imports";
import { calendarDay, dateRangeFilter, dayBounds, healthcareScope, healthcareStaff, listFilter, prepareAppointment, prepareCare, prepareVisit } from "./operations";
import { createGeneratedPatient, createRecord, findRecord, healthcareDb, listClinicalRecords, listRecords, patientReferences, patientSearchFilter, privateFields, records, scopeFilter, textMatches, updateRecord, visible, type HealthcareActor, type StoredAppointment } from "./store";
import { appointmentInput, careInput, catalogInput, input, listInput, listSearchInput, patientCreateInput, patientInput, patientSearchInput, recordId, versioned, visitInput } from "./validation";

export const healthcareRouter = Router();
healthcareRouter.use(requirePermission("healthcare:read") as RequestHandler);
healthcareRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

type Handler = (req: AuthenticatedRequest, res: Response, db: Db, actor: HealthcareActor) => Promise<unknown>;
function route(handler: Handler): RequestHandler {
  return (request, response, next) => {
    const req = request as AuthenticatedRequest;
    void healthcareScope(req).then(async actor => handler(req, response, await healthcareDb(), actor)).catch(next);
  };
}
const permission = (feature: string, mode = "manage") => requirePermission(`healthcare${feature ? "-" + feature : ""}:${mode}`) as RequestHandler;
const idOf = (req: AuthenticatedRequest) => input(recordId, req.params.id);
const patientConflict = "Mã bệnh nhân đã được sử dụng trong chi nhánh.";
const visitConflict = "Mã lượt khám đã được sử dụng trong chi nhánh.";
const appointmentConflict = "Bệnh nhân, bác sĩ hoặc phòng đã có lịch trong khoảng giờ này.";
const catalogConflict = "Mã danh mục đã được sử dụng trong chi nhánh.";
const clinicalQuery = (req: AuthenticatedRequest) => req.method === "POST" ? input(listSearchInput, req.body) : input(listInput, req.query);

async function withPatients<T extends { patientId: string }>(
  db: Db, actor: HealthcareActor, page: HealthcareList<T>,
): Promise<HealthcarePatientList<T>> {
  return { ...page, patientReferences: await patientReferences(db, actor, page.items) };
}

healthcareRouter.get("/overview", route(async (req, res, db, actor) => {
  const today = calendarDay();
  const { start, end } = dayBounds(today);
  const query = input(listInput, req.query);
  const scope = scopeFilter(actor);
  const visits = listFilter(query, "visitedOn", visitStatuses);
  const range = query.from || query.to ? visits : { visitedOn: today };
  const appointmentFilter: Filter<StoredAppointment> = { ...scope, $or: [
    { scheduledOn: today }, { startsAt: { $gte: start, $lt: end } },
  ], status: { $in: ["scheduled", "confirmed", "arrived"] } };
  const careFilter = { ...scope, dueOn: { $lte: today }, status: { $in: ["open", "in_progress"] } } as const;
  const grants = await getEffectivePermissions(actor.actorId, req.user!.role, actor.companyCode);
  const can = (area: string) => hasAnyPermission(grants, [`healthcare-${area}:read`]);
  const [patients, visitCount, appointmentCount, careCount, todayAppointments, dueCare] = await Promise.all([
    records(db, "patients").countDocuments(scope),
    can("visits") ? records(db, "visits").countDocuments({ ...scope, ...range }) : null,
    can("appointments") ? records(db, "appointments").countDocuments(appointmentFilter) : null,
    can("care") ? records(db, "care").countDocuments(careFilter) : null,
    can("appointments") ? records(db, "appointments").find(appointmentFilter)
      .project<HealthcareOverview["todayAppointments"][number]>({ _id: 1, patientId: 1, scheduledOn: 1, startsAt: 1, status: 1 })
      .sort({ scheduledOn: 1, startsAt: 1 }).limit(8).toArray() : [],
    can("care") ? records(db, "care").find(careFilter)
      .project<HealthcareOverview["dueCare"][number]>({ _id: 1, patientId: 1, dueOn: 1, title: 1 })
      .sort({ dueOn: 1 }).limit(8).toArray() : [],
  ]);
  const result: HealthcareOverview = {
    today, patients, visitCount, appointmentCount, careCount, todayAppointments, dueCare,
    patientReferences: await patientReferences(db, actor, [...todayAppointments, ...dueCare]),
  };
  res.json(result);
}));

healthcareRouter.post("/patients/search", route(async (req, res, db, actor) => {
  const query = input(patientSearchInput, req.body);
  const filter = { ...patientSearchFilter(query.q, query.mode === "selection"), ...dateRangeFilter("createdAt", query) };
  const sort = query.from || query.to ? { createdAt: -1, _id: -1 } as const : { updatedAt: -1, _id: -1 } as const;
  res.json(await listRecords(records(db, "patients"), actor, filter, sort, query.page, query.pageSize));
}));
healthcareRouter.get("/patients/:id", route(async (req, res, db, actor) => {
  res.json(visible(await findRecord(records(db, "patients"), actor, idOf(req))));
}));
healthcareRouter.post("/patients", permission(""), route(async (req, res, db, actor) => {
  const { code, ...value } = input(patientCreateInput, req.body);
  const patient = code
    ? await createRecord(records(db, "patients"), actor, { ...value, code }, patientConflict)
    : await createGeneratedPatient(db, actor, value);
  res.status(201).json(patient);
}));
healthcareRouter.patch("/patients/:id", permission(""), route(async (req, res, db, actor) => {
  const id = idOf(req);
  const { revision, ...value } = input(versioned(patientInput), req.body);
  const collection = records(db, "patients");
  const existing = await findRecord(collection, actor, id);
  if (value.code !== existing.code) throw new ValidationError("VALIDATION_FAILED", "Mã bệnh nhân được cố định sau khi tạo.", { fields: ["code"] });
  res.json(await updateRecord(collection, actor, id, revision, value, patientConflict));
}));

const visitListing = route(async (req, res, db, actor) => {
  const query = clinicalQuery(req);
  const catalogIds = query.q
    ? await records(db, "catalog").distinct("_id", { ...scopeFilter(actor), $or: textMatches(query.q, ["code", "name"]) })
    : [];
  const catalogMatches = catalogIds.length ? ["doctorId", "roomId", "serviceId"].map(field => ({ [field]: { $in: catalogIds } })) : [];
  const page = await listClinicalRecords(records(db, "visits"), actor, listFilter(query, "visitedOn", visitStatuses),
    { visitedOn: -1, _id: -1 }, query,
    ["code", "doctorName", "report.doctor", "report.department", "report.sourceStatus", "report.service", "report.fields.dich_vu_dieu_tri"], catalogMatches);
  res.json(await withPatients(db, actor, page));
});
healthcareRouter.get("/visits", permission("visits", "read"), visitListing);
healthcareRouter.post("/visits/search", permission("visits", "read"), visitListing);
healthcareRouter.get("/visits/:id/report", permission("visits", "read"), route(async (req, res, db, actor) => {
  const row = await records(db, "visits").findOne({ ...scopeFilter(actor), _id: idOf(req) }, { projection: { report: 1, source: 1 } });
  if (!row?.report?.fields) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy nội dung phiếu khám đã nhập.");
  res.json({ fields: row.report.fields, source: row.source });
}));
healthcareRouter.post("/visits", permission("visits"), route(async (req, res, db, actor) => {
  const value = await prepareVisit(db, actor, input(visitInput, req.body));
  res.status(201).json(await createRecord(records(db, "visits"), actor, value, visitConflict));
}));
healthcareRouter.patch("/visits/:id", permission("visits"), route(async (req, res, db, actor) => {
  const id = idOf(req);
  const { revision, ...value } = input(versioned(visitInput), req.body);
  const collection = records(db, "visits");
  const existing = await findRecord(collection, actor, id);
  if (value.code !== existing.code) throw new ValidationError("VALIDATION_FAILED", "Mã lượt khám được cố định sau khi tạo.", { fields: ["code"] });
  const prepared = await prepareVisit(db, actor, value, existing);
  res.json(await updateRecord(collection, actor, id, revision, prepared, visitConflict));
}));

const appointmentListing = route(async (req, res, db, actor) => {
  const query = clinicalQuery(req);
  const doctorIds = query.q
    ? await records(db, "catalog").distinct("_id", { ...scopeFilter(actor), kind: "doctor", $or: textMatches(query.q, ["code", "name"]) })
    : [];
  const page = await listClinicalRecords(records(db, "appointments"), actor, listFilter(query, "startsAt", appointmentStatuses),
    { scheduledOn: -1, startsAt: -1, _id: -1 }, query, ["doctorName"], doctorIds.length ? [{ doctorId: { $in: doctorIds } }] : []);
  res.json(await withPatients(db, actor, page));
});
healthcareRouter.get("/appointments", permission("appointments", "read"), appointmentListing);
healthcareRouter.post("/appointments/search", permission("appointments", "read"), appointmentListing);
healthcareRouter.post("/appointments", permission("appointments"), route(async (req, res, db, actor) => {
  const value = await prepareAppointment(db, actor, input(appointmentInput, req.body));
  res.status(201).json(await createRecord(records(db, "appointments"), actor, value, appointmentConflict));
}));
healthcareRouter.patch("/appointments/:id", permission("appointments"), route(async (req, res, db, actor) => {
  const id = idOf(req);
  const { revision, ...value } = input(versioned(appointmentInput), req.body);
  const collection = records(db, "appointments");
  const prepared = await prepareAppointment(db, actor, value, await findRecord(collection, actor, id));
  res.json(await updateRecord(collection, actor, id, revision, prepared, appointmentConflict));
}));

const careListing = route(async (req, res, db, actor) => {
  const query = clinicalQuery(req);
  const page = await listClinicalRecords(records(db, "care"), actor, listFilter(query, "dueOn", careStatuses),
    { dueOn: 1, _id: 1 }, query, ["title", "details", "result"]);
  res.json(await withPatients(db, actor, page));
});
healthcareRouter.get("/care", permission("care", "read"), careListing);
healthcareRouter.post("/care/search", permission("care", "read"), careListing);
healthcareRouter.post("/care", permission("care"), route(async (req, res, db, actor) => {
  const value = await prepareCare(db, actor, input(careInput, req.body));
  res.status(201).json(await createRecord(records(db, "care"), actor, value, "Việc chăm sóc đã tồn tại."));
}));
healthcareRouter.patch("/care/:id", permission("care"), route(async (req, res, db, actor) => {
  const id = idOf(req);
  const { revision, ...value } = input(versioned(careInput), req.body);
  const collection = records(db, "care");
  const prepared = await prepareCare(db, actor, value, await findRecord(collection, actor, id));
  res.json(await updateRecord(collection, actor, id, revision, prepared, "Việc chăm sóc đã tồn tại."));
}));

healthcareRouter.get("/catalog", route(async (_req, res, db, actor) => {
  res.json(await records(db, "catalog").find(scopeFilter(actor), { projection: privateFields }).sort({ kind: 1, name: 1 }).toArray());
}));
healthcareRouter.post("/catalog", permission("settings"), route(async (req, res, db, actor) => {
  res.status(201).json(await createRecord(records(db, "catalog"), actor, input(catalogInput, req.body), catalogConflict));
}));
healthcareRouter.patch("/catalog/:id", permission("settings"), route(async (req, res, db, actor) => {
  const id = idOf(req);
  const { revision, ...value } = input(versioned(catalogInput), req.body);
  const collection = records(db, "catalog");
  const existing = await findRecord(collection, actor, id);
  if (value.kind !== existing.kind) throw new ValidationError("VALIDATION_FAILED", "Loại danh mục được cố định sau khi tạo.");
  res.json(await updateRecord(collection, actor, id, revision, value, catalogConflict));
}));
healthcareRouter.get("/staff", permission("care", "read"), route(async (_req, res, _db, actor) => {
  res.json(await healthcareStaff(actor));
}));

const workbook = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }).single("file");
const uploadWorkbook: RequestHandler = (req, res, next) => workbook(req, res, error => {
  if (!error) return next();
  if (error.code === "LIMIT_FILE_SIZE") return next(new PayloadTooLargeError("PAYLOAD_TOO_LARGE", "File Excel vượt quá 4 MB."));
  return next(new ValidationError("VALIDATION_FAILED", "Vui lòng gửi một file Excel hợp lệ."));
});
const templateKind = Joi.string<Exclude<ImportKind, "hospital-report">>().valid("patients", "visits").required();
const importKind = Joi.string<ImportKind>().valid("patients", "visits", "hospital-report").required();
const importRowsInput = Joi.object<{ page: number; pageSize: number; q: string; status?: ImportRowStatus }>({
  page: Joi.number().integer().min(1).max(5000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  q: Joi.string().trim().allow("").max(100).default(""),
  status: Joi.string().valid("ready", "imported", "skipped", "invalid"),
}).required();
const patientDeleteInput = Joi.object<{ ids: string[] }>({
  ids: Joi.array().items(recordId).min(1).max(500).unique().required(),
}).required();

async function patientDeletionImpact(db: Db, actor: HealthcareActor, ids: string[]) {
  const scope = scopeFilter(actor);
  const patients = await records(db, "patients").find({ ...scope, _id: { $in: ids } })
    .project<{ _id: string; code: string; name: string; phone: string; createdAt: string; hospitalProfile?: { gender?: string } }>({
      _id: 1, code: 1, name: 1, phone: 1, createdAt: 1, "hospitalProfile.gender": 1,
    }).toArray();
  if (patients.length !== ids.length) throw new NotFoundError("RESOURCE_NOT_FOUND", "Một số hồ sơ không còn tồn tại trong chi nhánh hiện tại.");
  const patientIds = patients.map(patient => patient._id);
  const counts = async (kind: "visits" | "appointments" | "care") => records(db, kind).aggregate<{ _id: string; count: number }>([
    { $match: { ...scope, patientId: { $in: patientIds } } },
    { $group: { _id: "$patientId", count: { $sum: 1 } } },
  ]).toArray();
  const [visits, appointments, care] = await Promise.all([counts("visits"), counts("appointments"), counts("care")]);
  const map = (rows: Array<{ _id: string; count: number }>) => new Map(rows.map(row => [row._id, row.count]));
  const visitCounts = map(visits);
  const appointmentCounts = map(appointments);
  const careCounts = map(care);
  return {
    items: patients.map(patient => ({
      ...patient,
      visits: visitCounts.get(patient._id) || 0,
      appointments: appointmentCounts.get(patient._id) || 0,
      care: careCounts.get(patient._id) || 0,
    })),
  };
}

healthcareRouter.post("/patients/bulk-delete-preview", permission("", "manage"), route(async (req, res, db, actor) => {
  const { ids } = input(patientDeleteInput, req.body);
  res.json(await patientDeletionImpact(db, actor, ids));
}));
healthcareRouter.post("/patients/bulk-delete", permission("", "manage"), route(async (req, res, db, actor) => {
  const { ids } = input(patientDeleteInput, req.body);
  await patientDeletionImpact(db, actor, ids);
  const scope = scopeFilter(actor);
  const filter = { ...scope, patientId: { $in: ids } };
  const care = await records(db, "care").deleteMany(filter);
  const appointments = await records(db, "appointments").deleteMany(filter);
  const visits = await records(db, "visits").deleteMany(filter);
  const patients = await records(db, "patients").deleteMany({ ...scope, _id: { $in: ids } });
  if (patients.deletedCount !== ids.length) throw new NotFoundError("RESOURCE_NOT_FOUND", "Một số hồ sơ đã thay đổi trong lúc xóa. Hãy tải lại danh sách.");
  res.json({ deletedCount: patients.deletedCount, deletedCare: care.deletedCount, deletedAppointments: appointments.deletedCount, deletedVisits: visits.deletedCount });
}));

healthcareRouter.get("/imports", permission("import", "read"), route(async (_req, res, db, actor) => {
  res.json(await importHistory(db, actor));
}));
healthcareRouter.get("/imports/template/:kind", permission("import", "read"), route(async (req, res) => {
  const kind = input(templateKind, req.params.kind);
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .attachment(kind === "patients" ? "mau-benh-nhan.xlsx" : "mau-luot-kham.xlsx")
    .send(importTemplate(kind));
}));
healthcareRouter.post("/imports/preview/:kind", permission("import"), uploadWorkbook, route(async (req, res, db, actor) => {
  const kind = input(importKind, req.params.kind);
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) throw new ValidationError("VALIDATION_FAILED", "Chọn một file .xlsx để nhập.");
  const original = req.file.originalname;
  const decoded = /^[\u0000-\u00ff]*$/.test(original) ? Buffer.from(original, "latin1").toString("utf8") : original;
  res.status(202).json(await queueImportFile(db, actor, kind, decoded.includes("\ufffd") ? original : decoded, req.file.buffer));
}));
healthcareRouter.get("/imports/:id", permission("import", "read"), route(async (req, res, db, actor) => {
  res.json(await getImportJob(db, actor, idOf(req)));
}));
healthcareRouter.post("/imports/:id/rows/search", permission("import", "read"), route(async (req, res, db, actor) => {
  res.json(await listImportRows(db, actor, idOf(req), input(importRowsInput, req.body)));
}));
healthcareRouter.post("/imports/:id/commit", permission("import"), route(async (req, res, db, actor) => {
  const job = await queueImportCommit(db, actor, idOf(req));
  res.status(job.status === "completed" ? 200 : 202).json(job);
}));
healthcareRouter.post("/imports/:id/retry", permission("import"), route(async (req, res, db, actor) => {
  res.status(202).json(await retryImportJob(db, actor, idOf(req)));
}));
