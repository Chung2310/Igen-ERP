const VIDEO_API = "https://openrouter.ai/api/v1/videos";

function apiKey() {
  const value = process.env.OPENROUTER_API_KEY?.trim();
  if (!value) throw new Error("OPENROUTER_API_KEY chưa được cấu hình trên máy chủ.");
  return value;
}

function headers() {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "https://igen-erp.app",
    "X-Title": "Igen ERP - Trợ lý kiến trúc",
  };
}

async function providerJson(response: Response) {
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const detail = typeof value.error === "string" ? value.error : `OpenRouter trả về HTTP ${response.status}.`;
    throw new Error(detail.slice(0, 500));
  }
  return value;
}

export interface StartArchitectureVideoInput {
  model: string;
  prompt: string;
  aspectRatio: string;
  duration: number;
  resolution: string;
  generateAudio: boolean;
  referenceImage?: string;
}

export async function startArchitectureVideo(input: StartArchitectureVideoInput) {
  const body = {
    model: input.model,
    prompt: input.prompt,
    duration: input.duration,
    resolution: input.resolution,
    aspect_ratio: input.aspectRatio,
    generate_audio: input.generateAudio,
    ...(input.referenceImage ? {
      frame_images: [{
        type: "image_url",
        image_url: { url: input.referenceImage },
        frame_type: "first_frame",
      }],
    } : {}),
  };
  const response = await fetch(VIDEO_API, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await providerJson(response);
  if (typeof result.id !== "string" || !result.id) throw new Error("OpenRouter không trả về mã tác vụ video.");
  return { id: result.id, status: typeof result.status === "string" ? result.status : "pending" };
}

export async function getArchitectureVideoStatus(id: string) {
  const response = await fetch(`${VIDEO_API}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    signal: AbortSignal.timeout(30_000),
  });
  const result = await providerJson(response);
  const status = typeof result.status === "string" ? result.status : "pending";
  const urls = Array.isArray(result.unsigned_urls) ? result.unsigned_urls : [];
  const contentUrl = typeof urls[0] === "string" ? urls[0] : "";
  const rawError = result.error;
  const error = typeof rawError === "string" ? rawError : rawError && typeof rawError === "object" && "message" in rawError && typeof rawError.message === "string" ? rawError.message : undefined;
  return { status, contentUrl, error };
}

export async function downloadArchitectureVideo(contentUrl: string) {
  const parsed = new URL(contentUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "openrouter.ai" || !parsed.pathname.startsWith("/api/v1/videos/")) {
    throw new Error("OpenRouter trả về đường dẫn video không hợp lệ.");
  }
  const response = await fetch(parsed, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Không tải được video từ OpenRouter (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 120 * 1024 * 1024) throw new Error("Video rỗng hoặc vượt quá 120 MB.");
  return bytes;
}
