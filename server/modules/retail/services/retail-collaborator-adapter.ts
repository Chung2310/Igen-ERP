import { Types, type ClientSession } from "mongoose";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { RetailOrderModel } from "../models/retail-order.model";
import { RetailAfterSaleModel } from "../models/retail-after-sale.model";
import { accrueOrderCommission, reverseOrderCommission } from "./retail-commission.service";

export async function resolveCollaborator(companyCode: string, collaboratorId: unknown, session?: ClientSession, _branchId?: string): Promise<any> {
  const id = String(collaboratorId || "").trim();
  if (!id) return undefined;
  if (!Types.ObjectId.isValid(id)) throw Object.assign(new Error("Mã cộng tác viên không hợp lệ."), { status: 400 });
  const partner = await RetailPartnerModel.findOne({ _id: id, companyCode, roles: "collaborator", status: "active" })
    .session(session || null).lean();
  if (!partner) throw Object.assign(new Error("Cộng tác viên không hoạt động hoặc không thuộc công ty."), { status: 400 });
  return partner;
}

export async function snapshotRetail(order: any, session?: ClientSession): Promise<any> {
  const partner = await resolveCollaborator(order.companyCode, order.collaboratorId || order.retailPartnerId, session, order.branchId);
  if (!partner) return undefined;
  const snapshot = { partnerId: String(partner._id), code: partner.code, name: partner.name };
  order.retailPartnerId = snapshot.partnerId;
  order.retailPartnerSnapshot = snapshot;
  return snapshot;
}

/** Share the ERP commission ledger with the imported POS; every posting has a stable source key. */
export async function reconcileCommission(sourceType: "retail" | "repair", sourceId: string, companyCode: string, session?: ClientSession): Promise<void> {
  if (sourceType !== "retail") return;
  const order = await RetailOrderModel.findOne({ _id: sourceId, companyCode }).session(session || null).lean();
  if (!order?.retailPartnerId) return;
  const scope = { companyCode, branchId: order.branchId };
  if (order.status === "cancelled") {
    await reverseOrderCommission(scope, order, `order:${sourceId}:cancel`, null, session);
    return;
  }
  if (order.status !== "completed") return;
  await accrueOrderCommission(scope, order, session);
  const returns = await RetailAfterSaleModel.find({ ...scope, orderId: sourceId, type: "return" }).sort({ createdAt: 1, _id: 1 }).session(session || null).lean();
  for (const doc of returns) {
    const ratios = new Map<number, number>();
    for (const item of doc.items) {
      const quantity = Number(order.items[item.orderLineIndex]?.quantity || 0);
      if (quantity > 0) ratios.set(item.orderLineIndex, (ratios.get(item.orderLineIndex) || 0) + item.quantity / quantity);
    }
    await reverseOrderCommission(scope, order, `return:${doc._id}`, ratios, session);
  }
}
