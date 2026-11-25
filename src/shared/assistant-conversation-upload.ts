export const maxAssistantConversationImageCount = 10;
export const maxAssistantConversationImageFileBytes = 10 * 1024 * 1024;
export const maxAssistantConversationImageBatchBytes = 50 * 1024 * 1024;

export const assistantConversationImageExtensions = ["png", "jpg", "jpeg", "webp"] as const;

export function isAssistantConversationImageName(fileName: string): boolean {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return assistantConversationImageExtensions.includes(extension as typeof assistantConversationImageExtensions[number]);
}
