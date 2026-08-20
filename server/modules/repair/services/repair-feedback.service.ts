import { UserModel } from "../../../model/user.model";
import { RepairFeedbackModel } from "../repair-feedback.model";
import { RepairTicketModel } from "../repair-ticket.model";
import type { RepairActor, RepairScope } from "../repair-ticket.service";

export type RepairRatingCriteria = { skill?: number; attitude?: number; speed?: number };

const isScore = (value: unknown) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5;

export function sanitizeCriteria(input: unknown): RepairRatingCriteria | undefined {
  if (!input || typeof input !== "object") return undefined;
  const source = input as Record<string, unknown>;
  const criteria = Object.fromEntries((["skill", "attitude", "speed"] as const)
    .filter((key) => source[key] !== undefined && source[key] !== null && source[key] !== "")
    .map((key) => {
      if (!isScore(source[key])) throw Object.assign(new Error("Điểm từng tiêu chí phải từ 1 đến 5."), { statusCode: 400 });
      return [key, Number(source[key])];
    }));
  return Object.keys(criteria).length ? criteria : undefined;
}

/** Gán kỹ thuật viên là một tài khoản đang hoạt động của chính công ty đó. */
export async function assignRepairTechnician(scope: RepairScope, ticketId: string, technicianId: string, actor: RepairActor) {
  const id = String(technicianId || "").trim();
  if (!id) throw Object.assign(new Error("Kỹ thuật viên là bắt buộc."), { statusCode: 400 });
  const technician: any = await UserModel.findOne({ _id: id, companyCode: scope.companyCode }).select("displayName email isActive").lean();
  if (!technician) throw Object.assign(new Error("Không tìm thấy kỹ thuật viên trong doanh nghiệp."), { statusCode: 404 });
  if (technician.isActive === false) throw Object.assign(new Error("Tài khoản kỹ thuật viên đã bị khoá."), { statusCode: 409 });

  const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope });
  if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (["delivered", "cancelled", "returned"].includes(ticket.status)) throw Object.assign(new Error("Phiếu đã kết thúc, không đổi được kỹ thuật viên."), { statusCode: 409 });

  ticket.technicianId = id;
  ticket.technicianName = String(technician.displayName || technician.email || "");
  ticket.assignedAt = new Date();
  ticket.assignedBy = actor.id;
  ticket.updatedBy = actor.id;
  await ticket.save();
  return ticket.toObject();
}

/** Nhân viên nhập điểm hộ khi khách nhận máy tại quầy. Vẫn chỉ 1 đánh giá cho 1 phiếu. */
export async function submitStaffFeedback(scope: RepairScope, ticketId: string, input: { rating: unknown; comment?: unknown; criteria?: unknown }, actor: RepairActor) {
  const rating = Number(input.rating);
  if (!isScore(rating)) throw Object.assign(new Error("Điểm đánh giá phải từ 1 đến 5."), { statusCode: 400 });
  const criteria = sanitizeCriteria(input.criteria);

  const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope }).select("ticketCode companyCode branchId status technicianId technicianName").lean();
  if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (!["done", "delivered"].includes(ticket.status)) throw Object.assign(new Error("Chỉ đánh giá khi phiếu đã sửa xong."), { statusCode: 409 });
  if (await RepairFeedbackModel.exists({ ticketId: String(ticket._id) })) throw Object.assign(new Error("Phiếu này đã được đánh giá."), { statusCode: 409, code: "FEEDBACK_ALREADY_SUBMITTED" });

  return (await RepairFeedbackModel.create({
    ticketId: String(ticket._id), ticketCode: ticket.ticketCode, companyCode: ticket.companyCode, branchId: ticket.branchId,
    rating, comment: String(input.comment || "").trim() || undefined, ...(criteria ? { criteria } : {}),
    ...(ticket.technicianId ? { technicianId: String(ticket.technicianId), technicianName: String(ticket.technicianName || "") } : {}),
    source: "staff", ratedBy: actor.id, ratedByName: actor.name, submittedAt: new Date(),
  })).toObject();
}

export async function listRepairFeedback(scope: { companyCode: string; branchId?: string }, filter: { technicianId?: string; limit?: number } = {}) {
  return RepairFeedbackModel.find({
    companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(filter.technicianId ? { technicianId: filter.technicianId } : {}),
  }).sort({ submittedAt: -1 }).limit(Math.min(200, Math.max(1, Number(filter.limit) || 50))).lean();
}
