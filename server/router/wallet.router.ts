import { Router } from "express";
import { walletController } from "../controller/wallet.controller";
import { requireAuth, requireRole } from "../middleware/auth";

export const walletRouter = Router();

walletRouter.get("/balance", requireAuth, walletController.getBalance);
walletRouter.get("/admin/balances", requireAuth, requireRole(["superadmin"]), walletController.getAdminBalances);
walletRouter.get("/admin/transactions/:userId", requireAuth, requireRole(["superadmin"]), walletController.getAdminUserTransactions);
walletRouter.post("/admin/balance", requireAuth, requireRole(["superadmin"]), walletController.adminSetBalance);
walletRouter.get("/transactions", requireAuth, requireRole(["superadmin"]), walletController.getTransactionHistory);
walletRouter.post("/deposit", requireAuth, requireRole(["superadmin"]), walletController.createDepositLink);
walletRouter.post("/webhook", walletController.handlePayOSWebhook);
walletRouter.post("/webhook-mock", requireAuth, requireRole(["superadmin"]), walletController.handleMockWebhook);
walletRouter.get("/check/:orderCode", requireAuth, requireRole(["superadmin"]), walletController.checkTransactionStatus);
