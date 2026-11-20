import jwt from "jsonwebtoken";
import { getJwtAccessSecret } from "../../../config/env";
import { ValidationError } from "../../../errors/app-error";

export type PublicRegistrationEntityPreset = "student" | "candidate" | "worker" | "customer";

export interface PublicRegistrationContext {
  teacherId: string;
  companyCode: string;
  branchId?: string;
  entityPreset?: PublicRegistrationEntityPreset;
}

const TOKEN_AUDIENCE = "igen-erp-public-registration";
const TOKEN_PURPOSE = "public-registration-context";

function invalidContext() {
  return new ValidationError(
    "PUBLIC_REGISTRATION_CONTEXT_INVALID",
    "Liên kết đăng ký không hợp lệ hoặc đã hết hạn. Hãy xin mã QR mới.",
  );
}

export function createPublicRegistrationToken(context: PublicRegistrationContext): string {
  return jwt.sign(
    { ...context, purpose: TOKEN_PURPOSE },
    getJwtAccessSecret(),
    { algorithm: "HS256", audience: TOKEN_AUDIENCE, expiresIn: "365d" },
  );
}

export function verifyPublicRegistrationToken(token: unknown): PublicRegistrationContext {
  if (typeof token !== "string" || !token.trim() || token.length > 4096) throw invalidContext();

  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, getJwtAccessSecret(), {
      audience: TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
  } catch {
    throw invalidContext();
  }

  const entityPreset = decoded.entityPreset;
  if (
    decoded.purpose !== TOKEN_PURPOSE
    || typeof decoded.teacherId !== "string"
    || !decoded.teacherId
    || typeof decoded.companyCode !== "string"
    || !decoded.companyCode
    || (decoded.branchId !== undefined && typeof decoded.branchId !== "string")
    || (entityPreset !== undefined && !["student", "candidate", "worker", "customer"].includes(entityPreset))
  ) {
    throw invalidContext();
  }

  return {
    teacherId: decoded.teacherId,
    companyCode: decoded.companyCode,
    ...(typeof decoded.branchId === "string" && decoded.branchId ? { branchId: decoded.branchId } : {}),
    ...(entityPreset ? { entityPreset } : {}),
  };
}
