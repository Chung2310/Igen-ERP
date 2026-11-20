export interface ErrorDetails {
  message?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  resetAt?: string;
}

/** Read safe error fields without assuming what a rejected promise throws. */
export function errorDetails(error: unknown): ErrorDetails {
  if (!error || typeof error !== "object") return typeof error === "string" ? { message: error } : {};
  const value = error as Record<string, unknown>;
  return {
    message: typeof value.message === "string" ? value.message : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
    statusCode: typeof value.statusCode === "number" ? value.statusCode : undefined,
    resetAt: typeof value.resetAt === "string" ? value.resetAt : undefined,
  };
}
