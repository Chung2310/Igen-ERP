import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { PDFParse } from "pdf-parse";
import type { LegalStatus } from "../models/legal-reference.model";

export const MAX_LEGAL_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type LegalStructureChunk = {
  text: string;
  chapter: string;
  article: string;
  clause: string;
  point: string;
};

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function htmlToText(value: string): string {
  const text = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, code: string) => {
      const value = code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : " ";
    })
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
  return normalizeText(text);
}

function extractDocxText(buffer: Buffer): string {
  if (!buffer.subarray(0, 2).equals(Buffer.from("PK"))) throw new Error("Tệp Word không đúng định dạng DOCX.");
  const entry = new AdmZip(buffer).getEntry("word/document.xml");
  if (!entry || entry.header.size > MAX_LEGAL_FILE_BYTES) throw new Error("Không tìm thấy nội dung DOCX.");
  const xml = new DOMParser().parseFromString(entry.getData().toString("utf8"), "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("Không đọc được nội dung DOCX.");
  const paragraphs = xml.getElementsByTagNameNS(WORD_NS, "p");
  const lines: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const nodes = paragraphs.item(index)?.getElementsByTagNameNS(WORD_NS, "t");
    const parts: string[] = [];
    for (let textIndex = 0; nodes && textIndex < nodes.length; textIndex += 1) parts.push(nodes.item(textIndex)?.textContent || "");
    lines.push(parts.join(""));
  }
  return normalizeText(lines.join("\n"));
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("Tệp PDF không đúng định dạng.");
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return normalizeText(String(parsed?.text || ""));
  } finally {
    await parser.destroy();
  }
}

export async function extractLegalText(buffer: Buffer, filename: string): Promise<string> {
  if (!buffer.length) throw new Error("Tệp đang trống.");
  if (buffer.length > MAX_LEGAL_FILE_BYTES) throw new Error("Tệp không được vượt quá 20 MB.");
  const extension = filename.split(".").pop()?.toLowerCase();
  const text = extension === "pdf"
    ? await extractPdfText(buffer)
    : extension === "docx"
      ? extractDocxText(buffer)
      : extension === "html" || extension === "htm"
        ? htmlToText(buffer.toString("utf8"))
      : extension === "txt" && !buffer.includes(0)
        ? normalizeText(buffer.toString("utf8"))
        : "";
  if (text.length > MAX_EXTRACTED_CHARACTERS) throw new Error("Nội dung trích xuất vượt quá giới hạn xử lý an toàn.");
  if (!text) throw new Error("Không trích xuất được văn bản. Tệp scan hoặc bố cục khó đọc cần được rà soát/OCR.");
  return text;
}

function isChapterHeading(line: string): boolean {
  return /^(?:CHƯƠNG|PHẦN)\s+[IVXLCDM0-9]+\b/i.test(line);
}

/** Tách theo cấu trúc pháp lý khi cấu trúc nhận diện được; trả [] nếu nguồn không đủ tin cậy. */
export function splitLegalStructure(input: string): LegalStructureChunk[] {
  const lines = normalizeText(input).split("\n").map((line) => line.trim()).filter(Boolean);
  const chunks: LegalStructureChunk[] = [];
  let chapter = "";
  let article = "";
  let clause = "";
  let point = "";
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) chunks.push({ text, chapter, article, clause, point });
    buffer = [];
  };

  for (const line of lines) {
    const articleMatch = line.match(/^Điều\s+(\d+[A-Za-z]?)\s*[.:–-]?\s*(.*)$/i);
    const clauseMatch = line.match(/^(\d{1,3})\.\s+(.+)$/);
    const pointMatch = line.match(/^([a-zđ])\)\s*(.+)$/i);
    if (isChapterHeading(line)) {
      flush(); chapter = line; article = ""; clause = ""; point = ""; buffer.push(line);
    } else if (articleMatch) {
      flush(); article = `Điều ${articleMatch[1]}`; clause = ""; point = "";
      if (articleMatch[2]) buffer.push(articleMatch[2]);
    } else if (article && clauseMatch) {
      flush(); clause = clauseMatch[1]; point = ""; buffer.push(clauseMatch[2]);
    } else if (article && pointMatch) {
      flush(); point = pointMatch[1].toLocaleLowerCase("vi-VN"); buffer.push(pointMatch[2]);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks.filter((chunk) => Boolean(chunk.article));
}

export function scoreLegalMatch(query: string, text: string, title = ""): number {
  const normalize = (value: string) => value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const normalizedQuery = normalize(query).trim();
  if (!normalizedQuery) return 0;
  const haystack = normalize(`${title} ${text}`);
  const tokens = normalizedQuery.split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  const tokenMatches = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
  return tokenMatches / Math.max(1, tokens.length) + (haystack.includes(normalizedQuery) ? 0.5 : 0);
}

const LEGAL_EMBEDDING_DIMENSIONS = 96;

/** Stable lightweight token embedding, compatible with the ERP knowledge index. */
export function embedLegalText(text: string): number[] {
  const vector = new Array<number>(LEGAL_EMBEDDING_DIMENSIONS).fill(0);
  const normalized = text.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  for (const token of normalized.split(/[^a-z0-9]+/).filter((part) => part.length > 1)) {
    const digest = createHash("sha256").update(token).digest();
    const hash = digest.readUInt32BE(0);
    vector[hash % LEGAL_EMBEDDING_DIMENSIONS] += hash % 2 === 0 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export function legalEmbeddingSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

export function isLegalChunkApplicable(input: { status: LegalStatus; effectiveFrom?: Date | string | null; effectiveTo?: Date | string | null }, asOf: Date): boolean {
  if (input.status === "unknown") return false;
  const from = input.effectiveFrom ? new Date(input.effectiveFrom) : undefined;
  const to = input.effectiveTo ? new Date(input.effectiveTo) : undefined;
  return (!from || from <= asOf) && (!to || to >= asOf);
}
