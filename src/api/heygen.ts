export type HeyGenLibraryItem = {
  id: string;
  name: string;
  previewImage?: string;
  gender?: string;
  language?: string;
  accent?: string;
  isDefault?: boolean;
};

function getJwtHeaders(withContentType: boolean = true) {
  const headers: Record<string, string> = {};
  if (withContentType) {
    headers["Content-Type"] = "application/json";
  }
  const token = localStorage.getItem("accessToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonResponse(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!response.ok) {
    let parsed: any = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }
    const detailMsg = parsed?.details || parsed?.message || fallbackMessage;
    throw new Error(parsed?.message && parsed?.details ? `${parsed.message} (${parsed.details})` : detailMsg);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(fallbackMessage);
  }
}

export const heygenApi = {
  async getLibrary(): Promise<{ status: string; avatars: HeyGenLibraryItem[]; voices: HeyGenLibraryItem[]; warnings?: string[] }> {
    const response = await fetch("/api/v1/heygen/library", {
      headers: getJwtHeaders(false),
    });
    return parseJsonResponse(response, "Loi lay thu vien HeyGen");
  },

  async createAvatarVideo(input: {
    avatarId: string;
    voiceId: string;
    script: string;
    motionText?: string;
    aspectRatio?: "16:9" | "9:16" | "1:1";
    resolution?: "720p" | "1080p" | "4k";
    engineType?: "avatar_v" | "avatar_iv" | "avatar_iii";
    title?: string;
    description?: string;
  }): Promise<any> {
    const response = await fetch("/api/v1/heygen/videos", {
      method: "POST",
      headers: getJwtHeaders(true),
      body: JSON.stringify(input),
    });
    return parseJsonResponse(response, "Loi tao video avatar HeyGen");
  },

  async getVideoStatus(videoId: string, input: {
    avatarId?: string;
    voiceId?: string;
    script?: string;
    motionText?: string;
    aspectRatio?: string;
    title?: string;
    description?: string;
  }): Promise<any> {
    const response = await fetch(`/api/v1/heygen/videos/${videoId}/status`, {
      method: "POST",
      headers: getJwtHeaders(true),
      body: JSON.stringify(input),
    });
    return parseJsonResponse(response, "Loi lay trang thai video HeyGen");
  },

  async getVideoHistory(): Promise<{ status: string; history: any[] }> {
    const response = await fetch("/api/v1/heygen/history", {
      headers: getJwtHeaders(false),
    });
    return parseJsonResponse(response, "Loi lay lich su video HeyGen");
  },

  async deleteVideoHistory(id: string): Promise<{ status: string }> {
    const response = await fetch(`/api/v1/heygen/history/${id}`, {
      method: "DELETE",
      headers: getJwtHeaders(false),
    });
    return parseJsonResponse(response, "Loi xoa lich su video HeyGen");
  },
};
