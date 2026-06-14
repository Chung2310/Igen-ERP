import { Router } from "express";
import { walletController } from "../controller/wallet.controller";
import { requireAuth } from "../middleware/auth";

export const walletRouter = Router();

// Endpoint lấy số dư ví
walletRouter.get("/balance", requireAuth, walletController.getBalance);

// Endpoint lấy lịch sử giao dịch
walletRouter.get("/transactions", requireAuth, walletController.getTransactionHistory);

// Endpoint tạo link thanh toán nạp tiền
walletRouter.post("/deposit", requireAuth, walletController.createDepositLink);

// Endpoint nhận Webhook từ PayOS (gọi công khai từ PayOS Server)
walletRouter.post("/webhook", walletController.handlePayOSWebhook);

// Endpoint giả lập webhook nạp tiền thành công (chỉ cho Mock Mode)
walletRouter.post("/webhook-mock", requireAuth, walletController.handleMockWebhook);

// Endpoint kiểm tra trạng thái giao dịch
walletRouter.get("/check/:orderCode", requireAuth, walletController.checkTransactionStatus);
