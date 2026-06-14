import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { WalletModel } from "../model/wallet.model";
import { TransactionModel } from "../model/transaction.model";
import { payOS, isPayOSConfigured } from "../config/payos";

// Tỷ giá quy đổi cố định: 1 USD = 25,400 VND
const EXCHANGE_RATE = 25400;

export const walletController = {
  /**
   * GET /api/v1/wallet/balance
   * Lấy số dư ví hiện tại của người dùng
   */
  async getBalance(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      let wallet = await WalletModel.findOne({ userId });
      if (!wallet) {
        // Khởi tạo ví mới nếu chưa tồn tại
        wallet = new WalletModel({ userId, balance: 0 });
        await wallet.save();
      }

      return res.status(200).json({
        status: "success",
        balance: wallet.balance,
      });
    } catch (error: any) {
      console.error("[walletController.getBalance] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy số dư ví",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wallet/transactions
   * Lấy danh sách lịch sử giao dịch của người dùng
   */
  async getTransactionHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const transactions = await TransactionModel.find({ userId }).sort({ createdAt: -1 });

      return res.status(200).json({
        status: "success",
        data: transactions,
      });
    } catch (error: any) {
      console.error("[walletController.getTransactionHistory] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy lịch sử giao dịch",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wallet/deposit
   * Tạo link thanh toán nạp tiền vào ví
   */
  async createDepositLink(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      // Số tiền nạp ở đây được coi là USD
      const amount = parseFloat(req.body.amount);
      if (isNaN(amount) || amount < 0.1) {
        return res.status(400).json({
          status: "error",
          message: "Số tiền nạp tối thiểu là 0.1 USD.",
        });
      }

      // Quy đổi số tiền USD sang VND để thanh toán qua PayOS (yêu cầu tối thiểu 2,000 VND)
      const amountVND = Math.round(amount * EXCHANGE_RATE);
      if (amountVND < 2000) {
        return res.status(400).json({
          status: "error",
          message: "Số tiền nạp sau quy đổi phải đạt tối thiểu 2,000 VND.",
        });
      }

      // Tạo mã đơn hàng độc nhất dạng số nguyên 32-bit (khoảng 8 chữ số)
      let orderCode: number;
      let existing: any;
      do {
        orderCode = Math.floor(10000000 + Math.random() * 90000000);
        existing = await TransactionModel.findOne({ orderCode });
      } while (existing);

      const description = req.body.description || `Nap tien iGen: ${orderCode}`;

      // Lấy origin của client để cấu hình redirect URL
      const origin = req.headers.origin || req.headers.referer || "http://localhost:3000";
      // Chuẩn hóa origin tránh có dấu gạch chéo cuối cùng
      const clientOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;

      const cancelUrl = `${clientOrigin}/vi-nap-tien?status=cancelled&orderCode=${orderCode}`;
      const returnUrl = `${clientOrigin}/vi-nap-tien?status=success&orderCode=${orderCode}`;

      let checkoutUrl = "";
      let paymentLinkId = "";

      if (isPayOSConfigured && payOS) {
        // 1. Tạo link thanh toán thực qua cổng PayOS (sử dụng số tiền VND quy đổi)
        try {
          const paymentResult = await payOS.paymentRequests.create({
            orderCode,
            amount: amountVND,
            description: `Nap ${orderCode}`, // PayOS giới hạn ký tự latin không dấu và không chứa ký tự đặc biệt
            cancelUrl,
            returnUrl,
          });
          checkoutUrl = paymentResult.checkoutUrl;
          paymentLinkId = paymentResult.paymentLinkId;
        } catch (payosErr: any) {
          console.error("[PayOS SDK Error] Không thể tạo link thanh toán:", payosErr);
          return res.status(500).json({
            status: "error",
            message: "Lỗi kết nối với cổng thanh toán PayOS. Vui lòng thử lại sau.",
            details: payosErr.message,
          });
        }
      } else {
        // 2. Chế độ Mock Mode (chuyền cả giá trị USD và VND quy đổi sang frontend)
        checkoutUrl = `${clientOrigin}/vi-nap-tien?mock=1&orderCode=${orderCode}&amount=${amount}&amountVND=${amountVND}`;
        paymentLinkId = `mock_link_${orderCode}`;
      }

      // Lưu giao dịch vào DB ở trạng thái pending
      const transaction = new TransactionModel({
        userId,
        orderCode,
        amount,
        type: "deposit",
        status: "pending",
        paymentLinkId,
        checkoutUrl,
        description,
      });

      await transaction.save();

      return res.status(200).json({
        status: "success",
        data: {
          orderCode,
          amount,
          checkoutUrl,
          paymentLinkId,
          isMock: !isPayOSConfigured,
        },
      });
    } catch (error: any) {
      console.error("[walletController.createDepositLink] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể tạo yêu cầu nạp tiền",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wallet/webhook
   * Webhook nhận tín hiệu thanh toán từ PayOS
   */
  async handlePayOSWebhook(req: AuthenticatedRequest, res: Response) {
    try {
      const webhookData = req.body;
      console.log("[PayOS Webhook] Nhận request:", JSON.stringify(webhookData));

      if (!isPayOSConfigured || !payOS) {
        return res.status(400).json({ status: "error", message: "PayOS chưa được cấu hình." });
      }

      // Xác minh chữ ký dữ liệu từ PayOS
      let verifiedData: any;
      try {
        verifiedData = await payOS.webhooks.verify(webhookData);
      } catch (verifyErr: any) {
        console.error("[PayOS Webhook] Xác thực chữ ký thất bại:", verifyErr);
        return res.status(400).json({ status: "error", message: "Chữ ký webhook không hợp lệ." });
      }

      const { orderCode, amount } = verifiedData;

      // Tìm giao dịch khớp với orderCode và còn ở trạng thái pending
      const transaction = await TransactionModel.findOne({ orderCode });
      if (!transaction) {
        console.warn(`[PayOS Webhook] Không tìm thấy giao dịch với mã orderCode: ${orderCode}`);
        return res.status(404).json({ status: "error", message: "Giao dịch không tồn tại." });
      }

      if (transaction.status === "success") {
        console.log(`[PayOS Webhook] Giao dịch ${orderCode} đã được cập nhật thành công trước đó.`);
        return res.status(200).json({ status: "success", message: "Giao dịch đã hoàn tất." });
      }

      // Cập nhật giao dịch thành công
      transaction.status = "success";
      transaction.completedAt = new Date();
      await transaction.save();

      // Cộng tiền vào ví của người dùng theo giá trị gốc USD của giao dịch
      await WalletModel.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );

      console.log(`[PayOS Webhook] Nạp tiền thành công cho User ID: ${transaction.userId}, Số tiền: +$${transaction.amount} USD (${amount} VND)`);

      return res.status(200).json({
        status: "success",
        message: "Cộng tiền ví thành công",
      });
    } catch (error: any) {
      console.error("[walletController.handlePayOSWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xử lý webhook nạp tiền",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/wallet/webhook-mock
   * API Giả lập thanh toán thành công (Dành riêng cho Mock Mode khi không cấu hình API Keys)
   */
  async handleMockWebhook(req: AuthenticatedRequest, res: Response) {
    try {
      const { orderCode } = req.body;
      if (!orderCode) {
        return res.status(400).json({ status: "error", message: "Thiếu orderCode." });
      }

      const transaction = await TransactionModel.findOne({ orderCode });
      if (!transaction) {
        return res.status(404).json({ status: "error", message: "Không tìm thấy giao dịch." });
      }

      if (transaction.status === "success") {
        return res.status(200).json({ status: "success", message: "Giao dịch đã được thanh toán trước đó." });
      }

      // Cập nhật giao dịch thành công
      transaction.status = "success";
      transaction.completedAt = new Date();
      await transaction.save();

      // Cộng tiền vào ví của người dùng
      await WalletModel.findOneAndUpdate(
        { userId: transaction.userId },
        { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );

      console.log(`[Mock Webhook] Cộng tiền giả lập thành công: +${transaction.amount} VND cho User ${transaction.userId}`);

      return res.status(200).json({
        status: "success",
        message: "Xác nhận thanh toán giả lập thành công",
      });
    } catch (error: any) {
      console.error("[walletController.handleMockWebhook] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi xử lý giả lập thanh toán",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/wallet/check/:orderCode
   * Kiểm tra thủ công trạng thái giao dịch
   */
  async checkTransactionStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const orderCode = parseInt(req.params.orderCode, 10);

      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const transaction = await TransactionModel.findOne({ orderCode, userId });
      if (!transaction) {
        return res.status(404).json({ status: "error", message: "Giao dịch không tồn tại." });
      }

      // Nếu trạng thái của DB là success, trả về luôn
      if (transaction.status === "success") {
        return res.status(200).json({
          status: "success",
          transactionStatus: "success",
          amount: transaction.amount,
        });
      }

      // Nếu PayOS được cấu hình, có thể kiểm tra trực tiếp từ cổng PayOS đề phòng webhook bị rớt
      if (isPayOSConfigured && payOS) {
        try {
          const payosStatus: any = await payOS.paymentRequests.get(transaction.orderCode);
          if (payosStatus.status === "PAID") {
            transaction.status = "success";
            transaction.completedAt = new Date();
            await transaction.save();

            // Cộng tiền
            await WalletModel.findOneAndUpdate(
              { userId: transaction.userId },
              { $inc: { balance: transaction.amount }, $set: { updatedAt: new Date() } },
              { upsert: true, returnDocument: "after" }
            );

            return res.status(200).json({
              status: "success",
              transactionStatus: "success",
              amount: transaction.amount,
            });
          } else if (payosStatus.status === "CANCELLED") {
            transaction.status = "failed";
            await transaction.save();
            return res.status(200).json({
              status: "success",
              transactionStatus: "failed",
            });
          }
        } catch (checkErr) {
          console.error(`[PayOS Status Query Err] orderCode: ${orderCode}`, checkErr);
        }
      }

      return res.status(200).json({
        status: "success",
        transactionStatus: transaction.status,
      });
    } catch (error: any) {
      console.error("[walletController.checkTransactionStatus] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi kiểm tra trạng thái giao dịch",
        details: error.message,
      });
    }
  },
};
