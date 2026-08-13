import type { Request } from "express";

export function normalizePublicIp(value: unknown): string {
  let ip = String(value || "").trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1].toLowerCase();
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  return ip.toLowerCase();
}

export const getRequestPublicIp = (req: Request) => normalizePublicIp(req.ip || req.socket?.remoteAddress);
