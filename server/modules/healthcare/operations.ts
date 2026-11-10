import type { Db } from "mongodb";
import { ForbiddenError, ValidationError } from "../../errors/app-error";
import { BranchModel } from "../../model/branch.model";
import { UserModel } from "../../model/user.model";
import type { AuthenticatedRequest } from "../../middleware/auth";
import type { Appointment, CareTask, CatalogKind, RecordInput, Visit } from "../../../shared/healthcare";
import { records, scopeFilter, type HealthcareActor } from "./store";
import { appointmentReservations, checkStatus, type ListQuery } from "./validation";

export async function healthcareScope(req: AuthenticatedRequest): Promise<HealthcareActor> {
  const actor = req.user;
  const companyCode = actor?.companyCode?.trim().toUpperCase();
  if (!actor || !companyCode) throw new ForbiddenError("TENANT_REQUIRED", "Không xác định được doanh nghiệp.");
  const branchId = (req.get("x-branch-id") || actor.branchId || "").toLowerCase();
  if (!/^[a-f0-9]{24}$/i.test(branchId)) throw new ValidationError("BRANCH_REQUIRED", "Vui lòng chọn chi nhánh để sử dụng Quản lý y tế.");
  if (actor.role !== "admin" && branchId !== actor.branchId?.toLowerCase()) {
    throw new ForbiddenError("FORBIDDEN", "Bạn không có quyền truy cập chi nhánh này.");
  }
  if (!await BranchModel.exists({ _id: branchId, companyCode, isActive: true })) {
    throw new ForbiddenError("FORBIDDEN", "Chi nhánh không hoạt động hoặc không thuộc doanh nghiệp.");
  }
  return { actorId: actor.id, companyCode, branchId };
}

const invalidField = (field: string, message: string) => new ValidationError("VALIDATION_FAILED", message, { fields: [field] });
const activeStaff = { isActive: { $ne: false }, disabledAt: null, lockedAt: null, role: { $ne: "superadmin" } };

export async function healthcareStaff(actor: HealthcareActor) {
  const users = await UserModel.find({ ...scopeFilter(actor), ...activeStaff })
    .select("displayName").sort({ displayName: 1, _id: 1 }).lean();
  return users.map(user => ({ _id: String(user._id), name: user.displayName }));
}

async function checkPatient(db: Db, actor: HealthcareActor, patientId: string) {
  if (!await records(db, "patients").findOne({ ...scopeFilter(actor), _id: patientId }, { projection: { _id: 1 } })) {
    throw invalidField("patientId", "Bệnh nhân không thuộc chi nhánh hiện tại.");
  }
}

async function checkCatalog(
  db: Db, actor: HealthcareActor, id: string, kind: CatalogKind, previousId?: string,
) {
  if (!id) return;
  const item = await records(db, "catalog").findOne(
    { ...scopeFilter(actor), _id: id, kind, ...(id === previousId ? {} : { active: true }) },
    { projection: { _id: 1 } },
  );
  if (!item) throw invalidField(`${kind}Id`, "Danh mục đã ngừng sử dụng hoặc không thuộc chi nhánh.");
}

export async function prepareVisit(db: Db, actor: HealthcareActor, value: RecordInput<Visit>, previous?: Visit) {
  checkStatus("visits", value.status, previous?.status);
  if (previous && previous.patientId !== value.patientId) throw invalidField("patientId", "Lượt khám đã gắn với hồ sơ bệnh nhân.");
  await Promise.all([
    checkPatient(db, actor, value.patientId),
    checkCatalog(db, actor, value.doctorId, "doctor", previous?.doctorId),
    checkCatalog(db, actor, value.roomId, "room", previous?.roomId),
    checkCatalog(db, actor, value.serviceId, "service", previous?.serviceId),
  ]);
  return { ...value, doctorName: value.doctorId ? "" : value.doctorName?.trim() || "" };
}

