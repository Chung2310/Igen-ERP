import Joi from "joi";
import { ValidationError } from "../../errors/app-error";
import {
  appointmentStatuses, careStatuses, catalogKinds, visitStatuses,
  type Appointment, type CareTask, type CatalogItem, type Patient, type RecordInput, type Visit,
} from "../../../shared/healthcare";

const text = (max: number) => Joi.string().trim().max(max).allow("").default("");
const requiredText = (max: number) => Joi.string().trim().min(1).max(max).required();
const code = Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9._/-]{0,49}$/).required();
const patientCode = Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9 ._/-]{0,49}$/).required();
export const recordId = Joi.string().guid({ version: "uuidv4" }).required();
const optionalId = recordId.optional().allow("").default("");
const revision = Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).required();
const localDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const time = new Date(value + "T00:00:00Z");
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value ? value : helpers.error("date.format");
});
const instant = Joi.string().isoDate().pattern(/T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/).strict().required();

export function input<T>(schema: Joi.Schema<T>, data: unknown): T {
  const result = schema.validate(data, { abortEarly: false });
  if (result.error) {
    const fields = [...new Set(result.error.details.map(detail => String(detail.path[0] || "")))].filter(Boolean);
    throw new ValidationError("VALIDATION_FAILED", "Kiểm tra các trường bắt buộc hoặc định dạng dữ liệu.", { fields });
  }
  return result.value as T;
}

export const patientInput = Joi.object<RecordInput<Patient>>({
  code: patientCode, name: requiredText(180),
  phone: text(40).pattern(/^[+\d ().-]*$/),
  dateOfBirth: localDate.allow("").default("").custom((value, helpers) =>
    !value || value <= new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10) ? value : helpers.error("date.max"),
  ),
  address: text(350), note: text(1000),
}).required();

const visitFields = {
  code, visitedOn: localDate.required(), doctorId: optionalId,
  roomId: optionalId, serviceId: optionalId, status: Joi.string().valid(...visitStatuses).default("registered"),
  paymentNote: text(160), note: text(1000),
};
export const visitInput = Joi.object<RecordInput<Visit>>({ ...visitFields, patientId: recordId }).required();
export const hospitalVisitInput = Joi.object<Omit<RecordInput<Visit>, "patientId">>(visitFields).required();

export const appointmentInput = Joi.object<RecordInput<Appointment>>({
  patientId: recordId, visitId: optionalId, doctorId: optionalId, roomId: optionalId,
  startsAt: instant, endsAt: instant, status: Joi.string().valid(...appointmentStatuses).default("scheduled"), note: text(1000),
}).required();

export const careInput = Joi.object<RecordInput<CareTask>>({
  patientId: recordId, appointmentId: optionalId, assigneeId: Joi.string().hex().length(24).required(),
  title: requiredText(200), dueOn: localDate.required(), status: Joi.string().valid(...careStatuses).default("open"), result: text(1000),
}).required();

export const catalogInput = Joi.object<RecordInput<CatalogItem>>({
  kind: Joi.string().valid(...catalogKinds).required(), code, name: requiredText(180), active: Joi.boolean().default(true),
}).required();

export function versioned<T>(schema: Joi.ObjectSchema<T>) {
  return (schema as Joi.ObjectSchema).keys({ revision }) as Joi.ObjectSchema<T & { revision: number }>;
}

export type ListQuery = { page: number; pageSize: number; id?: string; patientId?: string; status?: string; from?: string; to?: string; q?: string };
export const listInput = Joi.object<ListQuery>({
  page: Joi.number().integer().min(1).max(5000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  id: recordId.optional(), patientId: recordId.optional(), status: Joi.string().max(24), from: localDate, to: localDate,
});
export const listSearchInput = listInput.keys({ q: text(100) });
export const patientSearchInput = Joi.object<{ q: string; page: number; pageSize: number; from?: string; to?: string }>({
  q: text(100), from: localDate, to: localDate, page: Joi.number().integer().min(1).max(5000).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
});

const visitTransitions: Record<Visit["status"], Visit["status"][]> = {
  registered: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"],
  completed: [], cancelled: [], imported: [],
};
const appointmentTransitions: Record<Appointment["status"], Appointment["status"][]> = {
  scheduled: ["confirmed", "arrived", "cancelled", "no_show"],
  confirmed: ["arrived", "cancelled", "no_show"], arrived: ["completed"],
  completed: [], cancelled: [], no_show: [],
};
const careTransitions: Record<CareTask["status"], CareTask["status"][]> = {
  open: ["in_progress", "completed", "cancelled"], in_progress: ["completed", "cancelled"],
  completed: [], cancelled: [],
};

export function checkStatus(kind: "visits" | "appointments" | "care", status: string, previous?: string) {
  const states: Record<string, string[]> = kind === "visits" ? visitTransitions : kind === "appointments" ? appointmentTransitions : careTransitions;
  const initial = kind === "visits" ? "registered" : kind === "appointments" ? "scheduled" : "open";
  if ((!previous && status === initial) || previous === status || (previous && states[previous]?.includes(status))) return;
  throw new ValidationError("VALIDATION_FAILED", "Không thể chuyển sang trạng thái đã chọn.", { fields: ["status"] });
}

export const isHoldingAppointment = (status: Appointment["status"]) =>
  status === "scheduled" || status === "confirmed" || status === "arrived";

export function appointmentReservations(value: RecordInput<Appointment>) {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  const step = 15 * 60 * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start % step || end % step || end <= start || end - start > 8 * 60 * 60 * 1000) {
    throw new ValidationError("VALIDATION_FAILED", "Chọn giờ theo mốc 15 phút. Giờ kết thúc phải sau giờ bắt đầu và lịch tối đa 8 giờ.", { fields: ["startsAt", "endsAt"] });
  }
  const reservations: string[] = [];
  if (isHoldingAppointment(value.status)) {
    for (let slot = start; slot < end; slot += step) {
      reservations.push(`patient:${value.patientId}:${slot}`);
      if (value.doctorId) reservations.push(`doctor:${value.doctorId}:${slot}`);
      if (value.roomId) reservations.push(`room:${value.roomId}:${slot}`);
    }
  }
  return { ...value, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), reservations };
}
