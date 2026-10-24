import {
  VideoCaptionClassifiedError,
  VideoCaptionErrorType,
} from "../../../../../shared/marketing-suite/video-caption.contract.ts";

export class VideoCaptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly type: VideoCaptionErrorType,
    public readonly retryable: boolean,
    public readonly statusCode = 500
  ) {
    super(message);
    this.name = "VideoCaptionError";
  }
}

export function classifyVideoCaptionError(
  error: unknown
): VideoCaptionClassifiedError {
  if (error instanceof Error && "code" in error && error.code === "AI_SUBSCRIPTION_LIMIT") {
    return { type: "budget", code: "AI_SUBSCRIPTION_LIMIT", message: error.message, retryable: false, occurredAt: new Date().toISOString() };
  }
  if (error instanceof VideoCaptionError) {
    return {
      type: error.type,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      occurredAt: new Date().toISOString(),
    };
  }

  const message =
    error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";

  return {
    type: "transient",
    code: "UNEXPECTED_ERROR",
    message,
    retryable: true,
    occurredAt: new Date().toISOString(),
  };
}

export function getVideoCaptionHttpStatus(error: unknown): number {
  if (error instanceof Error && "code" in error && error.code === "AI_SUBSCRIPTION_LIMIT") return 402;
  return error instanceof VideoCaptionError ? error.statusCode : 500;
}
