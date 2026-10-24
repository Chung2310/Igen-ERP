import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { Schema, model } from "mongoose";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { UserModel } from "../../../model/user.model";
import { requirePermission, getEffectivePermissions } from "../../../middleware/auth";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { companyModuleEnabled } from "./access";
import { getMarketingApprovalSecret } from "./runtime-settings";
import { facebookPostController } from "./controller/facebook-post.controller";

const OAuthSession = model("MarketingOAuthSession", new Schema({
  userId: { type: String, required: true }, companyCode: { type: String, required: true },
  integrationId: String, tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true }), "marketing_oauth_sessions");
const COOKIE = "erp_marketing_fb_state";
export const facebookOAuthRouter = Router();
facebookOAuthRouter.post("/facebook/oauth-session", requirePermission("social-integration:manage") as RequestHandler, async (request, res, next) => {
  const req = request as AuthenticatedRequest;
  try {
    const account = await SocialIntegrationModel.findOne({ companyCode: req.user!.companyCode, platform: "Facebook", fbAppId: { $exists: true, $ne: "" } }).lean();
    const appId = account?.fbAppId || process.env.FB_APP_ID;
    const secret = account?.appSecret || process.env.FB_APP_SECRET;
    if (!appId || !secret) return res.status(400).json({ status: "error", message: "Chưa cấu hình Facebook App ID/App Secret." });
    const session = new OAuthSession({ userId: req.user!.id, companyCode: req.user!.companyCode, integrationId: account?._id ? String(account._id) : "", expiresAt: new Date(Date.now() + 600_000) });
    const state = jwt.sign({ purpose: "facebook-oauth", sessionId: String(session._id) }, getMarketingApprovalSecret(), { expiresIn: "10m", audience: "erp-facebook-oauth" });
    session.tokenHash = createHash("sha256").update(state).digest("hex"); await session.save();
    res.cookie(COOKIE, String(session._id), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600_000, path: "/api/v1/facebook/oauth-callback" });
    return res.json({ status: "success", state, appId });
  } catch (error) { next(error); }
});
facebookOAuthRouter.get("/facebook/oauth-callback", async (req, res, next) => {
  try {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const payload = jwt.verify(state, getMarketingApprovalSecret(), { audience: "erp-facebook-oauth" }) as jwt.JwtPayload;
    if (payload.purpose !== "facebook-oauth" || typeof payload.sessionId !== "string" || req.cookies?.[COOKIE] !== payload.sessionId) return res.status(400).send("Invalid Facebook OAuth state.");
    const session = await OAuthSession.findOneAndDelete({ _id: payload.sessionId, tokenHash: createHash("sha256").update(state).digest("hex"), expiresAt: { $gt: new Date() } }).lean();
    res.clearCookie(COOKIE, { path: "/api/v1/facebook/oauth-callback" });
    if (!session) return res.status(400).send("Facebook OAuth session expired or already used.");
    const user = await UserModel.findById(session.userId).lean();
    if (!user || user.disabledAt || user.companyCode !== session.companyCode) return res.status(403).send("Account access revoked.");
    const permissions = await getEffectivePermissions(session.userId, user.role, user.companyCode);
    if (!permissions.has("*") && !permissions.has("social-integration:manage")) return res.status(403).send("Integration permission revoked.");
    if (!await companyModuleEnabled(session.companyCode, "social-marketing") && !await companyModuleEnabled(session.companyCode, "omni-inbox")) return res.status(403).send("Module access revoked.");
    req.query.state = encodeURIComponent(JSON.stringify({ integrationId: session.integrationId || "", companyCode: session.companyCode, createdBy: session.userId }));
    return facebookPostController.oauthCallback(req, res);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) return res.status(400).send("Invalid or expired Facebook OAuth state.");
    return next(error);
  }
});
