import type { AppError, ErrorDetails } from "./app-error";

export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code: AppError["code"];
    message: string;
    details?: ErrorDetails;
    requestId: string;
  };
}

export function serializeError(error: AppError, requestId: string): ApiErrorEnvelope {
  const payload: ApiErrorEnvelope = {
    ok: false,
    error: {
      code: error.code,
      message: error.expose ? error.message : "Đã xảy ra lỗi hệ thống.",
      requestId,
    },
  };
  if (error.expose && error.details !== undefined) payload.error.details = error.details;
  return payload;
}