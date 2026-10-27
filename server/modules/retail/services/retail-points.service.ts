import mongoose, { type ClientSession, Types } from "mongoose";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailPointLedgerModel, type RetailPointLedger } from "../models/retail-point-ledger.model";
import { RetailPointPolicyModel } from "../models/retail-point-policy.model";

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const positiveInteger = (value: unknown, label: string) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw invalid(`${label} phải là số nguyên dương.`);
  return number;
};
export const defaultPointPolicy = { enabled: false, earnVndPerPoint: 10000, redeemVndPerPoint: 1000, maxRedeemPercent: 50, version: 0 };

export async function getPointPolicy(companyCode: string) {
  return await RetailPointPolicyModel.findOne({ companyCode }).lean() || { companyCode, ...defaultPointPolicy };
}
export async function updatePointPolicy(companyCode: string, input: any, actorId: string) {
  const earnVndPerPoint = positiveInteger(input.earnVndPerPoint, "Mức tiền tích một điểm");
  const redeemVndPerPoint = positiveInteger(input.redeemVndPerPoint, "Giá trị một điểm");
  const maxRedeemPercent = Number(input.maxRedeemPercent);
  if (!Number.isFinite(maxRedeemPercent) || maxRedeemPercent < 0 || maxRedeemPercent > 100) throw invalid("Tỷ lệ tiêu điểm tối đa phải từ 0 đến 100%.");
  if (!Number.isSafeInteger(input.version)) throw invalid("Phiên bản chính sách không hợp lệ.");
  const current = await getPointPolicy(companyCode);
  if (current.version !== input.version) throw invalid("Chính sách điểm đã thay đổi.", 409);
  if (!("_id" in current)) {
    try { return await RetailPointPolicyModel.create({ companyCode, enabled: input.enabled === true, earnVndPerPoint, redeemVndPerPoint, maxRedeemPercent, version: 1, updatedBy: actorId }); }
    catch (error: any) { if (error?.code === 11000) throw invalid("Chính sách điểm đã thay đổi.", 409); throw error; }
  }
  return RetailPointPolicyModel.findOneAndUpdate({ companyCode, version: input.version },
    { $set: { enabled: input.enabled === true, earnVndPerPoint, redeemVndPerPoint, maxRedeemPercent, updatedBy: actorId }, $inc: { version: 1 } },
    { returnDocument: "after" });
}

export async function quotePointRedemption(companyCode: string, customerId: string | undefined, points: unknown, subtotalAfterDiscount: number, session?: ClientSession) {
  const requested = Number(points || 0);
  if (!Number.isSafeInteger(requested) || requested < 0) throw invalid("Số điểm sử dụng không hợp lệ.");
  if (!requested) return { points: 0, amount: 0 };
  if (!customerId || !Types.ObjectId.isValid(customerId)) throw invalid("Vui lòng chọn khách hàng để sử dụng điểm.");
  const policy = await getPointPolicy(companyCode);
  if (!policy.enabled) throw invalid("Chương trình điểm thưởng chưa bật.", 409);
  const customer = await CustomerModel.findOne({ _id: customerId, companyCode, status: "active" }).session(session ?? null).lean();
  if (!customer) throw invalid("Không tìm thấy khách hàng đang hoạt động.", 404);
  if (Number(customer.pointsBalance || 0) < requested) throw invalid("Khách không đủ điểm để sử dụng.", 409);
  const amount = requested * policy.redeemVndPerPoint;
  if (!Number.isSafeInteger(amount) || amount > subtotalAfterDiscount || amount * 100 > subtotalAfterDiscount * policy.maxRedeemPercent) throw invalid("Giá trị điểm vượt hạn mức của đơn hàng.", 409);
  return { points: requested, amount };
}

