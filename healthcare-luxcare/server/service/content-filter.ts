/** Local filtering never sends chat or attachment data to a third party. */
export class ContentFilterError extends Error {
  readonly statusCode = 422;
  readonly code = "CONTENT_NOT_ALLOWED";
  constructor() { super("Nội dung hoặc tệp đính kèm chứa từ ngữ, liên kết hay loại tệp không được phép. Vui lòng chỉnh sửa trước khi gửi."); }
}
const phrases = ["fuck", "fucking", "fucker", "motherfucker", "cunt", "nigger", "nigga", "kill yourself",
  "dit me", "du me", "con di", "do cho", "tao se giet may", "dm may", "dmm", "dcm", "dkm"];
const adultDomains = ["pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com", "youporn.com"];
function normalize(value: string) {
  return value.replace(/&#(?:x([a-f0-9]+)|(\d+));?/gi, (_, hex, dec) => {
    const n = parseInt(hex || dec, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  }).replace(/<[^>]{0,2000}>/g, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d").replace(/[\u200B-\u200D\uFEFF]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function prohibitedText(value: string) {
  const text = ` ${normalize(value)} `;
  const extras = (process.env.CONTENT_FILTER_EXTRA_TERMS || "").split(",").map(normalize).filter(v => v.length >= 3);
  return [...phrases, ...extras].some(phrase => text.includes(` ${phrase} `));
}
function prohibitedLinks(value: string) {
  // Covers plain, encoded, HTML and pasted adult-domain links without fetching URLs.
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Check the original text too. */ }
  return adultDomains.some(domain => new RegExp(`(?:^|[^a-z0-9-])(?:[a-z0-9-]+\\.)*${domain.replaceAll(".", "\\.")}(?:$|[^a-z0-9.-])`, "i").test(decoded));
}
export function assertAllowedContent(content: string, attachments: Array<{ name?: string; url?: string; type?: string }> = []) {
  if (prohibitedText(content) || prohibitedLinks(content)) throw new ContentFilterError();
  for (const file of attachments) {
    const name = file.name || "";
    if (prohibitedText(name) || prohibitedLinks(file.url || "") || [name, file.url || ""].some(value => /\.(?:exe|com|bat|cmd|ps1|vbs|js|scr|msi|html?|svg)(?:[?#].*)?$/i.test(value)))
      throw new ContentFilterError();
    const url = file.url || "";
    if (url && !/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) throw new ContentFilterError();
  }
}
