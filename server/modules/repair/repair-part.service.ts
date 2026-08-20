import { RepairPartModel } from "./repair-part.model";
import type { RepairActor, RepairScope } from "./repair-ticket.service";
import { RepairTicketModel } from "./repair-ticket.model";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";


export type RepairPartBilling = "customer" | "warranty_shop" | "warranty_supplier";

/** Ai chịu chi phí linh kiện suy ra từ diện bảo hành đã chốt lúc tiếp nhận. */
export function defaultPartBilling(costBearer: unknown): RepairPartBilling {
  if (costBearer === "supplier") return "warranty_supplier";
  if (costBearer === "shop") return "warranty_shop";
  return "customer";
}

/**
 * Tính lại tiền của phiếu từ toàn bộ linh kiện còn hiệu lực. Tính lại (thay vì cộng dồn)
 * để hoàn linh kiện cũng trả đúng số, không bị lệch dần.
 *
 * - partCost  = giá vốn mọi linh kiện, kể cả linh kiện bảo hành — dùng tính lãi và chi phí bảo hành.
 * - partRevenue = chỉ linh kiện khách trả tiền.
 * - Phiếu đã báo giá và khách đã duyệt thì GIỮ NGUYÊN số đã cam kết; phần lệch trả về
 *   cho nhân viên báo lại khách chứ không âm thầm tăng tiền.
 */
export async function recomputeRepairTicketAmounts(ticket: any) {
  const parts: any[] = await RepairPartModel.find({ companyCode: ticket.companyCode, ticketId: String(ticket._id), status: "issued" }).lean();
  const partCost = parts.reduce((total, part) => total + Number(part.unitCost || 0) * Number(part.quantity || 0), 0);
  const partRevenue = parts.reduce((total, part) => total + (part.chargeable === false ? 0 : Number(part.unitPrice || 0) * Number(part.quantity || 0)), 0);
  const computed = Math.max(0, Number(ticket.laborFee || 0) + partRevenue - Number(ticket.discountAmount || 0));
  const locked = Number.isFinite(Number(ticket.quotedAmount)) && ticket.quotedAmount !== undefined && ticket.quotedAmount !== null && Boolean(ticket.customerApprovedAt);

  ticket.partCost = partCost;
  ticket.partRevenue = partRevenue;
  ticket.totalAmount = locked ? Number(ticket.quotedAmount) : computed;
  ticket.dueAmount = Math.max(0, ticket.totalAmount - Number(ticket.paidAmount || 0));
  ticket.paymentStatus = ticket.dueAmount === 0 ? (ticket.paidAmount > 0 ? "paid" : ticket.paymentStatus) : Number(ticket.paidAmount || 0) > 0 ? "partial" : "unpaid";
  await ticket.save();
  return { partCost, partRevenue, totalAmount: ticket.totalAmount, quoteDeviation: locked ? computed - Number(ticket.quotedAmount) : 0 };
}

export async function listRepairParts(scope: RepairScope, ticketId: string) { return RepairPartModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, ticketId }).sort({ issuedAt: -1 }).lean(); }
export async function issueRepairPart(scope: RepairScope, ticketId: string, input: { productId: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; serialNumbers?: string[]; idempotencyKey: string; billing?: RepairPartBilling }, actor: RepairActor) {
  const key = String(input.idempotencyKey || "").trim(); if (!key) throw Object.assign(new Error("idempotencyKey là bắt buộc."), { statusCode: 400 });
  const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean(); if (existing) return existing;
  const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (!["approved", "repairing"].includes(ticket.status)) throw Object.assign(new Error("Chỉ được xuất linh kiện khi phiếu đã được duyệt hoặc đang sửa."), { statusCode: 409 });
  const quantity = Number(input.quantity); if (!Number.isInteger(quantity) || quantity <= 0) throw Object.assign(new Error("Số lượng linh kiện không hợp lệ."), { statusCode: 400 });
  await writeStockMovement({ ...scope, direction: "out", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: key, operatorName: actor.name, items: [{ productId: input.productId, sku: input.sku, productName: input.productName, quantity, unitCost: Number(input.unitCost), unitPrice: Number(input.unitPrice), lineTotal: quantity * Number(input.unitPrice) }], reason: `Xuất linh kiện cho phiếu ${ticket.ticketCode}` });
  const billing: RepairPartBilling = input.billing || defaultPartBilling(ticket.coverage?.costBearer);
  const chargeable = billing === "customer";
  const part = await RepairPartModel.create({ ...input, billing, chargeable, companyCode: scope.companyCode, branchId: scope.branchId, ticketId, quantity, lineTotal: chargeable ? quantity * Number(input.unitPrice) : 0, status: "issued", issuedBy: actor.id, issuedByName: actor.name, issuedAt: new Date() });
  const amounts = await recomputeRepairTicketAmounts(ticket);
  return { ...part.toObject(), ticketAmounts: amounts };
}
export async function returnRepairPart(scope: RepairScope, ticketId: string, partId: string, reason: string, actor: RepairActor) {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hoàn linh kiện là bắt buộc."), { statusCode: 400 });
  const part: any = await RepairPartModel.findOne({ _id: partId, companyCode: scope.companyCode, branchId: scope.branchId, ticketId }); if (!part) throw Object.assign(new Error("Không tìm thấy linh kiện."), { statusCode: 404 });
  if (part.status !== "issued") throw Object.assign(new Error("Linh kiện đã được hoàn hoặc hủy."), { statusCode: 409 });
  await writeStockMovement({ ...scope, direction: "in", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: `repair:${ticketId}:part:${partId}:return`, operatorName: actor.name, items: [{ productId: part.productId, sku: part.sku, productName: part.productName, quantity: part.quantity, unitCost: part.unitCost, unitPrice: part.unitPrice, lineTotal: part.lineTotal }], reason: `Hoàn linh kiện phiếu ${ticketId}` });
  part.status = "returned"; part.returnedAt = new Date(); part.returnReason = note; part.updatedBy = actor.id; part.returnedByName = actor.name; await part.save();
  const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope });
  const amounts = ticket ? await recomputeRepairTicketAmounts(ticket) : undefined;
  return { ...part.toObject(), ...(amounts ? { ticketAmounts: amounts } : {}) };
}
