export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Readonly<Record<string, unknown>>;
    requestId: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId?: string;

  constructor(options: { status: number; code: string; message: string; details?: Readonly<Record<string, unknown>>; requestId?: string; cause?: unknown }) {
    super(options.message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    Object.defineProperty(this, "cause", { value: options.cause, enumerable: false });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!isRecord(value) || value.ok !== false || !isRecord(value.error)) return false;
  const error = value.error;
  return typeof error.code === "string"
    && typeof error.message === "string"
    && typeof error.requestId === "string"
    && (error.details === undefined || isRecord(error.details));
}

export async function parseApiErrorResponse(response: Response): Promise<ApiClientError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (isEnvelope(payload)) {
    return new ApiClientError({
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      details: payload.error.details,
      requestId: payload.error.requestId,
    });
  }

  // Worker-management endpoints use the legacy `{ success: false, error: { code, message } }`
  // shape. Preserve its domain message instead of collapsing it to the generic fallback.
  if (isRecord(payload) && payload.success === false && isRecord(payload.error)
    && typeof payload.error.code === "string" && typeof payload.error.message === "string") {
    return new ApiClientError({
      status: response.status,
      code: payload.error.code,
      message: payload.error.message,
      details: isRecord(payload.error.details) ? payload.error.details : undefined,
      requestId: typeof payload.error.requestId === "string" ? payload.error.requestId : response.headers.get("x-request-id") ?? undefined,
    });
  }

  if (isRecord(payload) && typeof payload.error === 'string') {
    return new ApiClientError({
      status: response.status,
      code: "API_ERROR",
      message: payload.error,
    });
  }

  if (isRecord(payload) && typeof payload.message === 'string') {
    return new ApiClientError({
      status: response.status,
      code: "API_ERROR",
      message: payload.message,
    });
  }

  return new ApiClientError({
    status: response.status,
    code: "UNKNOWN_API_ERROR",
    message: "Yêu cầu không thể xử lý.",
    requestId: response.headers.get("x-request-id") ?? undefined,
  });
}
