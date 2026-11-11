export function safeAssistantHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isAssistantImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(url.pathname) || /\.(?:gstatic\.com|googleusercontent\.com)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function assistantSourceKind(value: string): "image" | "document" | "website" {
  if (isAssistantImageUrl(value)) return "image";
  try {
    if (/\.(?:pdf|docx?|xlsx?|pptx?|csv|odt|ods|odp|md|txt)$/i.test(new URL(value).pathname)) return "document";
  } catch {
    return "website";
  }
  return "website";
}

export function safeAssistantIllustrationUrl(value: string): string | null {
  if (value.length > 1_500_000) return null;
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
  const safeUrl = safeAssistantHttpUrl(value);
  if (!safeUrl) return null;
  try { return new URL(safeUrl).protocol === "https:" ? safeUrl : null; } catch { return null; }
}
