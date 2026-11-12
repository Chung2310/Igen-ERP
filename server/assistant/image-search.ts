import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AssistantIllustration } from "../../src/shared/assistant-document";

const commonsApiUrl = "https://commons.wikimedia.org/w/api.php";
const wikipediaApiUrls = [
  "https://vi.wikipedia.org/w/api.php",
  "https://en.wikipedia.org/w/api.php",
] as const;
const resultCache = new Map<string, { expiresAt: number; result: AssistantCommonsImageResult | null }>();
const inFlightSearches = new Map<string, Promise<AssistantCommonsImageResult | null>>();
const rasterMimeTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);

const STOPWORDS = new Set([
  "va", "hoac", "cua", "cho", "trong", "tren", "duoi", "voi", "cac", "nhung",
  "mot", "nay", "do", "khi", "neu", "thi", "ma", "de", "tu", "den", "ve",
  "la", "co", "duoc", "bi", "theo", "nhu", "rat", "nhieu", "it", "hon",
  "nhat", "nam", "thang", "ngay", "gio", "phut", "ai", "gi", "nao", "dau",
  "sao", "the", "of", "in", "and", "or", "for", "to", "on", "at", "by",
  "with", "from", "about", "what", "who", "where", "when", "why", "how",
  "is", "are", "was", "were", "file", "image", "photo", "jpg", "jpeg", "png", "webp",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}

function tokenizeWords(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 2 && !STOPWORDS.has(token));
}

export interface ExtractedImageSubjectQuery {
  query: string;
  tokens: string[];
  explicitImageRequest: boolean;
}

