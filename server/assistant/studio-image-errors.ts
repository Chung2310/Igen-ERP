import { AssistantError } from "./policy";

export const STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE = "Có sự cố từ hệ thống, vui lòng tải lại sau!";

export function studioImageSystemError(error: unknown): AssistantError {
  const status = (error as { status?: number } | null)?.status;
  return new AssistantError(STUDIO_IMAGE_SYSTEM_ERROR_MESSAGE, status === 429 ? 429 : 502);
}
