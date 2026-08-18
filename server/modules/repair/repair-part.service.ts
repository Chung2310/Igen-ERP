import { RepairPartModel } from "./repair-part.model";
import type { RepairActor, RepairScope } from "./repair-ticket.service";
import { RepairTicketModel } from "./repair-ticket.model";
import { writeStockMovement } from "../../integrations/shared/stock-movement.service";

export async function listRepairParts(scope: RepairScope, ticketId: string) { return RepairPartModel.find({ companyCode: scope.companyCode, branchId: scope.branchId, ticketId }).sort({ issuedAt: -1 }).lean(); }
export async function issueRepairPart(scope: RepairScope, ticketId: string, input: { productId: string; sku: string; productName: string; quantity: number; unitCost: number; unitPrice: number; serialNumbers?: string[]; idempotencyKey: string }, actor: RepairActor) {
  const key = String(input.idempotencyKey || "").trim(); if (!key) throw Object.assign(new Error("idempotencyKey là bắt buộc."), { statusCode: 400 });
  const existing = await RepairPartModel.findOne({ companyCode: scope.companyCode, idempotencyKey: key }).lean(); if (existing) return existing;
  const ticket: any = await RepairTicketModel.findOne({ _id: ticketId, ...scope }); if (!ticket) throw Object.assign(new Error("Không tìm thấy phiếu sửa chữa."), { statusCode: 404 });
  if (!["approved", "repairing"].includes(ticket.status)) throw Object.assign(new Error("Chỉ được xuất linh kiện khi phiếu đã được duyệt hoặc đang sửa."), { statusCode: 409 });
  const quantity = Number(input.quantity); if (!Number.isInteger(quantity) || quantity <= 0) throw Object.assign(new Error("Số lượng linh kiện không hợp lệ."), { statusCode: 400 });
  await writeStockMovement({ ...scope, direction: "out", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: key, operatorName: actor.name, items: [{ productId: input.productId, sku: input.sku, productName: input.productName, quantity, unitCost: Number(input.unitCost), unitPrice: Number(input.unitPrice), lineTotal: quantity * Number(input.unitPrice) }], reason: `Xuất linh kiện cho phiếu ${ticket.ticketCode}` });
  const part = await RepairPartModel.create({ ...input, companyCode: scope.companyCode, branchId: scope.branchId, ticketId, quantity, lineTotal: quantity * Number(input.unitPrice), status: "issued", issuedBy: actor.id, issuedByName: actor.name, issuedAt: new Date() });
  ticket.partCost = Number(ticket.partCost || 0) + quantity * Number(input.unitCost); ticket.totalAmount = Number(ticket.laborFee || 0) + ticket.partCost - Number(ticket.discountAmount || 0); ticket.dueAmount = Math.max(0, ticket.totalAmount - Number(ticket.paidAmount || 0)); await ticket.save(); return part.toObject();
}
export async function returnRepairPart(scope: RepairScope, ticketId: string, partId: string, reason: string, actor: RepairActor) {
  const note = String(reason || "").trim(); if (!note) throw Object.assign(new Error("Lý do hoàn linh kiện là bắt buộc."), { statusCode: 400 });
  const part: any = await RepairPartModel.findOne({ _id: partId, companyCode: scope.companyCode, branchId: scope.branchId, ticketId }); if (!part) throw Object.assign(new Error("Không tìm thấy linh kiện."), { statusCode: 404 });
  if (part.status !== "issued") throw Object.assign(new Error("Linh kiện đã được hoàn hoặc hủy."), { statusCode: 409 });
  await writeStockMovement({ ...scope, direction: "in", purpose: "other", sourceType: "repair-ticket", sourceId: ticketId, idempotencyKey: `repair:${ticketId}:part:${partId}:return`, operatorName: actor.name, items: [{ productId: part.productId, sku: part.sku, productName: part.productName, quantity: part.quantity, unitCost: part.unitCost, unitPrice: part.unitPrice, lineTotal: part.lineTotal }], reason: `Hoàn linh kiện phiếu ${ticketId}` });
  part.status = "returned"; part.returnedAt = new Date(); part.returnReason = note; part.updatedBy = actor.id; part.returnedByName = actor.name; await part.save(); return part.toObject();
}
