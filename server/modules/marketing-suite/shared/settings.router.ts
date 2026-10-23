import { Router, type RequestHandler } from "express";
import { UserModel, AiAutoReplyConfigSchema } from "../../../model/user.model";
import { authController } from "./controller/auth.controller";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/auth";

export const marketingSettingsRouter = Router();
marketingSettingsRouter.get("/authors/:id", async (request, res, next) => {
  try {
    const req = request as AuthenticatedRequest;
    const user = await UserModel.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).select("facebookIntegration zaloIntegration tiktokIntegration").lean();
    if (!user) return res.status(404).json({ status: "error", message: "Không tìm thấy tác giả." });
    const data = JSON.parse(JSON.stringify(user));
    for (const name of ["facebookIntegration", "zaloIntegration", "tiktokIntegration"]) {
      if (data[name]) for (const field of ["accessToken", "pageAccessToken", "refreshToken", "appSecret", "verifyToken"]) delete data[name][field];
    }
    return res.json({ status: "success", data });
  } catch (error) { next(error); }
});
marketingSettingsRouter.patch("/auto-reply", requirePermission("omni-inbox:manage") as RequestHandler, async (request, res, next) => {
  const req = request as AuthenticatedRequest;
  try {
    const allowed = Object.keys(AiAutoReplyConfigSchema.paths).filter((key) => key !== "_id");
    const input = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
    const user = await UserModel.findOneAndUpdate({ _id: req.user!.id, companyCode: req.user!.companyCode }, { $set: { aiAutoReplyConfig: input } }, { runValidators: true, returnDocument: "after" });
    return user ? res.json({ status: "success" }) : res.status(404).json({ status: "error", message: "Không tìm thấy người dùng." });
  } catch (error) { next(error); }
});
marketingSettingsRouter.get("/telegram-link", authController.getTelegramLinkStatus as RequestHandler);
marketingSettingsRouter.post("/telegram-link", authController.createTelegramLinkCode as RequestHandler);
marketingSettingsRouter.delete("/telegram-link", authController.unlinkTelegram as RequestHandler);
