import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent, buildConnector, fetch as undiciFetch } from "undici";
import sanitizeHtml from "sanitize-html";
import { AssistantError } from "./policy";

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const MAX_PAGE_CHARACTERS = 10_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const BLOCKED_CONTENT_TAGS = new Set(["script", "style", "noscript", "svg", "iframe", "nav", "header", "footer", "aside", "form"]);

type DnsAddress = { address: string; family: number };

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second, third] = parts;
  if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && (second === 0 || second === 168 || (second === 88 && third === 99))) return false;
  if (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) return false;
  if (first === 203 && second === 0 && third === 113) return false;
  return true;
}

function expandIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0];
  const ipv4Tail = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  const source = ipv4Tail
    ? normalized.replace(ipv4Tail, (() => {
      const parts = ipv4Tail.split(".").map(Number);
      if (parts.some(part => part < 0 || part > 255)) return "";
      return `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
    })())
    : normalized;
  const halves = source.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fillCount = 8 - left.length - right.length;
  if ((halves.length === 1 && fillCount !== 0) || (halves.length === 2 && fillCount < 1)) return null;
  const parts = [...left, ...Array.from({ length: fillCount }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some(part => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.map(part => Number.parseInt(part, 16));
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address.split("%")[0]);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const groups = expandIpv6(address);
  if (!groups) return false;
  if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff) {
    const ipv4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isPublicIpv4(ipv4);
  }
  const first = groups[0];
  if ((first & 0xe000) !== 0x2000) return false; // Global unicast only.
  if (groups[0] === 0x2001 && (groups[1] === 0x0db8 || groups[1] === 0x0000 || groups[1] === 0x0010)) return false;
  return true;
}

export function validateWebUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AssistantError("Liên kết không hợp lệ. Hãy kiểm tra lại URL.", 400);
  }
  if (!(["http:", "https:"].includes(url.protocol)) || url.username || url.password) {
    throw new AssistantError("Chỉ hỗ trợ liên kết HTTP hoặc HTTPS công khai.", 400);
  }
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new AssistantError("Liên kết phải dùng cổng HTTP hoặc HTTPS mặc định.", 400);
  }
  if (isIP(unbracketHostname(url.hostname)) && !isPublicIpAddress(unbracketHostname(url.hostname))) {
    throw new AssistantError("Không thể đọc địa chỉ mạng nội bộ hoặc địa chỉ IP không công khai.", 400);
  }
  return url;
}

function unbracketHostname(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function decodeCommonEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|nbsp|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    const value = code.toLowerCase();
    if (value === "nbsp") return " ";
    if (value === "amp") return "&";
    if (value === "quot") return '"';
    if (value === "apos") return "'";
    if (value === "lt") return "<";
    if (value === "gt") return ">";
    const point = value.startsWith("#x") ? Number.parseInt(value.slice(2), 16) : Number.parseInt(value.slice(1), 10);
    try { return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ""; }
    catch { return ""; }
  });
}

function readableText(html: string): string {
  const withoutNonContentSections = html.replace(/<(script|style|noscript|svg|iframe|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const safeMarkup = sanitizeHtml(withoutNonContentSections, {
    allowedTags: ["title", "main", "article", "section", "h1", "h2", "h3", "h4", "p", "br", "li", "ul", "ol", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "pre", "code", "div"],
    allowedAttributes: {},
    exclusiveFilter: frame => BLOCKED_CONTENT_TAGS.has(frame.tag),
  });
  return decodeCommonEntities(safeMarkup
    .replace(/<\/(?:title|main|article|section|h[1-4]|p|li|ul|ol|table|thead|tbody|tr|blockquote|pre|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\t\f\v ]+\n/g, "\n")
    .replace(/\n[\t ]+/g, "\n")
    .replace(/[\t\f\v ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_PAGE_CHARACTERS);
}

function extractTitle(html: string, fallback: string): string {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  if (!titleMatch) return fallback;
  const title = readableText(titleMatch[1]).replace(/\s+/g, " ").trim();
  return title.slice(0, 120) || fallback;
}

export function parseWebpageHtml(html: string, fallbackTitle: string): { title: string; text: string } {
  const text = readableText(html);
  if (!text) throw new AssistantError("Không tìm thấy nội dung văn bản trên trang web này.", 422);
  return { title: extractTitle(html, fallbackTitle), text };
}

async function resolvePublicAddresses(hostname: string): Promise<DnsAddress[]> {
  let addresses: DnsAddress[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AssistantError("Không tìm thấy máy chủ của liên kết này.", 422);
  }
  if (!addresses.length || addresses.some(record => !isPublicIpAddress(record.address))) {
    throw new AssistantError("Liên kết trỏ đến mạng nội bộ hoặc địa chỉ không công khai.", 400);
  }
  return addresses;
}

function createPinnedLookup(expectedHostname: string, addresses: DnsAddress[]): LookupFunction {
  return (hostname, options, callback) => {
    if (hostname.toLowerCase() !== expectedHostname.toLowerCase()) {
      callback(new Error("Unexpected hostname during connection."), "", 0);
      return;
    }
    const matching = addresses.filter(record => !options.family || record.family === options.family);
    if (!matching.length) {
      callback(new Error("No safe address for this connection."), "", 0);
      return;
    }
    if (options.all) callback(null, matching);
    else callback(null, matching[0].address, matching[0].family);
  };
}

async function requestPublicPage(url: URL, redirects = 0): Promise<{ url: URL; contentType: string; body: string }> {
  const hostname = unbracketHostname(url.hostname);
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolvePublicAddresses(hostname);
  const connector = buildConnector({ lookup: createPinnedLookup(hostname, addresses), timeout: FETCH_TIMEOUT_MS });
  const dispatcher = new Agent({ connect: connector, maxResponseSize: MAX_PAGE_BYTES });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await undiciFetch(url, {
      dispatcher,
      redirect: "manual",
      signal: abortController.signal,
      headers: { "user-agent": "iGenERP-KnowledgeFetcher/1.0", accept: "text/html,application/xhtml+xml,text/plain;q=0.9" },
    });
    const discardResponse = async () => { try { await response.body?.cancel(); } catch { /* The connection will close with its dispatcher. */ } };
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects >= MAX_REDIRECTS) { await discardResponse(); throw new AssistantError("Liên kết chuyển hướng quá nhiều lần.", 422); }
      let nextUrl: URL;
      try { nextUrl = validateWebUrl(new URL(location, url).toString()); }
      catch (error) { await discardResponse(); throw error; }
      await discardResponse();
      return await requestPublicPage(nextUrl, redirects + 1);
    }
    if (!response.ok) { await discardResponse(); throw new AssistantError(`Trang web phản hồi lỗi (${response.status}).`, 422); }
    const contentType = response.headers.get("content-type") || "";
    if (!/^(text\/html|application\/xhtml\+xml|text\/plain)(?:\s*;|$)/i.test(contentType)) {
      await discardResponse();
      throw new AssistantError("Liên kết không trỏ đến trang HTML hoặc văn bản có thể đọc được.", 415);
    }
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_PAGE_BYTES) { await discardResponse(); throw new AssistantError("Trang web vượt quá dung lượng cho phép để đọc.", 413); }
    const reader = response.body?.getReader();
    if (!reader) { await discardResponse(); throw new AssistantError("Trang web không có nội dung để đọc.", 422); }
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_PAGE_BYTES) {
        await reader.cancel();
        throw new AssistantError("Trang web vượt quá dung lượng cho phép để đọc.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { url, contentType, body: new TextDecoder().decode(bytes) };
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    if (abortController.signal.aborted) throw new AssistantError("Đọc trang web quá thời gian. Hãy thử lại sau.", 408);
    throw new AssistantError("Không thể đọc nội dung từ liên kết này.", 422);
  } finally {
    clearTimeout(timeout);
    await dispatcher.close().catch(() => undefined);
  }
}

export async function extractWebpageText(rawUrl: string): Promise<{ url: string; title: string; text: string }> {
  const page = await requestPublicPage(validateWebUrl(rawUrl));
  const isPlainText = /^text\/plain(?:\s*;|$)/i.test(page.contentType);
  const parsed = isPlainText
    ? { title: page.url.hostname, text: page.body.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PAGE_CHARACTERS) }
    : parseWebpageHtml(page.body, page.url.hostname);
  if (!parsed.text) throw new AssistantError("Không tìm thấy nội dung văn bản trên trang web này.", 422);
  return { url: page.url.href, ...parsed };
}
