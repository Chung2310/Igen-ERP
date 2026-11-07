import { createHash, randomBytes, randomInt } from "node:crypto";
import { Router } from "express";
import { Schema, model } from "mongoose";
import { getEffectivePermissions, type AuthenticatedRequest } from "../../../middleware/auth";
import { UserModel } from "../../../model/user.model";
import { AccountAccessError, assertAccountUsable } from "../../../security/account-access";
import { zaloMessengerService } from "../message/service/zalo-messenger.service";
import { companyModuleEnabled } from "./access";
import { assertMarketingAccountOwnership } from "./account-ownership";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { getMarketingAppUrl } from "./runtime-settings";

const SESSION_AGE = 10 * 60_000;
const CALLBACK_PATH = "/api/v1/zalo/oauth-callback";
const COOKIE = "erp_marketing_zalo_oauth";
const VERIFIER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const OAuthSession = model("ZaloOAuthSession", new Schema({
  bindingHash: { type: String, required: true, unique: true },
  codeVerifier: { type: String, required: true },
  appId: { type: String, required: true },
  companyCode: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}), "marketing_zalo_oauth_sessions");

function getAppOrigin() {
  try {
    const url = new URL(getMarketingAppUrl());
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function bindingHash(state: string, browserNonce: string) {
  return createHash("sha256").update(state + "." + browserNonce).digest("hex");
}

const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: CALLBACK_PATH } as const;
export const zaloOAuthRouter = Router();

// suiteAccess authenticates this POST and requires social-integration:manage.
zaloOAuthRouter.post("/zalo/oauth-session", async (request, res) => {
  const { user } = request as AuthenticatedRequest;
  const companyCode = user?.companyCode?.trim().toUpperCase();
  if (!user?.id || !companyCode) {
    return res.status(403).json({ message: "Không xác định được doanh nghiệp." });
  }

  const appId = process.env.ZALO_APP_ID?.trim();
  if (!appId || !process.env.ZALO_APP_SECRET?.trim()) {
    return res.status(503).json({ message: "Quản trị ERP cần cấu hình ZALO_APP_ID và ZALO_APP_SECRET để kết nối Zalo OA." });
  }
  const origin = getAppOrigin();
  if (!origin) {
    return res.status(503).json({ message: "Quản trị ERP cần đặt APP_URL thành địa chỉ HTTPS công khai đã đăng ký với Zalo." });
  }
  if (request.get("origin") && request.get("origin") !== origin) {
    return res.status(400).json({ message: `Hãy mở ERP tại ${origin} để kết nối Zalo OA.` });
  }

  const state = randomBytes(32).toString("base64url");
  const browserNonce = randomBytes(32).toString("base64url");
  const codeVerifier = Array.from({ length: 43 }, () => VERIFIER_ALPHABET[randomInt(VERIFIER_ALPHABET.length)]).join("");
  const url = new URL("https://oauth.zaloapp.com/v4/oa/permission");
  url.search = new URLSearchParams({
    app_id: appId,
    redirect_uri: new URL(CALLBACK_PATH, origin).href,
    code_challenge: createHash("sha256").update(codeVerifier).digest("base64url"),
    state,
  }).toString();

  try {
    await OAuthSession.create({
      bindingHash: bindingHash(state, browserNonce), codeVerifier, appId, companyCode,
      userId: user.id, expiresAt: new Date(Date.now() + SESSION_AGE),
    });
  } catch {
    return res.status(503).json({ message: "Không thể tạo phiên kết nối Zalo OA. Vui lòng thử lại." });
  }
  res.set("Cache-Control", "no-store");
  res.cookie(COOKIE, browserNonce, { ...cookieOptions, maxAge: SESSION_AGE });
  return res.json({ authorizationUrl: url.href });
});

zaloOAuthRouter.get("/zalo/oauth-callback", async (req, res) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const origin = getAppOrigin();
  if (!origin) return res.status(503).type("text").send("APP_URL chưa được cấu hình cho kết nối Zalo OA.");
  const returnUrl = new URL("/tich-hop-marketing", origin);
  const finish = (status: string) => {
    returnUrl.searchParams.set("zalo_oauth", status);
    return res.redirect(303, returnUrl.href);
  };

  const { state, code, oa_id: oaId } = req.query;
  const nonce = req.cookies?.[COOKIE];
  const randomValue = /^[A-Za-z0-9_-]{43}$/;
  if (typeof state !== "string" || !randomValue.test(state) || typeof nonce !== "string" || !randomValue.test(nonce)) {
    return finish("expired");
  }

  try {
    const session = await OAuthSession.findOneAndDelete({
      bindingHash: bindingHash(state, nonce), expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) return finish("expired");
    res.clearCookie(COOKIE, cookieOptions);

    if (!code && req.query.error) return finish("denied");
    if (typeof code !== "string" || !code || code.length > 2048 ||
      typeof oaId !== "string" || !/^\d{1,20}$/.test(oaId)) {
      return finish("failed");
    }

    const user = await UserModel.findById(session.userId).select("role companyCode lockedAt disabledAt isActive").lean();
    if (!user || user.companyCode?.trim().toUpperCase() !== session.companyCode) return finish("forbidden");
    await assertAccountUsable(user);
    const permissions = await getEffectivePermissions(session.userId, user.role, user.companyCode);
    if ((!permissions.has("*") && !permissions.has("social-integration:manage")) ||
      (!await companyModuleEnabled(session.companyCode, "social-marketing") &&
        !await companyModuleEnabled(session.companyCode, "omni-inbox"))) {
      return finish("forbidden");
    }

    const appSecret = process.env.ZALO_APP_SECRET?.trim();
    if (!appSecret || session.appId !== process.env.ZALO_APP_ID?.trim()) return finish("failed");
    await assertMarketingAccountOwnership(session.companyCode, "Zalo", oaId);

    const tokenResponse = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", secret_key: appSecret },
      body: new URLSearchParams({
        app_id: session.appId, code, code_verifier: session.codeVerifier, grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!tokenResponse.ok) return finish("failed");
    const token = await tokenResponse.json();
    const expiresIn = Number(token?.expires_in);
    if (typeof token?.access_token !== "string" || !token.access_token ||
      typeof token?.refresh_token !== "string" || !token.refresh_token ||
      !Number.isSafeInteger(expiresIn) || expiresIn <= 0 || expiresIn > 31_536_000) {
      return finish("failed");
    }

    const tokenExpiredAt = new Date(Date.now() + expiresIn * 1000);
    const oa = await zaloMessengerService.validateIntegrationToken({ oaId, accessToken: token.access_token });
    await SocialIntegrationModel.findOneAndUpdate(
      { companyCode: session.companyCode, platform: "Zalo", username: oa.oaId },
      {
        $set: {
          accessToken: token.access_token, refreshToken: token.refresh_token, tokenExpiredAt,
          isConnected: true, isMock: false, connectedAt: new Date(),
        },
        $setOnInsert: { displayName: oa.oaName, createdBy: session.userId },
      },
      { upsert: true, runValidators: true, sort: { isConnected: -1 }, projection: { _id: 1 } },
    );
    return finish("connected");
  } catch (error) {
    if (error instanceof AccountAccessError) return finish("forbidden");
    const failure = error as { code?: number; statusCode?: number };
    if (failure?.code === 11000 || failure?.statusCode === 409) return finish("conflict");
    return finish("failed");
  }
});
