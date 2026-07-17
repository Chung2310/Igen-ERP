import { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";
import type { Request } from "express";
import { getJwtAccessSecret } from "../config/env";

/**
 * Khoá rate-limit theo danh tính thay vì chỉ theo IP.
 *
 * Lý do: ở Việt Nam nhiều người dùng thật chung một IP public (CGNAT / NAT văn phòng). Nếu key theo
 * IP thì cả nhóm gộp về một hạn mức và bị 429 oan. Với request đã đăng nhập ta lấy danh tính từ
 * access token (đã verify chữ ký) để mỗi user có hạn mức riêng; request vô danh vẫn key theo IP.
 *
 * BẢO MẬT: định danh phải lấy từ token đã VERIFY, không phải decode. Nếu chỉ decode, kẻ tấn công có
 * thể đặt `id` tuỳ ý để tạo vô số bucket mới và vô hiệu hoá giới hạn.
 */

/** Lấy access token giống requireAuth: ưu tiên header Bearer, fallback query token. */
export function extractAccessToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  if (typeof req.query?.token === "string" && req.query.token) {
    return req.query.token;
  }
  return undefined;
}

export type TokenVerifier = (token: string) => { id?: unknown } | null;

/** Thuần: trả `u:{id}` nếu verify thành công và có id, ngược lại null. `verify` inject để test. */
export function identityKeyFromToken(token: string | undefined, verify: TokenVerifier): string | null {
  if (!token) return null;
  let payload: { id?: unknown } | null;
  try {
    payload = verify(token);
  } catch {
    return null;
  }
  const id = payload?.id;
  if (typeof id !== "string" || id.length === 0) return null;
  return `u:${id}`;
}

function realVerify(token: string): { id?: unknown } | null {
  const decoded = jwt.verify(token, getJwtAccessSecret());
  return typeof decoded === "object" && decoded !== null ? (decoded as { id?: unknown }) : null;
}

function ipKey(req: Request): string {
  return `ip:${ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown")}`;
}

/** Key cho các limiter dùng chung: per-user nếu đã đăng nhập, ngược lại per-IP. */
export function resolveClientRateKey(req: Request): string {
  return identityKeyFromToken(extractAccessToken(req), realVerify) ?? ipKey(req);
}

/** Chuẩn hoá email để chống lách bằng biến thể hoa/thường/space. */
export function normalizeLoginAccount(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

/** Key throttle brute-force theo tài khoản đích của /login. Không có email → null (limiter sẽ skip). */
export function resolveLoginAccountKey(req: Request): string | null {
  const account = normalizeLoginAccount((req.body as { email?: unknown } | undefined)?.email);
  return account ? `acct:${account}` : null;
}
