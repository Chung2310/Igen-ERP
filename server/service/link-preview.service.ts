/**
 * Link Preview Service (unfurl OG metadata)
 * ─────────────────────────────────────────
 * Lấy tiêu đề/mô tả/ảnh của một URL để hiển thị thẻ xem trước trong chat.
 *
 * Phòng SSRF: chỉ http/https, chặn IP nội bộ/loopback/link-local (gồm 169.254.169.254),
 * timeout, giới hạn kích thước tải, chỉ đọc text/html. Có cache in-memory theo TTL.
 */

import dns from "dns";
import net from "net";

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 giờ
const MAX_BYTES = 512 * 1024; // 512KB
const FETCH_TIMEOUT_MS = 6000;

const cache = new Map<string, { data: LinkPreview; expiresAt: number }>();

/** Kiểm tra một địa chỉ IP có thuộc dải nội bộ/không định tuyến công cộng không. */
function isPrivateIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, ""); // IPv4-mapped IPv6
  if (net.isIPv4(v)) {
    const p = v.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local (AWS metadata)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  // Nếu là IP literal → kiểm tra trực tiếp
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Không cho phép truy cập địa chỉ nội bộ.");
    return;
  }
  if (hostname === "localhost") throw new Error("Không cho phép truy cập địa chỉ nội bộ.");

  // Phân giải DNS và kiểm tra toàn bộ IP trả về
  const records = await dns.promises.lookup(hostname, { all: true });
  if (!records.length) throw new Error("Không phân giải được tên miền.");
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error("Tên miền trỏ tới địa chỉ nội bộ.");
  }
}

function extractMeta(html: string, url: string): LinkPreview {
  const pick = (patterns: RegExp[]): string => {
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return decodeEntities(m[1].trim());
    }
    return "";
  };

  const ogTitle = pick([
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
  ]);
  const title =
    ogTitle ||
    pick([/<title[^>]*>([^<]+)<\/title>/i]);

  const description = pick([
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  let image = pick([
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  ]);
  // Ảnh tương đối → tuyệt đối
  if (image && !/^https?:\/\//i.test(image)) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = "";
    }
  }

  const siteName = pick([
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  ]);

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* ignore */
  }

  return { url, title, description, image, siteName: siteName || host };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export const linkPreviewService = {
  async fetchPreview(rawUrl: string): Promise<LinkPreview> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("URL không hợp lệ.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Chỉ hỗ trợ đường dẫn http/https.");
    }

    const cached = cache.get(parsed.href);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let data: LinkPreview;
    try {
      const res = await fetch(parsed.href, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; IgenERP-LinkPreview/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok || !contentType.includes("text/html")) {
        // Không phải trang HTML → trả preview tối thiểu
        data = { url: parsed.href, title: "", description: "", image: "", siteName: parsed.hostname.replace(/^www\./, "") };
      } else {
        // Đọc tối đa MAX_BYTES
        const reader = res.body?.getReader();
        let received = 0;
        const chunks: Uint8Array[] = [];
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              received += value.length;
              chunks.push(value);
              if (received >= MAX_BYTES) {
                try { await reader.cancel(); } catch { /* ignore */ }
                break;
              }
            }
          }
        }
        const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
        data = extractMeta(html, parsed.href);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") throw new Error("Hết thời gian tải trang xem trước.");
      throw new Error("Không lấy được thông tin xem trước liên kết.");
    } finally {
      clearTimeout(timer);
    }

    cache.set(parsed.href, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  },
};