export async function prepareAppointment(db: Db, actor: HealthcareActor, value: RecordInput<Appointment>, previous?: Appointment) {
  checkStatus("appointments", value.status, previous?.status);
  const booking = appointmentReservations({ ...value, doctorName: value.doctorId ? "" : value.doctorName?.trim() || "" });
  if (previous) {
    if (previous.patientId !== booking.patientId || previous.visitId !== booking.visitId) {
      throw invalidField("patientId", "Lịch hẹn đã gắn với bệnh nhân và lượt khám đã chọn.");
    }
    const moved = previous.startsAt !== booking.startsAt || previous.endsAt !== booking.endsAt ||
      previous.doctorId !== booking.doctorId || (previous.doctorName || "") !== (booking.doctorName || "") || previous.roomId !== booking.roomId;
    if (moved && !["scheduled", "confirmed"].includes(previous.status)) {
      throw invalidField("startsAt", "Chỉ lịch chờ hoặc đã xác nhận mới có thể đổi giờ, bác sĩ hoặc phòng.");
    }
  }
  await Promise.all([
    checkPatient(db, actor, booking.patientId),
    checkCatalog(db, actor, booking.doctorId, "doctor", previous?.doctorId),
    checkCatalog(db, actor, booking.roomId, "room", previous?.roomId),
  ]);
  if (booking.visitId && !await records(db, "visits").findOne({
    ...scopeFilter(actor), _id: booking.visitId, patientId: booking.patientId,
  }, { projection: { _id: 1 } })) throw invalidField("visitId", "Lượt khám không khớp với bệnh nhân đã chọn.");
  return booking;
}

export async function prepareCare(db: Db, actor: HealthcareActor, value: RecordInput<CareTask>, previous?: CareTask) {
  checkStatus("care", value.status, previous?.status);
  if (previous && (previous.patientId !== value.patientId || previous.appointmentId !== value.appointmentId ||
    (previous.visitId || "") !== (value.visitId || ""))) {
    throw invalidField("patientId", "Việc chăm sóc đã gắn với bệnh nhân, lượt khám và lịch hẹn đã chọn.");
  }
  if (value.status === "completed" && !value.result) throw invalidField("result", "Cần ghi kết quả trước khi hoàn tất.");
  await checkPatient(db, actor, value.patientId);
  if (value.assigneeId !== previous?.assigneeId && !await UserModel.exists({
    ...scopeFilter(actor), ...activeStaff, _id: value.assigneeId,
  })) throw invalidField("assigneeId", "Người phụ trách phải là nhân viên đang hoạt động ở chi nhánh.");
  if (value.appointmentId && !await records(db, "appointments").findOne({
    ...scopeFilter(actor), _id: value.appointmentId, patientId: value.patientId,
  }, { projection: { _id: 1 } })) throw invalidField("appointmentId", "Lịch hẹn không khớp với bệnh nhân đã chọn.");
  if (value.visitId && !await records(db, "visits").findOne({
    ...scopeFilter(actor), _id: value.visitId, patientId: value.patientId,
  }, { projection: { _id: 1 } })) throw invalidField("visitId", "Lượt khám không khớp với bệnh nhân đã chọn.");
  return value;
}

export function dayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+07:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

export function calendarDay() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function dateRangeFilter(field: "createdAt" | "visitedOn" | "startsAt" | "dueOn", { from, to }: Pick<ListQuery, "from" | "to">) {
  if (from && to && from > to) throw invalidField("to", "Ngày kết thúc phải từ ngày bắt đầu trở đi.");
  if (!from && !to) return {};
  const instant = field === "startsAt" || field === "createdAt";
  const dates = {
    ...(from ? { $gte: instant ? dayBounds(from).start : from } : {}),
    ...(to ? instant ? { $lt: dayBounds(to).end } : { $lte: to } : {}),
  };
  return { [field]: dates };
}

export function listFilter<Status extends string>(query: ListQuery, field: "visitedOn" | "startsAt" | "dueOn", statuses: readonly Status[]) {
  const { id, patientId, status } = query;
  const selectedStatus = status ? statuses.find(value => value === status) : undefined;
  if (status && !selectedStatus) throw invalidField("status", "Trạng thái không hợp lệ.");
  return { ...(id ? { _id: id } : {}), ...(patientId ? { patientId } : {}), ...(selectedStatus ? { status: selectedStatus } : {}), ...dateRangeFilter(field, query) };
}
