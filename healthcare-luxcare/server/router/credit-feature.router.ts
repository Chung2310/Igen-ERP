import { Router } from "express";
import { AI_CREDITS_ENABLED } from "../../shared/features";
import { walletRouter } from "./wallet.router";
import { companyWalletRouter } from "./company-wallet.router";

export const creditFeatureRouter = Router();
if (AI_CREDITS_ENABLED) {
  creditFeatureRouter.use("/wallet", walletRouter);
  creditFeatureRouter.use("/company-wallet", companyWalletRouter);
} else {
  // Old clients, saved links and callbacks cannot initiate or complete payments.
  creditFeatureRouter.use(["/wallet", "/company-wallet"], (_req, res) => {
    res.status(410).json({ status: "error", code: "FEATURE_DISABLED", message: "Tính năng này đang tạm ngừng." });
  });
}
