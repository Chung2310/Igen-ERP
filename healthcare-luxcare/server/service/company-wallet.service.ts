import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import { payOS, isPayOSConfigured } from "../config/payos";
import { getWalletPaymentProvider } from "../config/sepay";
import { CompanyWalletModel } from "../model/ai-access.model";
import { TransactionModel } from "../model/transaction.model";
import { WalletModel } from "../model/wallet.model";
import { createSePayDeposit } from "./sepay.service";
import { settlePendingCompanyAiCharges } from "./ai-billing.service";

export async function creditConfirmedDeposit(transactionId: mongoose.Types.ObjectId) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const transaction = await TransactionModel.findOne({ _id: transactionId, type: "deposit", status: "pending" }).session(session);
      if (!transaction) return false;
      const claimed = await TransactionModel.updateOne({ _id: transaction._id, status: "pending" },
        { $set: { status: "success", completedAt: new Date() } }, { session });
      if (claimed.modifiedCount !== 1) return false;
      if (transaction.payerType === "company" && !transaction.payerId) throw new Error("Giao dịch doanh nghiệp thiếu mã công ty.");
      if (transaction.payerType === "company") {
        await CompanyWalletModel.updateOne({ companyCode: transaction.payerId },
          { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } }, { upsert: true, session });
      } else {
        await WalletModel.updateOne({ userId: transaction.userId },
          { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } }, { upsert: true, session });
      }
      return true;
    });
  } finally { await session.endSession(); }
}

export async function companyWalletStatus(companyCode: string) {
  await settlePendingCompanyAiCharges(companyCode);
  const wallet = await CompanyWalletModel.findOne({ companyCode }).lean();
  const transactions = await TransactionModel.find({ payerType: "company", payerId: companyCode })
    .sort({ createdAt: -1 }).limit(30).select("amount type status description createdAt completedAt orderCode aiUsage paymentProvider bankTransfer checkoutUrl").lean();
  return { companyCode, balance: wallet?.balance || 0, transactions };
}

export async function createCompanyDeposit(userId: string, companyCode: string, amountVND: number) {
  if (!Number.isSafeInteger(amountVND) || amountVND < 2000 || amountVND > 100_000_000)
    throw Object.assign(new Error("Số tiền nạp phải từ 2.000 đến 100.000.000 VND."), { statusCode: 400 });
  if (getWalletPaymentProvider() === "sepay")
    return createSePayDeposit(userId, amountVND, { payerType: "company", payerId: companyCode });
  if (!isPayOSConfigured || !payOS) throw Object.assign(new Error("Nạp Credit cho công ty chưa được cấu hình."), { statusCode: 503 });
  const base = String(process.env.APP_URL || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(base) && process.env.NODE_ENV === "production")
    throw Object.assign(new Error("APP_URL phải dùng HTTPS để tạo thanh toán."), { statusCode: 503 });
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = randomInt(10000000, 100000000);
    if (await TransactionModel.exists({ orderCode })) continue;
    const result = await payOS.paymentRequests.create({ orderCode, amount: amountVND,
      description: `Nap ${orderCode}`, cancelUrl: `${base}/company-wallet?status=cancelled&orderCode=${orderCode}`,
      returnUrl: `${base}/company-wallet?status=success&orderCode=${orderCode}` });
    try {
      await TransactionModel.create({ userId, payerType: "company", payerId: companyCode, orderCode,
        amount: amountVND / 100, type: "deposit", status: "pending", paymentProvider: "payos",
        paymentLinkId: result.paymentLinkId, checkoutUrl: result.checkoutUrl,
        description: `Doanh nghiệp ${companyCode} nạp Credit` });
      return { orderCode, amount: amountVND / 100, checkoutUrl: result.checkoutUrl,
        paymentLinkId: result.paymentLinkId, isMock: false, paymentProvider: "payos" as const };
    } catch (error: any) { if (error?.code !== 11000) throw error; }
  }
  throw Object.assign(new Error("Không thể tạo mã nạp tiền."), { statusCode: 503 });
}
