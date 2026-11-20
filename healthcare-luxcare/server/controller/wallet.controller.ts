import { logger } from "../config/logger";
import { Response } from "express";
import { payOS, isPayOSConfigured } from "../config/payos";
import { AuthenticatedRequest } from "../middleware/auth";
import { TransactionModel } from "../model/transaction.model";
import { WalletModel } from "../model/wallet.model";
import { walletService, expirePendingTransactions, TRANSACTION_EXPIRE_MS } from "../service/wallet.service";
import { getSePayConfig, getWalletPaymentProvider, verifySePayAuthorization } from "../config/sepay";
import { createSePayDeposit, receiveSePayTransfer } from "../service/sepay.service";
import { settlePendingAiCharges } from "../service/ai-billing.service";
import { creditConfirmedDeposit } from "../service/company-wallet.service";

export const walletController = {
  async getBalance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      // Reconcile known provider charges after a top-up; keep wallet access available
      // if provider metadata or the reconciliation database operation is unavailable.
      await settlePendingAiCharges(userId).catch(() => logger.warn("[AiBilling] Pending charges await reconciliation"));
      const wallet = await walletService.getOrCreateWallet(userId);

      return res.status(200).json({
        status: "success",
        balance: wallet.balance,
      });
    } catch (error: any) {
      logger.error("[walletController.getBalance] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy số dư ví",
        details: error.message,
      });
    }
  },

  async getTransactionHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (typeof TransactionModel.updateMany === "function") {
        await expirePendingTransactions(userId).catch((err) => {
          logger.error("[walletController.getTransactionHistory] Error expiring transactions:", err);
        });
      }

      const transactions = await TransactionModel.find({ userId }).sort({ createdAt: -1 });

      return res.status(200).json({
        status: "success",
        data: transactions,
      });
    } catch (error: any) {
      logger.error("[walletController.getTransactionHistory] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy lịch sử giao dịch",
        details: error.message,
      });
    }
  },

  async getAdminBalances(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = typeof req.query.companyCode === "string" ? req.query.companyCode : undefined;
      const data = await walletService.getAdminBalanceList({ companyCode });

      return res.status(200).json({
        status: "success",
        data,
      });
    } catch (error: any) {
      logger.error("[walletController.getAdminBalances] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể tải danh sách số dư người dùng",
        details: error.message,
      });
    }
  },

  async getAdminUserTransactions(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = typeof req.params.userId === "string" ? req.params.userId : "";
      const limit = Number(req.query.limit || 20);

      if (!userId) {
        return res.status(400).json({ status: "error", message: "Thiếu userId cần truy vấn." });
      }

      const data = await walletService.getAdminTransactionHistory({
        targetUserId: userId,
        limit,
      });

      return res.status(200).json({
        status: "success",
        data,
      });
    } catch (error: any) {
      logger.error("[walletController.getAdminUserTransactions] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể tải lịch sử giao dịch người dùng",
        details: error.message,
      });
    }
  },

  async adminSetBalance(req: AuthenticatedRequest, res: Response) {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const { userId, balance, note } = req.body || {};
      if (!userId) {
        return res.status(400).json({ status: "error", message: "Thiếu userId cần cập nhật." });
      }

      const normalizedBalance = Number(balance);
      if (!Number.isFinite(normalizedBalance) || normalizedBalance < 0) {
        return res.status(400).json({
          status: "error",
          message: "Số dư mới phải là số hợp lệ và không âm.",
        });
      }

      const data = await walletService.adminSetBalance({
        targetUserId: userId,
        balance: normalizedBalance,
        actorUserId,
        actorEmail: req.user?.email,
        note,
      });

      return res.status(200).json({
        status: "success",
        message: "Cập nhật số dư thành công.",
        data,
      });
    } catch (error: any) {
      logger.error("[walletController.adminSetBalance] Error:", error);
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        status: "error",
        message: error.message || "Không thể cập nhật số dư người dùng  ",
      });
    }
  },

  async createDepositLink(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      if (process.env.AI_COMPANY_WALLET_ENABLED === "true" && req.user?.companyCode && req.user.role !== "superadmin") {
        return res.status(409).json({ status: "error", message: "Công ty đang dùng ví Credit doanh nghiệp. Quản trị viên vui lòng nạp vào ví công ty." });
      }

      const amountVND = typeof req.body.amount === "number" || typeof req.body.amount === "string"
        ? Number(req.body.amount) : NaN;
      if (!Number.isSafeInteger(amountVND) || amountVND < 2000) {
        return res.status(400).json({
          status: "error",
          message: "Số tiền nạp tối thiểu là 2,000 VND.",
        });
      }

      if (getWalletPaymentProvider() === "sepay") {
        const data = await createSePayDeposit(userId, amountVND);
        return res.status(200).json({ status: "success", data });
      }

      if ((!isPayOSConfigured || !payOS) && process.env.NODE_ENV === "production") {
        return res.status(503).json({
          status: "error",
          message: "Nạp tiền trực tuyến chưa khả dụng. Vui lòng liên hệ quản trị viên.",
        });
      }

      const amountCredits = amountVND / 100; // 100 VND = 1 Credit

      let orderCode: number;
      let existing: any;
      do {
        orderCode = Math.floor(10000000 + Math.random() * 90000000);
        existing = await TransactionModel.findOne({ orderCode });
      } while (existing);

      const description = req.body.description || `Nạp tiền iGen: ${orderCode}`;
      const origin = req.headers.origin || req.headers.referer || "http://localhost:3000";
      const clientOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;

      const cancelUrl = `${clientOrigin}/vi-nap-tien?status=cancelled&orderCode=${orderCode}`;
      const returnUrl = `${clientOrigin}/vi-nap-tien?status=success&orderCode=${orderCode}`;

      let checkoutUrl = "";
      let paymentLinkId = "";

      if (isPayOSConfigured && payOS) {
        try {
          const paymentResult = await payOS.paymentRequests.create({
            orderCode,
            amount: amountVND,
            description: `Nap ${orderCode}`,
            cancelUrl,
            returnUrl,
          });
          checkoutUrl = paymentResult.checkoutUrl;
          paymentLinkId = paymentResult.paymentLinkId;
        } catch (payosErr: any) {
          logger.error("[PayOS SDK Error] Khong the tao link thanh toan:", payosErr);
          return res.status(500).json({
            status: "error",
            message: "Lỗi kết nối với cổng thanh toán. Vui lòng thử lại sau.",
            details: payosErr.message,
          });
        }
      } else {
        checkoutUrl = `${clientOrigin}/vi-nap-tien?mock=1&orderCode=${orderCode}&amount=${amountCredits}&amountVND=${amountVND}`;
        paymentLinkId = `mock_link_${orderCode}`;
      }

      const transaction = new TransactionModel({
        userId,
        orderCode,
        amount: amountCredits,
        type: "deposit",
        status: "pending",
        paymentLinkId,
        checkoutUrl,
        description,
        paymentProvider: isPayOSConfigured && payOS ? "payos" : "mock",
      });

      await transaction.save();

      return res.status(200).json({
        status: "success",
        data: {
          orderCode,
          amount: amountCredits,
          checkoutUrl,
          paymentLinkId,
          isMock: !isPayOSConfigured,
        },
      });
    } catch (error: any) {
      logger.error("[walletController.createDepositLink] Error:", error);
      return res.status(error.statusCode || 500).json({
        status: "error",
        message: error.statusCode === 503 ? error.message : "Không thể tạo yêu cầu nạp tiền",
      });
    }
  },

  async handleSePayWebhook(req: AuthenticatedRequest, res: Response) {
    try {
      const config = getSePayConfig();
      if (!verifySePayAuthorization(req.get("authorization"), config.webhookKey)) {
        return res.status(401).json({ success: false, message: "Webhook chưa được xác thực." });
      }
      const result = await receiveSePayTransfer(req.body);
      if (result === "unmatched") logger.warn("[Wallet webhook] Transfer does not match a pending deposit", { id: req.body.id });
      return res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error("[Wallet webhook] Failed", { code: error?.code, statusCode: error?.statusCode });
      return res.status(error.statusCode || 500).json({ success: false, message: "Chưa thể xử lý webhook." });
    }
  },

  async handlePayOSWebhook(req: AuthenticatedRequest, res: Response) {
    try {
      const webhookData = req.body;
      logger.info({ event: "payment.webhook.received", provider: "payos" });

      if (!isPayOSConfigured || !payOS) {
        return res.status(400).json({ status: "error", message: "PayOS chưa được cấu hình." });
      }

      let verifiedData: any;
      try {
        verifiedData = await payOS.webhooks.verify(webhookData);
      } catch (verifyErr: any) {
        logger.error("[PayOS Webhook] Xac thuc chu ky that bai:", verifyErr);
        return res.status(400).json({ status: "error", message: "Chữ ký webhook không hợp lệ." });
      }

      // PayOS gửi code "00" khi thanh toán thành công.
      // Các code khác (CANCELLED, EXPIRED...) không cộng tiền.
      const payosCode = String(webhookData.code || "");
      if (payosCode !== "00") {
        logger.info(`[PayOS Webhook] Webhook code=${payosCode}, bo qua khong cap nhat vi.`);
        return res.status(200).json({ status: "success", message: "Đã nhận webhook." });
      }

      const { orderCode, amount } = verifiedData;

      // PayOS gửi test request khi xác nhận webhook URL, orderCode=0 hoặc không có trong DB.
      const transaction = await TransactionModel.findOne({ orderCode, type: "deposit", paymentProvider: { $ne: "sepay" } });
      if (!transaction) {
        logger.info(`[PayOS Webhook] orderCode=${orderCode} khong tim thay (co the la test request). Tra 200 OK.`);
        return res.status(200).json({ status: "success", message: "Đã nhận webhook." });
      }

      if (!Number.isSafeInteger(amount) || amount !== Math.round(transaction.amount * 100)) {
        logger.error("[PayOS Webhook] Amount mismatch", { orderCode });
        return res.status(400).json({ status: "error", message: "Số tiền thanh toán không khớp giao dịch." });
      }

      if (transaction.status === "success") {
        logger.info(`[PayOS Webhook] Giao dich ${orderCode} da duoc cap nhat thanh cong truoc do.`);
        return res.status(200).json({ status: "success", message: "Giao dịch đã hoàn tất." });
      }

      const credited = await creditConfirmedDeposit(transaction._id as any);
      if (!credited) {
        const latest = await TransactionModel.findById(transaction._id).select("status").lean();
        if (latest?.status !== "success") return res.status(409).json({ status: "error", message: "Giao dịch không còn chờ xử lý." });
      }

      logger.info({ event: "payment.deposit.completed", provider: "payos", orderCode, userId: String(transaction.userId) });

      return res.status(200).json({
        status: "success",
        message: "Cộng tiền ví thành công",
      });
    } catch (error: any) {
      logger.error("[walletController.handlePayOSWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xử lý webhook nạp tiền",
        details: error.message,
      });
    }
  },

  async handleMockWebhook(req: AuthenticatedRequest, res: Response) {
    try {
      // Endpoint giả lập chỉ tồn tại để test khi chưa cấu hình PayOS thật, và
      // không bao giờ được phép chạy ở production (tránh cộng tiền ví miễn phí).
      if (process.env.NODE_ENV === "production" || isPayOSConfigured || getWalletPaymentProvider() === "sepay") {
        return res.status(404).json({ status: "error", message: "Không tìm thấy endpoint." });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const { orderCode } = req.body;
      if (!orderCode) {
        return res.status(400).json({ status: "error", message: "Thiếu orderCode." });
      }

      // Chỉ được tự xác nhận giao dịch của chính mình.
      const transaction = await TransactionModel.findOne({ orderCode, userId, type: "deposit",
        payerType: { $ne: "company" }, paymentProvider: { $ne: "sepay" }, paymentLinkId: /^mock_link_/ });
      if (!transaction) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy giao dịch." });
      }

      if (transaction.status === "success") {
        return res.status(200).json({ status: "success", message: "Giao dịch đã được thanh toán trước đó." });
      }

      transaction.status = "success";
      transaction.completedAt = new Date();
      await transaction.save();

      await WalletModel.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" },
      );

      logger.info({ event: "payment.deposit.completed", provider: "mock", userId: String(transaction.userId), transactionId: String(transaction._id) });

      return res.status(200).json({
        status: "success",
        message: "Xác nhận thanh toán giả lập thành công",
      });
    } catch (error: any) {
      logger.error("[walletController.handleMockWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xử lý giả lập thanh toán",
        details: error.message,
      });
    }
  },

  async checkTransactionStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const orderCode = parseInt(req.params.orderCode, 10);

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const transaction = await TransactionModel.findOne({ orderCode, userId, payerType: { $ne: "company" }, type: "deposit" });
      if (!transaction) {
        return res.status(404).json({ status: "error", message: "Giao dịch không tồn tại." });
      }

      if (transaction.status === "success") {
        return res.status(200).json({
          status: "success",
          transactionStatus: "success",
          amount: transaction.amount,
          paymentProvider: transaction.paymentProvider,
          bankTransfer: transaction.bankTransfer,
          createdAt: transaction.createdAt,
        });
      }

      if (transaction.status === "pending" && transaction.createdAt) {
        const timeoutMs = TRANSACTION_EXPIRE_MS || 15 * 60 * 1000;
        const elapsed = Date.now() - new Date(transaction.createdAt).getTime();
        if (elapsed > timeoutMs) {
          transaction.status = "failed";
          if (typeof transaction.save === "function") {
            await transaction.save();
          }
          return res.status(200).json({
            status: "success",
            transactionStatus: "failed",
            amount: transaction.amount,
            paymentProvider: transaction.paymentProvider,
            bankTransfer: transaction.bankTransfer,
            createdAt: transaction.createdAt,
            message: "Giao dịch đã hết hạn sau 15 phút và tự động chuyển sang thất bại.",
          });
        }
      }

      if (transaction.paymentProvider !== "sepay" && isPayOSConfigured && payOS) {
        try {
          const payosStatus: any = await payOS.paymentRequests.get(transaction.orderCode);
          if (payosStatus.status === "PAID") {
            transaction.status = "success";
            transaction.completedAt = new Date();
            await transaction.save();

            await WalletModel.findOneAndUpdate(
              { userId: transaction.userId },
              { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } },
              { upsert: true, returnDocument: "after" },
            );

            return res.status(200).json({
              status: "success",
              transactionStatus: "success",
              amount: transaction.amount,
              createdAt: transaction.createdAt,
            });
          }

          if (payosStatus.status === "CANCELLED") {
            transaction.status = "failed";
            await transaction.save();
            return res.status(200).json({
              status: "success",
              transactionStatus: "failed",
              createdAt: transaction.createdAt,
            });
          }
        } catch (checkErr) {
          logger.error(`[PayOS Status Query Err] orderCode: ${orderCode}`, checkErr);
        }
      }

      return res.status(200).json({
        status: "success",
        transactionStatus: transaction.status,
        paymentProvider: transaction.paymentProvider,
        bankTransfer: transaction.bankTransfer,
        createdAt: transaction.createdAt,
      });
    } catch (error: any) {
      logger.error("[walletController.checkTransactionStatus] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi kiểm tra trạng thái giao dịch",
        details: error.message,
      });
    }
  },
};
