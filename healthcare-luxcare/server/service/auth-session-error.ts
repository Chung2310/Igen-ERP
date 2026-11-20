export class AuthSessionError extends Error {
  constructor(message: string, public readonly code = "SESSION_EXPIRED") {
    super(message);
    this.name = "AuthSessionError";
  }
}

export function refreshFailure(error: unknown) {
  if (error instanceof AuthSessionError) {
    return { status: 401, code: error.code, message: error.message };
  }
  if (error instanceof Error && (error as Error & { code?: string }).code === "SESSION_REPLACED") {
    return { status: 401, code: "SESSION_REPLACED", message: error.message };
  }
  return { status: 503, code: "AUTH_TEMPORARILY_UNAVAILABLE",
    message: "Dịch vụ đăng nhập tạm thời gián đoạn. Vui lòng thử lại." };
}
