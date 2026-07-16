import type { IncomingHttpHeaders } from "node:http";

export function getTrustedSocketClientIp(
  headers: IncomingHttpHeaders,
  transportAddress?: string,
): string {
  const header = headers["x-real-ip"];
  const value = Array.isArray(header)
    ? (header.length === 1 ? header[0]?.trim() : "")
    : header?.trim();

  if (value && !value.includes(",")) return value;
  return transportAddress?.trim() || "unknown";
}
