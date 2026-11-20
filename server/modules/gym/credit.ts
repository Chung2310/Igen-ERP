import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose, { Schema } from "mongoose";
import { WalletModel } from "../../model/wallet.model";
import { TransactionModel } from "../../model/transaction.model";
import { UserModel } from "../../model/user.model";

interface GymCreditReservationRecord { key: string; userId: string; reserved: number; charged: number; billingShortfall: number; status: "RESERVED" | "SETTLED" | "RELEASED" }
const reservationSchema = new Schema<GymCreditReservationRecord>({
  key: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  reserved: { type: Number, required: true },
  charged: { type: Number, default: 0 },
  billingShortfall: { type: Number, default: 0 },
  status: { type: String, enum: ["RESERVED", "SETTLED", "RELEASED"], required: true },
}, { timestamps: true });
const GymCreditReservation = (mongoose.models.GymCreditReservation as mongoose.Model<GymCreditReservationRecord> | undefined)
  ?? mongoose.model<GymCreditReservationRecord>("GymCreditReservation", reservationSchema);

export const gymCreditRouter = Router();

gymCreditRouter.use(async (request, response, next) => {
  try {
    const secret = process.env.GYM_BRIDGE_SECRET?.trim();
    if (!secret || secret.length < 32) return response.status(503).json({ message: "Cầu nối credit Gym chưa được cấu hình." });
    const token = /^Bearer (.+)$/i.exec(request.headers.authorization || "")?.[1];
    if (!token) return response.status(401).end();
    const claim = jwt.verify(token, secret, { issuer: "chuoi-gym", audience: "igen-erp-gym-credit", algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (typeof claim.erpUserId !== "string" || typeof claim.companyCode !== "string") return response.status(401).end();
    const user = await UserModel.findOne({ _id: claim.erpUserId, companyCode: claim.companyCode.toUpperCase() }).select("_id isActive disabledAt").lean();
    if (!user) return response.status(403).end();
    if (user.isActive !== true || user.disabledAt) {
      const reserved = request.path === "/release"
        && keyIsValid(request.body?.key)
        && await GymCreditReservation.exists({ key: request.body.key, userId: String(user._id), status: "RESERVED" });
      if (!reserved) return response.status(403).end();
    }
    response.locals.gymCreditUserId = String(user._id);
    next();
  } catch { response.status(401).end(); }
});

const amountIsValid = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000;
const keyIsValid = (value: unknown): value is string => typeof value === "string" && value.length >= 1 && value.length <= 200 && /^[a-zA-Z0-9:_-]+$/.test(value);

async function runOperation(userId: string, key: string, operation: "reserve" | "settle" | "release", amount: number) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existing = await GymCreditReservation.findOne({ key }).session(session);
      if (existing && existing.userId !== userId) throw Object.assign(new Error("Mã giao dịch đã thuộc tài khoản khác."), { status: 409 });
      if (operation === "reserve") {
        if (existing) return { status: existing.status, reserved: existing.reserved, charged: existing.charged, billingShortfall: existing.billingShortfall };
        await WalletModel.updateOne({ userId }, { $setOnInsert: { userId, balance: 0 } }, { upsert: true, session });
        const wallet = await WalletModel.findOneAndUpdate({ userId, balance: { $gte: amount } }, { $inc: { balance: -amount } }, { session, returnDocument: "after" });
        if (!wallet) throw Object.assign(new Error("Số dư Credit ERP không đủ."), { status: 402 });
        await GymCreditReservation.create([{ key, userId, reserved: amount, status: "RESERVED" }], { session });
        if (amount) await TransactionModel.create([{ userId, orderCode: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`), amount, type: "payment", status: "success", description: `Gym AI: tạm giữ ${amount} Credit`, idempotencyKey: `gym:reserve:${key}`, completedAt: new Date() }], { session });
        return { status: "RESERVED", reserved: amount, charged: 0 };
      }
      if (!existing) {
        if (operation === "release") {
          await GymCreditReservation.create([{ key, userId, reserved: 0, charged: 0, status: "RELEASED" }], { session });
          return { status: "RELEASED", reserved: 0, charged: 0 };
        }
        return { status: "MISSING", reserved: 0, charged: 0 };
      }
      if (existing.status !== "RESERVED") return { status: existing.status, reserved: existing.reserved, charged: existing.charged, billingShortfall: existing.billingShortfall };
      const actual = operation === "release" ? 0 : amount;
      const refund = Math.max(0, existing.reserved - actual);
      const extra = Math.max(0, actual - existing.reserved);
      let extraCharged = 0;
      if (extra) {
        const wallet = await WalletModel.findOne({ userId }).session(session);
        extraCharged = Math.min(extra, Math.floor(wallet?.balance || 0));
        if (extraCharged) await WalletModel.updateOne({ userId, balance: { $gte: extraCharged } }, { $inc: { balance: -extraCharged } }, { session });
      }
      if (refund) await WalletModel.updateOne({ userId }, { $inc: { balance: refund } }, { session });
      const charged = Math.min(existing.reserved, actual) + extraCharged;
      const billingShortfall = Math.max(0, actual - charged);
      const status = operation === "release" ? "RELEASED" : "SETTLED";
      await GymCreditReservation.updateOne({ _id: existing._id, status: "RESERVED" }, { $set: { status, charged, billingShortfall } }, { session });
      if (refund) await TransactionModel.create([{ userId, orderCode: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`), amount: refund, type: "deposit", status: "success", description: `Gym AI: hoàn ${refund} Credit`, idempotencyKey: `gym:refund:${key}`, completedAt: new Date() }], { session });
      if (extraCharged) await TransactionModel.create([{ userId, orderCode: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`), amount: extraCharged, type: "payment", status: "success", description: `Gym AI: quyết toán thêm ${extraCharged} Credit`, idempotencyKey: `gym:extra:${key}`, completedAt: new Date() }], { session });
      return { status, reserved: existing.reserved, charged, billingShortfall };
    });
  } finally { await session.endSession(); }
}

gymCreditRouter.post("/:operation", async (request, response) => {
  const operation = request.params.operation;
  const { key, amount } = request.body || {};
  if (!["reserve", "settle", "release"].includes(operation) || !keyIsValid(key) || !amountIsValid(amount)) return response.status(400).json({ message: "Giao dịch Credit không hợp lệ." });
  try {
    const result = await runOperation(response.locals.gymCreditUserId, key, operation as "reserve" | "settle" | "release", amount);
    response.json(result);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
    response.status(status >= 400 && status < 600 ? status : 500).json({ message: error instanceof Error ? error.message : "Không thể cập nhật Credit ERP." });
  }
});
