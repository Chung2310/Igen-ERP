import { Router } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth";
import { getEffectivePermissions } from "../../middleware/auth";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../../model/user.model";

export const gymProxyRouter = Router();
export const gymCallbackRouter = Router();

const paymentCallbacks: Record<string, string> = {
  "POST /sepay/webhook": "/api/credits/payments/sepay/webhook",
  "POST /payos/webhook": "/api/credits/payments/payos/webhook",
  "GET /vnpay/ipn": "/api/credits/payments/vnpay/ipn",
  "GET /vnpay/return": "/api/credits/payments/vnpay/return",
  "POST /momo/ipn": "/api/credits/payments/momo/ipn",
};

gymCallbackRouter.use((request, response) => {
  const path = request.path.replace(/\/$/, "");
  const targetPath = paymentCallbacks[`${request.method} ${path}`];
  if (!targetPath) return response.status(404).end();
  const backend = new URL(process.env.GYM_BACKEND_URL || "http://127.0.0.1:3018");
  const destination = new URL(`${targetPath}${request.url.includes("?") ? request.url.slice(request.url.indexOf("?")) : ""}`, backend);
  const body = request.body === undefined ? null : Buffer.from(JSON.stringify(request.body));
  const headers: Record<string, string | string[] | undefined> = { ...request.headers };
  for (const key of ["host", "connection", "cookie", "transfer-encoding"]) delete headers[key];
  if (body) headers["content-length"] = String(body.length);
  const send = destination.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = send(destination, { method: request.method, headers }, (result) => {
    response.status(result.statusCode || 502);
    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined && !["connection", "transfer-encoding"].includes(key)) response.setHeader(key, value);
    }
    result.pipe(response);
  });
  upstream.on("error", () => { if (!response.headersSent) response.status(502).end(); });
  if (body) upstream.end(body);
  else request.pipe(upstream);
});