export async function postPoints(input: Omit<RetailPointLedger, "balanceBefore" | "balanceAfter">, session: ClientSession) {
  if (!Number.isSafeInteger(input.points) || input.points === 0) throw invalid("Số điểm phát sinh không hợp lệ.");
  if (!input.reason.trim()) throw invalid("Lý do phát sinh điểm là bắt buộc.");
  const existing = await RetailPointLedgerModel.findOne({ companyCode: input.companyCode, sourceKey: input.sourceKey }).session(session).lean();
  if (existing) {
    if (existing.customerId !== input.customerId || existing.points !== input.points || existing.reason !== input.reason || existing.type !== input.type) throw invalid("Khóa yêu cầu đã được dùng cho phát sinh điểm khác.", 409);
    return existing;
  }
  const customer = await CustomerModel.findOne({ _id: input.customerId, companyCode: input.companyCode }).session(session).lean();
  if (!customer) throw invalid("Không tìm thấy khách hàng.", 404);
  const balanceBefore = Number(customer.pointsBalance || 0);
  const balanceAfter = balanceBefore + input.points;
  if (input.type === "redeem" && balanceAfter < 0) throw invalid("Khách không đủ điểm để sử dụng.", 409);
  if (!Number.isSafeInteger(balanceAfter)) throw invalid("Số dư điểm vượt giới hạn.");
  const balanceFilter = customer.pointsBalance === undefined ? { pointsBalance: { $exists: false } } : { pointsBalance: balanceBefore };
  const updated = await CustomerModel.updateOne({ _id: input.customerId, companyCode: input.companyCode, ...balanceFilter }, {
    $inc: { pointsBalance: input.points, ...(input.type === "earn" ? { totalPointsEarned: input.points } : {}), ...(input.type === "redeem" ? { totalPointsRedeemed: -input.points } : {}) },
  }, { session });
  if (updated.modifiedCount !== 1) throw invalid("Số dư điểm vừa thay đổi. Vui lòng thử lại.", 409);
  const [ledger] = await RetailPointLedgerModel.create([{ ...input, balanceBefore, balanceAfter }], { session });
  return ledger;
}

export async function earnOrderPoints(scope: { companyCode: string; branchId: string }, order: any, session: ClientSession) {
  if (!order.customerId || order.status !== "completed" || order.paymentStatus !== "paid") return;
  const policy = await getPointPolicy(scope.companyCode);
  if (!policy.enabled) return;
  const points = Math.floor(Math.max(0, Number(order.grandTotal) - Number(order.refundedAmount || 0)) / policy.earnVndPerPoint);
  if (points > 0) await postPoints({ ...scope, customerId: String(order.customerId), sourceKey: `order:${order._id}:earn`, sourceId: String(order._id), type: "earn", points, reason: "Tích điểm đơn bán lẻ", actorId: "system" }, session);
}

export async function reverseOrderPoints(scope: { companyCode: string; branchId: string }, order: any, sourceKey: string, refundAmount: number, actorId: string, session: ClientSession) {
  if (!order.customerId) return;
  const earned = await RetailPointLedgerModel.findOne({ companyCode: scope.companyCode, sourceKey: `order:${order._id}:earn` }).session(session).lean();
  if (earned) {
    const prior = await RetailPointLedgerModel.aggregate<{ points: number }>([
      { $match: { companyCode: scope.companyCode, sourceId: String(order._id), type: "refund_earn" } }, { $group: { _id: null, points: { $sum: "$points" } } },
    ]).session(session);
    const available = Math.max(0, earned.points + Number(prior[0]?.points || 0));
    const reverse = sourceKey.endsWith(":cancel") ? available : Math.min(available, Math.round(earned.points * refundAmount / Number(order.grandTotal || 1)));
    if (reverse > 0) await postPoints({ ...scope, customerId: String(order.customerId), sourceKey: `${sourceKey}:earn`, sourceId: String(order._id), type: "refund_earn", points: -reverse, reason: "Đảo điểm theo hoàn/hủy đơn", actorId }, session);
  }
  const redeemed = Number(order.pointsRedeemed || 0);
  if (redeemed > 0) {
    const prior = await RetailPointLedgerModel.aggregate<{ points: number }>([
      { $match: { companyCode: scope.companyCode, sourceId: String(order._id), type: "refund_redeem" } }, { $group: { _id: null, points: { $sum: "$points" } } },
    ]).session(session);
    const available = Math.max(0, redeemed - Number(prior[0]?.points || 0));
    const refund = sourceKey.endsWith(":cancel") ? available : Math.min(available, Math.round(redeemed * refundAmount / Number(order.grandTotal || 1)));
    if (refund > 0) await postPoints({ ...scope, customerId: String(order.customerId), sourceKey: `${sourceKey}:redeem`, sourceId: String(order._id), type: "refund_redeem", points: refund, reason: "Hoàn điểm theo hoàn/hủy đơn", actorId }, session);
  }
}

export async function adjustCustomerPoints(companyCode: string, customerId: string, points: number, reason: string, actorId: string, idempotencyKey: string) {
  if (!Types.ObjectId.isValid(customerId)) throw invalid("Khách hàng không hợp lệ.");
  if (!Number.isSafeInteger(points) || points === 0 || !reason?.trim()) throw invalid("Số điểm và lý do điều chỉnh là bắt buộc.");
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw invalid("Khóa chống gửi lặp của điều chỉnh điểm không hợp lệ.");
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await postPoints({ companyCode, customerId, sourceKey: `adjust:${idempotencyKey}`, type: "adjust", points, reason: reason.trim(), actorId }, session);
    });
    return result;
  } finally { await session.endSession(); }
}
