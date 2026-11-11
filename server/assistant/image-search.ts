import sharp from "sharp";
import type { AssistantIllustration } from "../../src/shared/assistant-document";

const commonsApiUrl = "https://commons.wikimedia.org/w/api.php";
const resultCache = new Map<string, { expiresAt: number; result: AssistantCommonsImageResult | null }>();
const inFlightSearches = new Map<string, Promise<AssistantCommonsImageResult | null>>();
const rasterMimeTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function safeCommonsImageUrl(value: unknown): string | null {
  const url = safeHttpsUrl(value);
  if (!url || !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(new URL(url).hostname)) return null;
  return url;
}

function safeCommonsPageUrl(value: unknown): string | null {
  const url = safeHttpsUrl(value);
  if (!url || new URL(url).hostname !== "commons.wikimedia.org") return null;
  return url;
}

function commonsUserAgent(): string {
  try {
    const configuredUrl = process.env.APP_URL?.trim() || "https://igen-erp.app";
    const url = new URL(configuredUrl);
    if (url.protocol === "http:" || url.protocol === "https:") return `iGen-ERP/1.0 (${url.origin})`;
  } catch { /* Use the public application URL when APP_URL is absent or invalid. */ }
  return "iGen-ERP/1.0 (https://igen-erp.app)";
}

async function boundedBody(response: Response, maxBytes: number): Promise<Buffer | null> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

async function loadCommonsThumbnail(value: unknown): Promise<string | null> {
  const url = safeCommonsImageUrl(value);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": commonsUserAgent() },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (!response.ok || !rasterMimeTypes.has(mimeType)) return null;
    const bytes = await boundedBody(response, 2_000_000);
    if (!bytes) return null;
    const optimized = await sharp(bytes, { limitInputPixels: 16_000_000 })
      .rotate()
      .resize({ width: 768, height: 512, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 65 })
      .toBuffer();
    if (!optimized.length || optimized.length > 250_000) return null;
    return `data:image/webp;base64,${optimized.toString("base64")}`;
  } catch {
    return null;
  }
}

function plainMetadata(value: unknown, maxLength = 240): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

interface CommonsImagePage {
  title?: unknown;
  fullurl?: unknown;
  imageinfo?: Array<{
    mime?: unknown;
    thumburl?: unknown;
    extmetadata?: Record<string, { value?: unknown } | undefined>;
  }>;
}

export interface AssistantCommonsImageResult {
  illustration: AssistantIllustration;
  source: { title: string; url: string };
}

async function searchCommons(question: string): Promise<AssistantCommonsImageResult | null> {
  const endpoint = new URL(commonsApiUrl);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("formatversion", "2");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", question.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180));
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", "5");
  endpoint.searchParams.set("gsrwhat", "text");
  endpoint.searchParams.set("prop", "info|imageinfo");
  endpoint.searchParams.set("inprop", "url");
  endpoint.searchParams.set("iiprop", "mime|url|extmetadata");
  endpoint.searchParams.set("iiurlwidth", "768");

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json", "user-agent": commonsUserAgent() },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: CommonsImagePage[] } };
    const pages = Array.isArray(payload.query?.pages) ? payload.query.pages.slice(0, 5) : [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const mimeType = typeof info?.mime === "string" ? info.mime.toLowerCase() : "";
      if (!info || !rasterMimeTypes.has(mimeType)) continue;

      const metadata = info.extmetadata || {};
      const license = plainMetadata(metadata.LicenseShortName?.value || metadata.UsageTerms?.value, 120);
      const sourceUrl = safeCommonsPageUrl(page.fullurl);
      if (!license || !sourceUrl) continue;

      const imageUrl = await loadCommonsThumbnail(info.thumburl);
      if (!imageUrl) continue;

      const title = typeof page.title === "string"
        ? page.title.replace(/^File:/i, "").replace(/_/g, " ").slice(0, 240)
        : "Ảnh Wikimedia Commons";
      const artist = plainMetadata(metadata.Artist?.value || metadata.Credit?.value, 240);
      const sourceCredit = [artist ? `Tác giả: ${artist}` : "Ghi công theo trang nguồn", `Giấy phép: ${license}`].join(" · ");
      return {
        illustration: { alt: `Ảnh minh họa: ${title}`, url: imageUrl, sourceTitle: title, sourceUrl, sourceCredit },
        source: { title, url: sourceUrl },
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function searchAssistantCommonsImage(question: string): Promise<AssistantCommonsImageResult | null> {
  const query = question.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!query) return null;
  const cacheKey = query.toLocaleLowerCase("vi");
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  resultCache.delete(cacheKey);

  const currentSearch = inFlightSearches.get(cacheKey);
  if (currentSearch) return currentSearch;

  const search = searchCommons(query);
  inFlightSearches.set(cacheKey, search);
  try {
    const result = await search;
    if (resultCache.size >= 200) resultCache.delete(resultCache.keys().next().value as string);
    resultCache.set(cacheKey, { expiresAt: Date.now() + (result ? 6 * 60 * 60 * 1000 : 30 * 60 * 1000), result });
    return result;
  } finally {
    inFlightSearches.delete(cacheKey);
  }
}
