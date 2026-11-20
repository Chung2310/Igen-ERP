import type { Request } from "express";
import { isIP } from "node:net";

export function normalizePublicIp(value: unknown): string {
  let ip = String(value || "").trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) return bracketed[1].toLowerCase();
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  return ip.toLowerCase();
}

function expandIpv6(value: string): string[] | null {
  const address = value.split("%")[0].toLowerCase();
  if (isIP(address) !== 6) return null;
  const sides = address.split("::");
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(":") : [];
  const right = sides[1] ? sides[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sides.length === 1 && missing !== 0)) return null;
  return [...left, ...Array(missing).fill("0"), ...right]
    .map((part) => Number.parseInt(part || "0", 16).toString(16));
}

export function normalizeAllowedNetwork(value: unknown): string {
  const raw = normalizePublicIp(value);
  const slashIndex = raw.indexOf("/");
  const address = slashIndex >= 0 ? raw.slice(0, slashIndex) : raw;
  if (isIP(address) === 4) return address;
  const groups = expandIpv6(address);
  if (!groups) return raw;
  return `${groups.slice(0, 4).join(":")}::/64`;
}

export function isRequestIpAllowed(requestIp: unknown, allowed: unknown): boolean {
  const request = normalizePublicIp(requestIp);
  const configured = normalizePublicIp(allowed);
  const requestVersion = isIP(request);
  const allowedAddress = configured.split("/")[0];
  if (requestVersion === 4) return isIP(allowedAddress) === 4 && request === allowedAddress;
  if (requestVersion !== 6 || isIP(allowedAddress) !== 6) return false;
  return normalizeAllowedNetwork(request) === normalizeAllowedNetwork(configured);
}

export const getRequestPublicIp = (req: Request) => normalizePublicIp(req.ip || req.socket?.remoteAddress);
