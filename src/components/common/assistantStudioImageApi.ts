import { getAccessToken } from "../../services/authService";

export const studioImageRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] as const;

export type StudioImageRequest = {
  prompt: string;
  aspectRatio: (typeof studioImageRatios)[number];
  count: number;
  referenceImage?: string;
};

export type StudioImageResponse = {
  images: { url: string }[];
  model: string;
  aspectRatio: string;
  warning?: string;
};

export async function requestEnhancedStudioImagePrompt(prompt: string): Promise<string> {
  const response = await fetch("/api/v1/chatbot/assistant/studio/images/optimize-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}` },
    body: JSON.stringify({ prompt }),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: { prompt?: string }; message?: string } | null;
  if (!response.ok || !payload?.success || !payload.data?.prompt) {
    throw new Error(payload?.message || "Không thể chuẩn hóa mô tả lúc này. Vui lòng thử lại.");
  }
  return payload.data.prompt;
}

export async function requestStudioImages(input: StudioImageRequest): Promise<StudioImageResponse> {
  const response = await fetch("/api/v1/chatbot/assistant/studio/images", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}` },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: StudioImageResponse; message?: string } | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message || "Không thể tạo ảnh lúc này. Vui lòng thử lại.");
  }
  return payload.data;
}
