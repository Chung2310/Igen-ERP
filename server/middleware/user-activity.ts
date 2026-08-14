import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { UserActivityEventModel, type UserActivityCategory } from "../model/user-activity-event.model";

const bounded = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
const NOISY = [/\/health(?:\/|$)/, /\/users\/:userId\/activity$/, /\/telegram-link/, /\/socket/, /\/heartbeat/];

const moduleName = (route: string) => {
  const entries: Array<[RegExp, string, string]> = [
    [/student|course|batch|exam|assignment/, "học viên", "student"], [/worker/, "lao động", "worker"],
    [/order/, "đơn hàng", "order"], [/product|inventory|warehouse|stock/, "kho và sản phẩm", "inventory"],
    [/payroll/, "tiền lương", "payroll"], [/timekeeping|attendance|shift/, "chấm công", "timekeeping"],
    [/user|role|permission/, "người dùng", "user"], [/chat|message/, "trò chuyện", "chat"],
    [/resource|file|drive/, "tài nguyên", "resource"], [/retail/, "bán lẻ", "retail"],
    [/finance|wallet|receivable/, "tài chính", "finance"], [/setting|config/, "cấu hình", "settings"],
    [/recruitment|candidate|job-posting/, "tuyển dụng", "recruitment"], [/project|kanban|task/, "dự án", "project"],
    [/leave|absence|day-off/, "nghỉ phép", "leave"], [/company|branch/, "doanh nghiệp và chi nhánh", "company"],
  ];
  return entries.find(([pattern]) => pattern.test(route.toLowerCase()))?.slice(1) as [string, string] | undefined || ["dữ liệu", "data"];
};

function deviceSummary(userAgent?: string) {
  if (!userAgent) return undefined;
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Trình duyệt khác";
  const os = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Mac OS/.test(userAgent) ? "macOS" : "Thiết bị khác";
  return `${browser} trên ${os}`;
}

export function buildUserActivityFromRequest(req: Request & { user?: any }, statusCode: number, durationMs?: number) {
  const method = String(req.method || "").toUpperCase();
  const userId = req.user?.id || req.user?._id || req.user?.uid;
  if (!userId) return null;
  const routePath = typeof req.route?.path === "string" ? req.route.path : String(req.path || "");
  const route = `${req.baseUrl || ""}${routePath}`;
  if (!route || NOISY.some((pattern) => pattern.test(route))) return null;
  const authAction = /\/auth\/(login|logout)/i.exec(route)?.[1]?.toLowerCase();
  if (authAction) {
    const sourceIp = bounded(req.ip?.replace(/^::ffff:/, ""), 64);
    const userAgent = bounded(req.get?.("user-agent"), 512);
    return {
      userId: String(userId), companyCode: String(req.user?.companyCode || "SYSTEM"),
      actionType: `auth.${authAction}`, category: "authentication" as const,
      result: statusCode >= 400 ? "failure" as const : "success" as const, method, route,
      description: authAction === "logout" ? "Đăng xuất khỏi hệ thống" : statusCode >= 400 ? "Đăng nhập thất bại" : "Đăng nhập vào hệ thống",
      ...(sourceIp ? { sourceIp } : {}), ...(userAgent ? { userAgent, deviceSummary: deviceSummary(userAgent) } : {}),
      ...(durationMs != null ? { durationMs } : {}),
    };
  }
  const [label, moduleKey] = moduleName(route);
  const isSearch = method === "GET" && Boolean(req.query && Object.keys(req.query).some((key) => /q|query|search|keyword/i.test(key)));
  const isExport = /export|download/i.test(route);
  const action = isSearch ? "search" : isExport ? "export" : method === "GET" ? "view" : method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";
  const verbs: Record<string, string> = { search: "Tìm kiếm", export: "Tải xuống/Xuất", view: route.includes(":") ? "Xem chi tiết" : "Xem danh sách", create: "Tạo", update: "Cập nhật", delete: "Xóa" };
  const category: UserActivityCategory = isSearch ? "search" : method === "GET" ? "view" : /security|session|permission|role|2fa/i.test(route) ? "security" : /chat|message|notification/i.test(route) ? "communication" : /setting|config/i.test(route) ? "configuration" : "data";
  const sourceIp = bounded(req.ip?.replace(/^::ffff:/, ""), 64);
  const userAgent = bounded(req.get?.("user-agent"), 512);
  const correlationId = bounded(req.get?.("x-correlation-id"), 128);
  return {
    userId: String(userId), companyCode: String(req.user?.companyCode || "SYSTEM"),
    ...(req.user?.branchId ? { branchId: String(req.user.branchId) } : {}),
    actionType: `${moduleKey}.${action}`, category, result: statusCode >= 400 ? "failure" as const : "success" as const,
    method, route, description: `${verbs[action]} ${label}${statusCode >= 400 ? " không thành công" : ""}`,
    ...(sourceIp ? { sourceIp } : {}), ...(userAgent ? { userAgent, deviceSummary: deviceSummary(userAgent) } : {}),
    ...(correlationId ? { correlationId } : {}), ...(durationMs != null ? { durationMs } : {}),
  };
}

export async function recordUserActivity(event: any) {
  try { await UserActivityEventModel.create({ ...event, occurredAt: event.occurredAt || new Date() } as any); }
  catch (error) { console.error("[user activity] Failed to record event:", error); }
}

type BatchWriter = ((event: any) => Promise<void>) & { flush: () => Promise<void> };
export function createActivityBatchWriter(
  insert: (events: any[]) => Promise<unknown>,
  options: { maxBatchSize?: number; flushIntervalMs?: number } = {},
): BatchWriter {
  const maxBatchSize = options.maxBatchSize || 100;
  const flushIntervalMs = options.flushIntervalMs || 500;
  let queue: any[] = [];
  let flushing: Promise<void> | null = null;
  const flush = async () => {
    if (flushing) return flushing;
    if (!queue.length) return;
    const batch = queue.splice(0, maxBatchSize);
    flushing = Promise.resolve(insert(batch)).then(() => undefined).catch((error) => {
      console.error("[user activity] Batch write failed:", error);
    }).finally(() => { flushing = null; });
    await flushing;
    if (queue.length >= maxBatchSize) await flush();
  };
  const timer = setInterval(() => { void flush(); }, flushIntervalMs);
  timer.unref?.();
  const writer = (async (event: any) => { queue.push(event); if (queue.length >= maxBatchSize) await flush(); }) as BatchWriter;
  writer.flush = flush;
  return writer;
}

const routineActivityWriter = createActivityBatchWriter((events) => UserActivityEventModel.insertMany(events));

export function flushUserActivityQueue() {
  return routineActivityWriter.flush();
}

export function userActivityMiddleware(writer: (event: any) => Promise<unknown> = routineActivityWriter) {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    if (!req.headers["x-correlation-id"]) req.headers["x-correlation-id"] = randomUUID();
    res.on("finish", () => {
      const event = buildUserActivityFromRequest(req, res.statusCode, Date.now() - startedAt);
      if (event) {
        const selectedWriter = event.category === "authentication" || event.category === "security" ? recordUserActivity : writer;
        void selectedWriter(event).catch((error) => console.error("[user activity] Writer failed:", error));
      }
    });
    next();
  };
}
