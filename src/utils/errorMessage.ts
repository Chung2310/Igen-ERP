import { toVietnameseErrorMessage } from "./vietnameseErrorMessage";

export function getApiErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error
    ? err.message
    : typeof err === "string"
      ? err
      : (err as { message?: string } | null)?.message;
  return toVietnameseErrorMessage(message, fallback);
}
