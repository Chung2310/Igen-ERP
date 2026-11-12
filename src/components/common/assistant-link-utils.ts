const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
]);

function trimUrlCandidate(value: string): string {
  return value.trim().replace(/[.,;:!?]+$/, "");
}

export function safeAssistantHttpUrl(value: string): string | null {
  try {
    let url = new URL(trimUrlCandidate(value));
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
    if ((url.hostname === "www.google.com" || url.hostname === "google.com") && url.pathname === "/url") {
      const target = url.searchParams.get("q") || url.searchParams.get("url");
      if (target) {
        const inner = new URL(trimUrlCandidate(target));
        if ((inner.protocol === "http:" || inner.protocol === "https:") && !inner.username && !inner.password) {
          url = inner;
        }
      }
    }
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    if (url.hash === "#") url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function canonicalAssistantLinkUrl(value: string): string | null {
  const safe = safeAssistantHttpUrl(value);
  if (!safe) return null;
  try {
    const url = new URL(safe);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
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
