import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import sanitizeHtml from "sanitize-html";
import { extractSpeechDocument } from "./studio-speech-document";
import { AssistantError } from "./policy";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 10_000;
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

function cleanText(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function capText(value: string): string {
  const text = cleanText(value);
  if (!text) throw new AssistantError("Không tìm thấy nội dung văn bản trong nguồn đã chọn.", 422);
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new AssistantError("Nội dung trích xuất vượt quá 10.000 ký tự. Hãy chia nhỏ nguồn rồi thử lại.", 413);
  }
  return text;
}

function extractPowerPointText(buffer: Buffer): string {
  if (!buffer.subarray(0, 2).equals(Buffer.from("PK"))) {
    throw new AssistantError("Tệp PowerPoint không đúng định dạng PPTX hoặc bị hỏng.", 422);
  }
  let archive: AdmZip;
  try { archive = new AdmZip(buffer); }
  catch { throw new AssistantError("Không thể đọc nội dung tệp PowerPoint. Hãy kiểm tra tệp PPTX rồi thử lại.", 422); }

  const slides = archive.getEntries()
    .filter(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName))
    .sort((first, second) => Number(first.entryName.match(/slide(\d+)/i)?.[1]) - Number(second.entryName.match(/slide(\d+)/i)?.[1]));
  if (slides.length > 100) throw new AssistantError("Tệp PowerPoint có quá 100 trang chiếu.", 413);

  const output: string[] = [];
  let extractedBytes = 0;
  for (const slide of slides) {
    if (slide.header.size > 2 * 1024 * 1024 || extractedBytes + slide.header.size > 12 * 1024 * 1024) {
      throw new AssistantError("Nội dung giải nén của tệp PowerPoint quá lớn.", 413);
    }
    extractedBytes += slide.header.size;
    try {
      const xml = new DOMParser().parseFromString(slide.getData().toString("utf8"), "application/xml");
      if (xml.getElementsByTagName("parsererror").length) throw new Error("Invalid XML");
      const nodes = xml.getElementsByTagNameNS(DRAWING_NS, "t");
      const parts: string[] = [];
      for (let index = 0; index < nodes.length; index += 1) {
        const value = nodes.item(index)?.textContent?.trim();
        if (value) parts.push(value);
      }
      if (parts.length) output.push(parts.join(" · "));
    } catch {
      throw new AssistantError("Không đọc được một trang chiếu trong tệp PPTX.", 422);
    }
  }
  return capText(output.join("\n"));
}

function isPrivateAddress(address: string, family: number): boolean {
  if (family === 4) {
    const parts = address.split(".").map(Number);
    const [a, b, c] = parts;
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0 && c === 0)
      || (a === 192 && b === 0 && c === 2)
      || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100)
      || (a === 203 && b === 0 && c === 113);
  }
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7), 4);
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff")) return true;
  const firstBlock = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return firstBlock < 0x2000 || firstBlock > 0x3fff || normalized.startsWith("2001:db8:");
}

