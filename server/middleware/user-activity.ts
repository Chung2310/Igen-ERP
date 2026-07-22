import type { NextFunction, Request, Response } from "express";
import { UserActivityEventModel, type UserActivityCategory } from "../model/user-activity-event.model";

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const bounded = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

function categoryFor(route: string): UserActivityCategory {
  const value = route.toLowerCase();
  if (value.includes("/auth") || value.includes("login") || value.includes("logout")) return "authentication";
  if (value.includes("/chat") || value.includes("message") || value.includes("notification")) return "communication";
  if (value.includes("security") || value.includes("session") || value.includes("permission") || value.includes("role") || value.includes("2fa")) return "security";
  if (value.includes("setting") || value.includes("config") || value.includes("integration")) return "configuration";
  if (value.includes("workflow") || value.includes("kanban") || value.includes("inventory") || value.includes("student") || value.includes("wallet")) return "business";
  return "data";
}

export function buildUserActivityFromRequest(req: Request & { user?: any }, statusCode: number) {
  const method = String(req.method || "").toUpperCase();
  if (!MUTATIONS.has(method)) return null;
  const userId = req.user?.id || req.user?._id || req.user?.uid;
  if (!userId) return null;
  const routePath = typeof req.route?.path === "string" ? req.route.path : undefined;
  const route = `${req.baseUrl || ""}${routePath || ""}` || String(req.path || "");
  if (!route || route.includes("/users/:userId/activity")) return null;
  const actionType = `${method} ${route}`;
  const sourceIp = bounded(req.ip?.replace(/^::ffff:/, ""), 64);
  const userAgent = bounded(req.get?.("user-agent"), 512);
  return {
    userId: String(userId), companyCode: String(req.user?.companyCode || "SYSTEM"), actionType,
    category: categoryFor(route), result: statusCode >= 400 ? "failure" as const : "success" as const,
    method, route, description: actionType,
    ...(sourceIp ? { sourceIp } : {}), ...(userAgent ? { userAgent } : {}),
  };
}

export async function recordUserActivity(event: any) {
  try { await UserActivityEventModel.create({ ...event, occurredAt: event.occurredAt || new Date() } as any); }
  catch (error) { console.error("[user activity] Failed to record event:", error); }
}

export function userActivityMiddleware(writer: (event: any) => Promise<unknown> = recordUserActivity) {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      const event = buildUserActivityFromRequest(req, res.statusCode);
      if (event) void writer(event).catch((error) => console.error("[user activity] Writer failed:", error));
    });
    next();
  };
}