export function extractImageSubjectQuery(rawQuestion: string): ExtractedImageSubjectQuery | null {
  const trimmed = rawQuestion.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const normalized = normalizeText(trimmed);
  if (/\b(?:khong can|khong them|bo qua|dung them) (?:anh|hinh|hinh anh|image|picture)\b/.test(normalized)) {
    return null;
  }
  if (/^(?:xin chao(?: ban)?|chao(?: ban)?|hello|hi|hey|cam on(?: ban)?|thank you|thanks|ok|okay|oke)[.!?\s]*$/.test(normalized)) {
    return null;
  }

  const explicitImageRequest = /\b(?:anh minh hoa|hinh minh hoa|hinh anh|xem anh|xem hinh|chan dung|ban do|so do|image|picture|photo|illustration|diagram)\b/.test(normalized);

  if (!explicitImageRequest) {
    // Do not attach stock photos to price quotes, financial rates, weather, code, math, writing, or multi-item comparisons.
    if (/\b(?:gia vang|sjc|9999|24k|ty gia|lai suat|chung khoan|co phieu|trai phieu|xo so|thoi tiet|lich thi dau|bang gia|bao nhieu tien|thue thu nhap|luong toi thieu)\b/.test(normalized)) {
      return null;
    }
    if (/\b(?:viet code|doan ma|ma nguon|ham|function|script|sql|python|javascript|typescript|cong thuc|tinh toan|phuong trinh|dich sang|translate|viet email|viet bai|tom tat|so sanh|phan biet|huong dan|quy trinh|thu tuc|luat|nghi dinh|thong tu)\b/.test(normalized)) {
      return null;
    }
  }

  let cleaned = trimmed
    .replace(/^(?:(?:xin chao|chao ban|ban oi|minh muon hoi|cho minh hoi|cho toi hoi|cho hoi|cho minh biet|cho toi biet|giup minh|giup toi|hay cho biet|hay giai thich|giai thich ve|giai thich|tim hieu ve|tim hieu|tra cuu ve|tra cuu|thong tin ve|thong tin|gioi thieu ve|gioi thieu|ke ve|phan tich ve|phan tich|cho minh xem|cho toi xem|cho xem|xem anh|xem hinh|hinh anh ve|hinh anh cua|hinh anh|anh minh hoa ve|anh minh hoa cua|anh minh hoa|hinh minh hoa ve|hinh minh hoa|chan dung cua|chan dung|ban do cua|ban do|so do cua|so do|ve minh hoa|ai la|cai gi la|dau la)[:\s,]+)+/iu, "")
    .replace(/^(?:(?:cho mình biết|cho tôi biết|giúp mình|giúp tôi|hãy cho biết|hãy giải thích|giải thích về|giải thích|tìm hiểu về|tìm hiểu|tra cứu về|tra cứu|thông tin về|thông tin|giới thiệu về|giới thiệu|kể về|phân tích về|phân tích|cho mình xem|cho tôi xem|cho xem|xem ảnh|xem hình|hình ảnh về|hình ảnh của|hình ảnh|ảnh minh họa về|ảnh minh họa của|ảnh minh họa|hình minh họa về|hình minh họa|chân dung của|chân dung|bản đồ của|bản đồ|sơ đồ của|sơ đồ|vẽ minh họa|ai là|cái gì là|đâu là)[:\s,]+)+/iu, "")
    .replace(/(?:\s+(?:la gi|la ai|o dau|nhu the nao|lam the nao|ra sao|vi sao|tai sao|khi nao|bao nhieu|hien nay|hom nay|nam nay|moi nhat|chi tiet|cu the|khong|nhe|nha|vay|a|ạ|là gì|là ai|ở đâu|như thế nào|làm thế nào|vì sao|tại sao|khi nào|bao nhiêu|hiện nay|hôm nay|năm nay|mới nhất|chi tiết|cụ thể|không|nhé|nhậy))[?!.,;:\s]*$/iu, "")
    .replace(/[?!.,;:"“”'‘’()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) cleaned = trimmed;
  const tokens = [...new Set(tokenizeWords(cleaned))];
  if (!tokens.length || tokens.length > 6) return null;

  return {
    query: cleaned.slice(0, 140),
    tokens,
    explicitImageRequest,
  };
}

export function isRelevantImageCandidate(
  candidateTitle: string,
  candidateDescription: string,
  subjectTokens: readonly string[],
  explicitImageRequest = false,
): boolean {
  if (!subjectTokens.length) return false;
  const normalizedTitle = normalizeText(candidateTitle);
  if (/\.(?:svg|pdf|djvu|tif|tiff|ogg|oga|ogv|webm|mp3|wav|flac)$/i.test(candidateTitle.trim())) {
    return false;
  }
  if (/\b(?:disambig|question book|commons logo|ambox|icon|stub|wikidata|symbol|blank map|page\d+|scan|signature|autograph|logo)\b/.test(normalizedTitle)) {
    return false;
  }

  const titleTokenSet = new Set(tokenizeWords(candidateTitle));
  const combinedTokenSet = new Set([
    ...titleTokenSet,
    ...tokenizeWords(candidateDescription),
  ]);

  const titleMatches = subjectTokens.filter(token => titleTokenSet.has(token)).length;
  if (titleMatches === 0) return false;

  const combinedMatches = subjectTokens.filter(token => combinedTokenSet.has(token)).length;
  const requiredRatio = subjectTokens.length <= 2 ? 1 : (explicitImageRequest ? 0.66 : 0.75);
  return combinedMatches >= Math.ceil(subjectTokens.length * requiredRatio);
}

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

function safeWikimediaPageUrl(value: unknown): string | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const host = new URL(url).hostname;
  if (!["commons.wikimedia.org", "vi.wikipedia.org", "en.wikipedia.org"].includes(host)) return null;
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
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.url && !safeCommonsImageUrl(response.url)) return null;
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

interface WikipediaSearchPage {
  title?: unknown;
  fullurl?: unknown;
  description?: unknown;
  pageimage?: unknown;
  thumbnail?: {
    source?: unknown;
  };
}

export interface AssistantCommonsImageResult {
  illustration: AssistantIllustration;
  source: { title: string; url: string };
}

async function searchWikipediaLeadImage(subject: ExtractedImageSubjectQuery): Promise<AssistantCommonsImageResult | null> {
  for (const apiBase of wikipediaApiUrls) {
    const endpoint = new URL(apiBase);
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("formatversion", "2");
    endpoint.searchParams.set("redirects", "1");
    endpoint.searchParams.set("generator", "search");
    endpoint.searchParams.set("gsrsearch", subject.query);
    endpoint.searchParams.set("gsrlimit", "3");
    endpoint.searchParams.set("prop", "pageimages|info|description");
    endpoint.searchParams.set("inprop", "url");
    endpoint.searchParams.set("piprop", "name|thumbnail");
    endpoint.searchParams.set("pithumbsize", "768");

    try {
      const response = await fetch(endpoint, {
        headers: { accept: "application/json", "user-agent": commonsUserAgent() },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { query?: { pages?: WikipediaSearchPage[] } };
      const pages = Array.isArray(payload.query?.pages) ? payload.query.pages.slice(0, 3) : [];
      for (const page of pages) {
        const title = typeof page.title === "string" ? page.title.trim() : "";
        const pageImage = typeof page.pageimage === "string" ? page.pageimage.replace(/_/g, " ") : "";
        const description = typeof page.description === "string" ? page.description : "";
        if (!title || !page.thumbnail?.source) continue;
        if (pageImage && !isRelevantImageCandidate(title, `${description} ${pageImage}`, subject.tokens, subject.explicitImageRequest)) {
          continue;
        }
        if (!pageImage && !isRelevantImageCandidate(title, description, subject.tokens, subject.explicitImageRequest)) {
          continue;
        }
        const sourceUrl = safeWikimediaPageUrl(page.fullurl);
        if (!sourceUrl) continue;
        const imageUrl = await loadCommonsThumbnail(page.thumbnail.source);
        if (!imageUrl) continue;
        const cleanTitle = title.slice(0, 240);
        return {
          illustration: {
            alt: `Ảnh minh họa: ${cleanTitle}`,
            url: imageUrl,
            sourceTitle: cleanTitle,
            sourceUrl,
            sourceCredit: "Nguồn: Wikipedia / Wikimedia Commons",
          },
          source: { title: cleanTitle, url: sourceUrl },
        };
      }
    } catch {
      // Try next Wikipedia language or fall back to Wikimedia Commons.
    }
  }
  return null;
}

async function searchCommons(rawQuestion: string): Promise<AssistantCommonsImageResult | null> {
  const subject = extractImageSubjectQuery(rawQuestion);
  if (!subject) return null;

  const wikiLeadImage = await searchWikipediaLeadImage(subject);
  if (wikiLeadImage) return wikiLeadImage;

  const endpoint = new URL(commonsApiUrl);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("formatversion", "2");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", subject.query);
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

      const rawTitle = typeof page.title === "string" ? page.title.replace(/^File:/i, "").trim() : "";
      const title = rawTitle ? rawTitle.replace(/_/g, " ").slice(0, 240) : "";
      const metadata = info.extmetadata || {};
      const description = [
        plainMetadata(metadata.ObjectName?.value, 240),
        plainMetadata(metadata.ImageDescription?.value, 240),
      ].filter(Boolean).join(" ");
      if (!title || !isRelevantImageCandidate(rawTitle.replace(/_/g, " "), description, subject.tokens, subject.explicitImageRequest)) {
        continue;
      }

      const license = plainMetadata(metadata.LicenseShortName?.value || metadata.UsageTerms?.value, 120);
      const sourceUrl = safeWikimediaPageUrl(page.fullurl);
      if (!license || !sourceUrl) continue;

      const imageUrl = await loadCommonsThumbnail(info.thumburl);
      if (!imageUrl) continue;

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
  const subject = extractImageSubjectQuery(question);
  if (!subject) return null;
  const cacheKey = `${subject.explicitImageRequest ? "img:" : "topic:"}${subject.query.toLocaleLowerCase("vi")}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  resultCache.delete(cacheKey);

  const currentSearch = inFlightSearches.get(cacheKey);
  if (currentSearch) return currentSearch;

  const search = searchCommons(question);
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

const sourceIllustrationCache = new Map<string, { expiresAt: number; result: { illustration: AssistantIllustration; hash: string } | null }>();

export function isSafePublicWebUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    if (url.port && url.port !== "443" && url.port !== "80") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".lan") ||
      host.startsWith("[")
    ) {
      return null;
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
      const octets = host.split(".").map(Number);
      if (octets.some(octet => octet < 0 || octet > 255)) return null;
      const [a, b] = octets;
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      ) {
        return null;
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
}

function isLikelyDecorativeImageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const target = `${url.pathname}${url.search}`.toLowerCase();
    if (/\.(?:svg|ico|cur|pdf|djvu|mp4|webm|mp3|wav|ogg)$/i.test(url.pathname)) return true;
    if (/(?:^|[/_.-])(?:logo|favicon|apple-touch-icon|site-icon|avatar|sprite|badge|button|pixel|tracker|blank|placeholder|loading|spinner|emoji|1x1|default[-_]?share|og[-_]?default|no[-_]?image)(?:[/_.-]|$)/i.test(target)) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(attrPattern)) {
    const key = match[1].toLowerCase();
    const rawVal = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = decodeHtmlAttribute(rawVal);
  }
  return attrs;
}

export function extractSourcePageImageCandidates(
  html: string,
  baseUrl: string,
): Array<{ url: string; alt?: string }> {
  const candidates: Array<{ url: string; alt?: string; priority: number }> = [];
  const seenUrls = new Set<string>();

  const addCandidate = (rawUrl: string | undefined, priority: number, alt?: string) => {
    if (!rawUrl || rawUrl.startsWith("data:")) return;
    try {
      const resolved = new URL(decodeHtmlAttribute(rawUrl), baseUrl).toString();
      const safe = isSafePublicWebUrl(resolved);
      if (!safe || seenUrls.has(safe) || isLikelyDecorativeImageUrl(safe)) return;
      seenUrls.add(safe);
      candidates.push({
        url: safe,
        ...(alt ? { alt: plainMetadata(alt, 200) } : {}),
        priority,
      });
    } catch {
      // Ignore malformed relative URLs.
    }
  };

  let metaAlt = "";
  const headSlice = html.slice(0, 180_000);
  for (const match of headSlice.matchAll(/<meta\b[^>]+>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    const content = attrs.content || "";
    if (!key || !content) continue;
    if ((key === "og:image:alt" || key === "twitter:image:alt") && !metaAlt) {
      metaAlt = content;
    }
  }

  for (const match of headSlice.matchAll(/<meta\b[^>]+>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    const content = attrs.content || "";
    if (!key || !content) continue;
    if (key === "og:image:secure_url" || key === "og:image" || key === "og:image:url") {
      addCandidate(content, 1, metaAlt);
    } else if (key === "twitter:image" || key === "twitter:image:src") {
      addCandidate(content, 2, metaAlt);
    } else if (key === "image" || key === "thumbnailurl" || key === "thumbnail") {
      addCandidate(content, 3, metaAlt);
    }
  }

  for (const match of headSlice.matchAll(/<link\b[^>]+>/gi)) {
    const attrs = parseHtmlAttributes(match[0]);
    const rel = (attrs.rel || "").toLowerCase();
    if (rel === "image_src" && attrs.href) {
      addCandidate(attrs.href, 3, metaAlt);
    }
  }

  for (const match of headSlice.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const rawJson = match[1]?.trim();
    if (!rawJson || rawJson.length > 60_000) continue;
    try {
      const parsed = JSON.parse(rawJson);
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current || typeof current !== "object") continue;
        const record = current as Record<string, unknown>;
        if (Array.isArray(record["@graph"])) queue.push(...record["@graph"]);
        for (const field of ["image", "thumbnailUrl"]) {
          const val = record[field];
          if (typeof val === "string") addCandidate(val, 3, metaAlt);
          else if (Array.isArray(val)) {
            for (const item of val.slice(0, 3)) {
              if (typeof item === "string") addCandidate(item, 3, metaAlt);
              else if (item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string") {
                addCandidate(String((item as Record<string, unknown>).url), 3, metaAlt);
              }
            }
          } else if (val && typeof val === "object" && typeof (val as Record<string, unknown>).url === "string") {
            addCandidate(String((val as Record<string, unknown>).url), 3, metaAlt);
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  const articleMatch = /<(?:article|main)\b[^>]*>([\s\S]{0,160000}?)(?:<\/(?:article|main)>|$)/i.exec(html);
  const bodySlice = articleMatch ? articleMatch[1] : html.slice(0, 160_000);
  let imgCount = 0;
  for (const match of bodySlice.matchAll(/<img\b[^>]+>/gi)) {
    if (imgCount >= 8) break;
    const attrs = parseHtmlAttributes(match[0]);
    const width = Number(attrs.width);
    const height = Number(attrs.height);
    if ((Number.isFinite(width) && width > 0 && width < 140) || (Number.isFinite(height) && height > 0 && height < 100)) {
      continue;
    }
    const src = attrs["data-src"] || attrs["data-original"] || attrs["data-lazy-src"] || attrs.src;
    if (!src) continue;
    imgCount += 1;
    addCandidate(src, articleMatch ? 4 : 5, attrs.alt || metaAlt);
  }

  return candidates
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4)
    .map(({ url, alt }) => ({ url, ...(alt ? { alt } : {}) }));
}

async function loadAndOptimizeSourceImage(
  imageUrl: string,
  refererUrl?: string,
): Promise<{ dataUrl: string; hash: string } | null> {
  const safeUrl = isSafePublicWebUrl(imageUrl);
  if (!safeUrl) return null;
  try {
    const headers: Record<string, string> = {
      "user-agent": commonsUserAgent(),
      accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    };
    if (refererUrl) {
      try {
        headers.referer = new URL(refererUrl).origin + "/";
      } catch {
        // Ignore invalid referer.
      }
    }
    const response = await fetch(safeUrl, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(6_000),
    });
    if (response.url && !isSafePublicWebUrl(response.url)) return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
    if (!response.ok || !rasterMimeTypes.has(mimeType)) return null;
    const bytes = await boundedBody(response, 2_500_000);
    if (!bytes) return null;

    const image = sharp(bytes, { limitInputPixels: 20_000_000 });
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 160 || height < 120) return null;
    const aspectRatio = width / height;
    if (aspectRatio > 4.5 || aspectRatio < 0.22) return null;

    const optimized = await image
      .rotate()
      .resize({ width: 768, height: 512, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 68 })
      .toBuffer();
    if (!optimized.length || optimized.length > 250_000) return null;
    const hash = createHash("sha256").update(optimized).digest("hex").slice(0, 24);
    return {
      dataUrl: `data:image/webp;base64,${optimized.toString("base64")}`,
      hash,
    };
  } catch {
    return null;
  }
}

async function extractSingleSourceIllustration(
  source: { title: string; url: string },
): Promise<{ illustration: AssistantIllustration; hash: string } | null> {
  const safeSourceUrl = isSafePublicWebUrl(source.url);
  if (!safeSourceUrl) return null;

  const cached = sourceIllustrationCache.get(safeSourceUrl);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  sourceIllustrationCache.delete(safeSourceUrl);

  let found: { illustration: AssistantIllustration; hash: string } | null = null;
  try {
    const sourceTitle = plainMetadata(source.title, 200) || new URL(safeSourceUrl).hostname;
    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(new URL(safeSourceUrl).pathname)) {
      const loaded = await loadAndOptimizeSourceImage(safeSourceUrl);
      if (loaded) {
        found = {
          illustration: {
            alt: `Ảnh minh họa: ${sourceTitle}`,
            url: loaded.dataUrl,
            sourceTitle,
            sourceUrl: safeSourceUrl,
          },
          hash: loaded.hash,
        };
      }
    } else {
      const response = await fetch(safeSourceUrl, {
        headers: {
          "user-agent": commonsUserAgent(),
          accept: "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5_500),
      });
      const finalUrl = response.url ? isSafePublicWebUrl(response.url) : safeSourceUrl;
      if (response.ok && finalUrl) {
        const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "";
        if (rasterMimeTypes.has(contentType)) {
          const bytes = await boundedBody(response, 2_500_000);
          if (bytes) {
            const image = sharp(bytes, { limitInputPixels: 20_000_000 });
            const metadata = await image.metadata();
            if ((metadata.width ?? 0) >= 160 && (metadata.height ?? 0) >= 120) {
              const optimized = await image
                .rotate()
                .resize({ width: 768, height: 512, fit: "inside", withoutEnlargement: true })
                .webp({ quality: 68 })
                .toBuffer();
              if (optimized.length && optimized.length <= 250_000) {
                const hash = createHash("sha256").update(optimized).digest("hex").slice(0, 24);
                found = {
                  illustration: {
                    alt: `Ảnh minh họa: ${sourceTitle}`,
                    url: `data:image/webp;base64,${optimized.toString("base64")}`,
                    sourceTitle,
                    sourceUrl: safeSourceUrl,
                  },
                  hash,
                };
              }
            }
          }
        } else if (contentType.includes("html") || contentType.includes("xml")) {
          const htmlBytes = await boundedBody(response, 350_000);
          if (htmlBytes) {
            const html = htmlBytes.toString("utf8");
            const candidates = extractSourcePageImageCandidates(html, finalUrl);
            for (const candidate of candidates.slice(0, 2)) {
              const loaded = await loadAndOptimizeSourceImage(candidate.url, finalUrl);
              if (loaded) {
                found = {
                  illustration: {
                    alt: candidate.alt ? `Ảnh minh họa: ${candidate.alt}` : `Ảnh minh họa: ${sourceTitle}`,
                    url: loaded.dataUrl,
                    sourceTitle,
                    sourceUrl: safeSourceUrl,
                  },
                  hash: loaded.hash,
                };
                break;
              }
            }
          }
        }
      }
    }
  } catch {
    found = null;
  }

  if (sourceIllustrationCache.size >= 200) {
    sourceIllustrationCache.delete(sourceIllustrationCache.keys().next().value as string);
  }
  sourceIllustrationCache.set(safeSourceUrl, {
    expiresAt: Date.now() + (found ? 2 * 60 * 60 * 1000 : 15 * 60 * 1000),
    result: found,
  });
  return found;
}

export async function extractIllustrationsFromSources(
  sources: ReadonlyArray<{ title: string; url: string }>,
  options?: { maxSources?: number; maxIllustrations?: number },
): Promise<AssistantIllustration[]> {
  const maxSources = options?.maxSources ?? 5;
  const maxIllustrations = options?.maxIllustrations ?? 4;
  const targetSources = sources.slice(0, maxSources);
  if (!targetSources.length) return [];

  const extracted = await Promise.all(targetSources.map(source => extractSingleSourceIllustration(source)));
  const uniqueIllustrations: AssistantIllustration[] = [];
  const seenHashes = new Set<string>();

  for (const item of extracted) {
    if (!item || seenHashes.has(item.hash)) continue;
    seenHashes.add(item.hash);
    uniqueIllustrations.push(item.illustration);
    if (uniqueIllustrations.length >= maxIllustrations) break;
  }

  return uniqueIllustrations;
}