gymProxyRouter.use(async (request: AuthenticatedRequest, response, next) => {
  try {
  const user = request.user;
  if (!user?.id || !user.companyCode) {
    response.status(403).json({ message: "Bạn chưa có không gian Chuỗi GYM." });
    return;
  }

  const permissions = await getEffectivePermissions(user.id, user.role, user.companyCode);
  const isAdmin = ["*", "gym-admin:manage"].some((code) => permissions.has(code));
  const isPt = ["gym-pt:read", "gym-pt:manage"].some((code) => permissions.has(code));
  if (!isAdmin && !isPt) {
    response.status(403).json({ message: "Bạn chưa được cấp quyền Chuỗi GYM." });
    return;
  }
  if (!isAdmin && !permissions.has("gym-pt:manage") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    response.status(403).json({ message: "Quyền PT chỉ cho phép xem dữ liệu." });
    return;
  }

  const secret = process.env.GYM_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    response.status(503).json({ message: "Chuỗi GYM chưa được cấu hình." });
    return;
  }
  const backend = new URL(process.env.GYM_BACKEND_URL || "http://127.0.0.1:3018");
  const destination = new URL(request.url, backend);
  if (destination.origin !== backend.origin || !destination.pathname.startsWith("/api/")) {
    response.status(404).end();
    return;
  }
  if (/^\/api\/auth\/(?:login|refresh|register-pt|register-center|logout)$/.test(destination.pathname)) {
    response.status(404).end();
    return;
  }

  const isCreatePt = request.method === "POST" && destination.pathname === "/api/users";
  const isUpdateSelf = request.method === "PATCH" && destination.pathname === "/api/auth/me";
  const gymUserId = /^\/api\/users\/([a-f\d]{24})$/i.exec(destination.pathname)?.[1];
  let createdAccountId: string | undefined;
  if ((isUpdateSelf || gymUserId && request.method === "PATCH") && request.body && "email" in request.body) {
    const email = (request.body as Record<string, unknown>).email;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      response.status(400).json({ message: "Tài khoản GYM cần giữ email đăng nhập ERP hợp lệ." });
      return;
    }
  }
  if (isUpdateSelf) {
    const fields = request.body as Record<string, unknown> | undefined;
    if (typeof fields?.password === "string" && fields.password) {
      const account = await UserModel.findById(user.id).select("password");
      if (!account || typeof fields.currentPassword !== "string" || !await bcrypt.compare(fields.currentPassword, account.password)) {
        response.status(400).json({ message: "Mật khẩu hiện tại không chính xác." });
        return;
      }
    }
    if (typeof fields?.email === "string" && fields.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const existing = await UserModel.exists({ email: fields.email.trim().toLowerCase(), _id: { $ne: user.id } });
      if (existing) {
        response.status(409).json({ message: "Email đã có tài khoản ERP." });
        return;
      }
    }
  }
  if (isCreatePt) {
    if (!isAdmin || !permissions.has("gym-admin:manage") && !permissions.has("*")) {
      response.status(403).json({ message: "Chỉ Admin GYM được tạo tài khoản PT." });
      return;
    }
    const payload = request.body as Record<string, unknown> | undefined;
    const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload?.password === "string" ? payload.password : "";
    if (payload?.role !== "PT" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      response.status(400).json({ message: "PT cần email đăng nhập và mật khẩu hợp lệ." });
      return;
    }
    if (await UserModel.exists({ email })) {
      response.status(409).json({ message: "Email đã có tài khoản ERP." });
      return;
    }
    const account = await UserModel.create({
      email,
      password: await bcrypt.hash(password, 12),
      displayName: typeof payload.fullName === "string" ? payload.fullName.trim() : String(payload.username || "PT"),
      role: "gym_pt",
      companyCode: user.companyCode.toUpperCase(),
      permissions: ["gym-pt:manage"],
      isActive: payload.status !== "LOCKED",
      ...(payload.status === "LOCKED" ? { disabledAt: new Date() } : {}),
    });
    createdAccountId = String(account._id);
  }

  const bridgeToken = jwt.sign({
    erpUserId: user.id,
    companyCode: user.companyCode,
    role: isAdmin ? "ADMIN" : "PT",
    fullName: user.displayName || user.email,
    email: user.email,
  }, secret, { expiresIn: "2m", issuer: "igen-erp", audience: "chuoi-gym" });
  const headers: Record<string, string | string[] | undefined> = { ...request.headers, authorization: `Bearer ${bridgeToken}` };
  delete headers.host;
  delete headers.connection;
  delete headers["transfer-encoding"];
  const hasBody = request.body !== undefined && !request.is("multipart/form-data");
  const body = hasBody ? Buffer.from(JSON.stringify(request.body)) : null;
  if (body) headers["content-length"] = String(body.length);

  const send = destination.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = send(destination, { method: request.method, headers }, (result) => {
    if (isCreatePt || isUpdateSelf || gymUserId && ["PATCH", "DELETE"].includes(request.method)) {
      const chunks: Buffer[] = [];
      result.on("data", (chunk: Buffer) => chunks.push(chunk));
      result.on("end", () => {
        void (async () => {
          const payload = Buffer.concat(chunks);
          if ((result.statusCode || 500) >= 400 && createdAccountId) {
            await UserModel.deleteOne({ _id: createdAccountId });
          } else if ((result.statusCode || 500) < 400) {
            if (createdAccountId) {
              const gymAccountId = JSON.parse(payload.toString("utf8"))?.data?._id;
              if (typeof gymAccountId === "string") await UserModel.findByIdAndUpdate(createdAccountId, { gymAccountId });
            } else if (isUpdateSelf) {
              const fields = request.body as Record<string, unknown> | undefined;
              const update: Record<string, unknown> = {};
              if (typeof fields?.fullName === "string") update.displayName = fields.fullName.trim();
              if (typeof fields?.email === "string" && fields.email.trim()) update.email = fields.email.trim().toLowerCase();
              if (typeof fields?.password === "string" && fields.password) update.password = await bcrypt.hash(fields.password, 12);
              if (Object.keys(update).length) await UserModel.updateOne({ _id: user.id }, update);
            } else if (gymUserId) {
              const filter = { gymAccountId: gymUserId, companyCode: user.companyCode!.toUpperCase(), role: "gym_pt" };
              if (request.method === "DELETE") {
                await UserModel.updateOne(filter, { isActive: false, disabledAt: new Date() });
              } else {
                const update: Record<string, unknown> = {};
                const fields = request.body as Record<string, unknown> | undefined;
                if (typeof fields?.fullName === "string") update.displayName = fields.fullName.trim();
                if (typeof fields?.email === "string" && fields.email.trim()) update.email = fields.email.trim().toLowerCase();
                if (typeof fields?.password === "string" && fields.password) update.password = await bcrypt.hash(fields.password, 12);
                if (fields?.status === "LOCKED") { update.isActive = false; update.disabledAt = new Date(); }
                if (fields?.status === "ACTIVE") { update.isActive = true; update.disabledAt = null; }
                if (Object.keys(update).length) await UserModel.updateOne(filter, update);
              }
            }
          }
          response.status(result.statusCode || 502);
          for (const [key, value] of Object.entries(result.headers)) {
            if (value !== undefined && !["connection", "transfer-encoding"].includes(key)) response.setHeader(key, value);
          }
          response.end(payload);
        })().catch(() => { if (!response.headersSent) response.status(500).json({ message: "Không đồng bộ được tài khoản PT." }); });
      });
      return;
    }
    response.status(result.statusCode || 502);
    for (const [key, value] of Object.entries(result.headers)) {
      if (value !== undefined && !["connection", "transfer-encoding"].includes(key)) response.setHeader(key, value);
    }
    result.pipe(response);
  });
  upstream.on("error", () => {
    if (createdAccountId) void UserModel.deleteOne({ _id: createdAccountId });
    if (!response.headersSent) response.status(502).json({ message: "Không kết nối được dịch vụ Chuỗi GYM." });
    else response.end();
  });
  if (body) upstream.end(body);
  else request.pipe(upstream);
  } catch (error) {
    next(error);
  }
});
