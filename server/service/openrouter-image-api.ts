export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-lite-image";
export const RECRAFT_IMAGE_MODEL = "recraft/recraft-v4.1-flash";
export const IMAGE_EDIT_MODEL = "google/gemini-3.1-flash-image";
export const RECRAFT_ASPECT_RATIOS = new Set(["1:1", "4:3", "3:4", "16:9", "9:16"]);

/** Text-only image models use OpenRouter's dedicated Images API. */
export async function generateImageViaImagesApi(
  apiKey: string,
  model: string,
  prompt: string,
  aspectRatio?: string,
  quality?: "low" | "medium" | "high",
): Promise<{ url: string }> {
  const response = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_URL || "https://igen-erp.app",
      "X-Title": "iGen ERP",
    },
    body: JSON.stringify({
      model,
      prompt,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(quality ? { quality } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`OpenRouter Images API lỗi ${response.status}: ${detail}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const result = await response.json() as { data?: Array<{ b64_json?: string; media_type?: string; url?: string }> };
  const image = result.data?.[0];
  if (image?.b64_json) return { url: `data:${image.media_type || "image/png"};base64,${image.b64_json}` };
  if (image?.url && /^https:\/\//.test(image.url)) return { url: image.url };
  throw new Error("OpenRouter Images API không trả về ảnh.");
}

export async function generateRecraftImage(apiKey: string, prompt: string, aspectRatio?: string): Promise<{ url: string }> {
  return generateImageViaImagesApi(apiKey, RECRAFT_IMAGE_MODEL, prompt, aspectRatio);
}
