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

gymCallbackRouter.use((_request, response) => response.status(404).end());

gymProxyRouter.use(async (request: AuthenticatedRequest, response, next) => {
  try {
  const user = request.user;
  if (!user?.id || !user.companyCode) {
    response.status(403).json({ message: "Bạn chưa có không gian Quản lý phòng Gym." });
    return;
  }

  const permissions = await getEffectivePermissions(user.id, user.role, user.companyCode);
  const isAdmin = ["*", "gym-admin:manage"].some((code) => permissions.has(code));
  const isPt = ["gym-pt:read", "gym-pt:manage"].some((code) => permissions.has(code));
  const isCustomer = permissions.has("gym-customer:read");
  if (!isAdmin && !isPt && !isCustomer) {
    response.status(403).json({ message: "Bạn chưa được cấp quyền Quản lý phòng Gym." });
    return;
  }
  if (!isAdmin && !isCustomer && !permissions.has("gym-pt:manage") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    response.status(403).json({ message: "Quyền PT chỉ cho phép xem dữ liệu." });
    return;
  }

  const secret = process.env.GYM_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    response.status(503).json({ message: "Quản lý phòng Gym chưa được cấu hình." });
    return;
  }
  const backend = new URL(process.env.GYM_BACKEND_URL || "http://127.0.0.1:3018");
  const destination = new URL(request.url, backend);
  if (destination.origin !== backend.origin || !destination.pathname.startsWith("/api/")) {
    response.status(404).end();
    return;
  }
  if (isCustomer && !isAdmin && !isPt && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const selfProfile = request.method === "PATCH" && destination.pathname === "/api/auth/me";
    const startConversation = request.method === "POST" && destination.pathname === "/api/assistant/conversations";
    const addMessage = request.method === "POST" && /^\/api\/assistant\/conversations\/[a-f\d]{24}\/messages$/i.test(destination.pathname);
    if (!selfProfile && !startConversation && !addMessage) {
      response.status(403).json({ message: "Tài khoản khách chỉ được dùng các tính năng tự phục vụ." });
      return;
    }
  }
  if (isCustomer && !isAdmin && !isPt && ["GET", "HEAD"].includes(request.method)) {
    const customerRead = /^\/api\/(?:auth\/me|me\/(?:journey|content)|features(?:\/.*)?|assistant\/(?:conversations|suggestions)(?:\/.*)?|notifications(?:\/.*)?)$/i.test(destination.pathname);
    if (!customerRead) {
      response.status(403).json({ message: "Tài khoản khách chỉ được xem dữ liệu của mình." });
      return;
    }
  }
  if (/^\/api\/auth\/(?:login|refresh|register-pt|register-center|logout)$/.test(destination.pathname)) {
    response.status(404).end();
    return;
  }

  const isCreatePt = request.method === "POST" && destination.pathname === "/api/users";
  const customerAccountId = /^\/api\/customers\/([a-f\d]{24})\/account$/i.exec(destination.pathname)?.[1];
  const isCreateCustomer = request.method === "POST" && Boolean(customerAccountId);
  const isUpdateSelf = request.method === "PATCH" && destination.pathname === "/api/auth/me";
  const gymUserId = /^\/api\/users\/([a-f\d]{24})$/i.exec(destination.pathname)?.[1];
  const gymCustomerId = /^\/api\/customers\/([a-f\d]{24})$/i.exec(destination.pathname)?.[1];
  let createdAccountId: string | undefined;
  if ((isUpdateSelf || gymUserId && request.method === "PATCH") && request.body && "email" in request.body) {
    const email = (request.body as Record<string, unknown>).email;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      response.status(400).json({ message: "Tài khoản GYM cần giữ email đăng nhập ERP hợp lệ." });
      return;
    }
    if (gymUserId) {
      const account = await UserModel.findOne({ gymAccountId: gymUserId, companyCode: user.companyCode.toUpperCase(), role: { $in: ["gym_pt", "gym_customer"] } }).select("_id").lean();
      if (!account) {
        response.status(404).json({ message: "Không tìm thấy tài khoản PT trong doanh nghiệp." });
        return;
      }
      const existing = await UserModel.exists({ email: email.trim().toLowerCase(), _id: { $ne: account._id } });
      if (existing) {
        response.status(409).json({ message: "Email đã có tài khoản ERP." });
        return;
      }
    }
  }
  if (gymCustomerId && request.method === "PATCH" && request.body && "email" in request.body) {
    const fields = request.body as Record<string, unknown>;
    const account = await UserModel.findOne({ gymCustomerId, companyCode: user.companyCode.toUpperCase(), role: "gym_customer" }).select("_id").lean();
    if (account) {
      const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        response.status(400).json({ message: "Khách đã có tài khoản ERP cần giữ email đăng nhập hợp lệ." });
        return;
      }
      if (await UserModel.exists({ email, _id: { $ne: account._id } })) {
        response.status(409).json({ message: "Email đã có tài khoản ERP." });
        return;
      }
    }
  }
  if (gymUserId && request.method === "PATCH" && request.body && "role" in request.body) {
    const account = await UserModel.findOne({ gymAccountId: gymUserId, companyCode: user.companyCode.toUpperCase(), role: { $in: ["gym_pt", "gym_customer"] } }).select("role").lean();
    const expected = account?.role === "gym_pt" ? "PT" : account?.role === "gym_customer" ? "CUSTOMER" : "";
    if (expected && (request.body as Record<string, unknown>).role !== expected) {
      response.status(409).json({ message: "Vai trò tài khoản GYM đã liên kết ERP không thể đổi trực tiếp." });
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
      phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
      role: "gym_pt",
      companyCode: user.companyCode.toUpperCase(),
      permissions: ["gym-pt:manage"],
      isActive: payload.status !== "LOCKED",
      ...(payload.status === "LOCKED" ? { disabledAt: new Date() } : {}),
    });
    createdAccountId = String(account._id);
  }
  if (isCreateCustomer) {
    if (!isAdmin && !permissions.has("gym-pt:manage")) {
      response.status(403).json({ message: "Chỉ Admin GYM và PT được tạo tài khoản khách tập." });
      return;
    }
    const fields = request.body as Record<string, unknown> | undefined;
    const email = typeof fields?.email === "string" ? fields.email.trim().toLowerCase() : "";
    const password = typeof fields?.password === "string" ? fields.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      response.status(400).json({ message: "Khách tập cần email đăng nhập ERP và mật khẩu hợp lệ. Hãy bổ sung email trong hồ sơ khách." });
      return;
    }
    if (await UserModel.exists({ email })) {
      response.status(409).json({ message: "Email đã có tài khoản ERP." });
      return;
    }
    const account = await UserModel.create({
      email,
      password: await bcrypt.hash(password, 12),
      displayName: String(fields?.username || "Khách tập"),
      role: "gym_customer",
      companyCode: user.companyCode.toUpperCase(),
      permissions: ["gym-customer:read"],
      isActive: true,
    });
    createdAccountId = String(account._id);
  }

  const bridgeToken = jwt.sign({
    erpUserId: user.id,
    companyCode: user.companyCode,
    role: isAdmin ? "ADMIN" : isPt ? "PT" : "CUSTOMER",
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
    if (isCreatePt || isCreateCustomer || isUpdateSelf || gymUserId && ["PATCH", "DELETE"].includes(request.method) || gymCustomerId && ["PATCH", "DELETE"].includes(request.method)) {
      const chunks: Buffer[] = [];
      result.on("data", (chunk: Buffer) => chunks.push(chunk));
      result.on("end", () => {
        void (async () => {
          const payload = Buffer.concat(chunks);
          if ((result.statusCode || 500) >= 400 && createdAccountId) {
            await UserModel.deleteOne({ _id: createdAccountId });
          } else if ((result.statusCode || 500) < 400) {
            if (createdAccountId) {
              const created = JSON.parse(payload.toString("utf8"))?.data;
              const gymAccountId = isCreateCustomer ? created?.user?.id : created?._id;
              if (typeof gymAccountId === "string") await UserModel.findByIdAndUpdate(createdAccountId, { gymAccountId, ...(isCreateCustomer ? { gymCustomerId: customerAccountId, displayName: created?.user?.fullName || String((request.body as Record<string, unknown>)?.username || "Khách tập") } : {}) });
            } else if (isUpdateSelf) {
              const fields = request.body as Record<string, unknown> | undefined;
              const update: Record<string, unknown> = {};
              if (typeof fields?.fullName === "string") update.displayName = fields.fullName.trim();
              if (typeof fields?.email === "string" && fields.email.trim()) update.email = fields.email.trim().toLowerCase();
              if (typeof fields?.password === "string" && fields.password) update.password = await bcrypt.hash(fields.password, 12);
              if (Object.keys(update).length) await UserModel.updateOne({ _id: user.id }, update);
            } else if (gymCustomerId) {
              const filter = { gymCustomerId, companyCode: user.companyCode!.toUpperCase(), role: "gym_customer" };
              if (request.method === "DELETE") await UserModel.updateOne(filter, { isActive: false, disabledAt: new Date() });
              else {
                const fields = request.body as Record<string, unknown> | undefined;
                const update: Record<string, unknown> = {};
                if (typeof fields?.fullName === "string") update.displayName = fields.fullName.trim();
                if (typeof fields?.email === "string" && fields.email.trim()) update.email = fields.email.trim().toLowerCase();
                if (Object.keys(update).length) await UserModel.updateOne(filter, update);
              }
            } else if (gymUserId) {
              const filter = { gymAccountId: gymUserId, companyCode: user.companyCode!.toUpperCase(), role: { $in: ["gym_pt", "gym_customer"] } };
              if (request.method === "DELETE") {
                await UserModel.updateOne(filter, { isActive: false, disabledAt: new Date() });
              } else {
                const update: Record<string, unknown> = {};
                const fields = request.body as Record<string, unknown> | undefined;
                if (typeof fields?.fullName === "string") update.displayName = fields.fullName.trim();
                if (typeof fields?.email === "string" && fields.email.trim()) update.email = fields.email.trim().toLowerCase();
                if (typeof fields?.phone === "string") update.phone = fields.phone.trim();
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
        })().catch(() => { if (!response.headersSent) response.status(500).json({ message: "Không đồng bộ được tài khoản GYM với ERP." }); });
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
    if (!response.headersSent) response.status(502).json({ message: "Không kết nối được dịch vụ Quản lý phòng Gym." });
    else response.end();
  });
  if (body) upstream.end(body);
  else request.pipe(upstream);
  } catch (error) {
    next(error);
  }
});