async function readPublicPage(urlValue: string): Promise<{ title: string; text: string }> {
  let url: URL;
  try { url = new URL(urlValue); }
  catch { throw new AssistantError("Nhập một đường dẫn web hợp lệ để tạo mindmap.", 400); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new AssistantError("Chỉ hỗ trợ đường dẫn HTTP hoặc HTTPS công khai.", 400);
  }
  if ((url.protocol === "https:" && url.port && url.port !== "443") || (url.protocol === "http:" && url.port && url.port !== "80")) {
    throw new AssistantError("Đường dẫn cần dùng cổng HTTP hoặc HTTPS mặc định.", 400);
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new AssistantError("Đường dẫn phải trỏ đến một trang web công khai.", 400);
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AssistantError("Không phân giải được đường dẫn web. Hãy kiểm tra lại địa chỉ.", 422);
  }
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address, item.family))) {
    throw new AssistantError("Đường dẫn phải trỏ đến một máy chủ web công khai.", 400);
  }

  const target = addresses[0];
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const page = await new Promise<{ contentType: string; body: string }>((resolve, reject) => {
    const request = transport({
      hostname: target.address,
      family: target.family,
      port: url.protocol === "https:" ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { Host: url.host, Accept: "text/html,application/xhtml+xml,text/plain", "Accept-Encoding": "identity", "User-Agent": "iGenERP-AI-Studio/1.0" },
      ...(url.protocol === "https:" ? { servername: hostname } : {}),
    }, response => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400) {
        response.resume();
        reject(new AssistantError("Trang web chuyển hướng. Hãy dán đường dẫn đích sau khi chuyển hướng.", 422));
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new AssistantError("Không tải được nội dung trang web này.", 422));
        return;
      }
      const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!/^(text\/html|application\/xhtml\+xml|text\/plain)$/.test(contentType)) {
        response.resume();
        reject(new AssistantError("Đường dẫn cần mở một trang HTML hoặc văn bản công khai.", 415));
        return;
      }
      const contentLength = Number(response.headers["content-length"] || 0);
      if (contentLength > MAX_PAGE_BYTES) {
        response.destroy();
        reject(new AssistantError("Nội dung trang web vượt quá giới hạn đọc 2 MB.", 413));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_PAGE_BYTES) {
          response.destroy(new Error("PAGE_TOO_LARGE"));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => resolve({ contentType, body: Buffer.concat(chunks).toString("utf8") }));
      response.on("error", error => reject(error.message === "PAGE_TOO_LARGE" ? new AssistantError("Nội dung trang web vượt quá giới hạn đọc 2 MB.", 413) : error));
    });
    request.setTimeout(12_000, () => request.destroy(new AssistantError("Trang web phản hồi quá lâu. Hãy thử lại sau.", 504)));
    request.on("error", reject);
    request.end();
  }).catch(error => {
    if (error instanceof AssistantError) throw error;
    throw new AssistantError("Không thể tải nội dung trang web lúc này.", 502);
  });

  const title = page.contentType === "text/plain"
    ? ""
    : page.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim().slice(0, 120) || "";
  const text = page.contentType === "text/plain"
    ? page.body
    : sanitizeHtml(page.body, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/gi, " ").replace(/&#39;/g, "'");
  return { title, text: capText(text) };
}

export async function resolveStudioMindmapSource(input: {
  sourceType: "text" | "document" | "link";
  prompt: string;
  file?: { buffer: Buffer; fileName: string };
}): Promise<{ text: string; title: string; fileName: string }> {
  if (input.sourceType === "text") {
    const text = capText(input.prompt);
    return { text, title: text.split(/[\n.!?]/, 1)[0].slice(0, 100) || "Mindmap mới", fileName: "" };
  }
  if (input.sourceType === "link") {
    const result = await readPublicPage(input.prompt.trim());
    return { ...result, title: result.title || new URL(input.prompt.trim()).hostname, fileName: "" };
  }
  if (!input.file) throw new AssistantError("Chọn tài liệu trước khi tạo mindmap.", 400);
  if (!input.file.buffer.length) throw new AssistantError("Tệp tài liệu đang trống.", 400);
  if (input.file.buffer.length > MAX_FILE_BYTES) throw new AssistantError("Tệp tài liệu không được vượt quá 20 MB.", 413);
  const fileName = input.file.fileName.replace(/[\\/\u0000-\u001f]/g, "_").slice(-180) || "tai-lieu";
  const extension = fileName.split(".").pop()?.toLowerCase();
  const extractedText = extension === "pptx"
    ? extractPowerPointText(input.file.buffer)
    : (await extractSpeechDocument({ buffer: input.file.buffer, fileName })).text;
  return { text: capText(`${extractedText}${input.prompt.trim() ? `\n\nYêu cầu bổ sung: ${input.prompt.trim()}` : ""}`), title: fileName.replace(/\.[^.]+$/, "").slice(0, 100), fileName };
}
