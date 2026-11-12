import AdmZip from "adm-zip";
import { DOMParser } from "@xmldom/xmldom";
import { PDFParse } from "pdf-parse";
import { AssistantError } from "./policy";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 10_000;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function normalizeText(value: string): string {
  return value.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getDocxText(buffer: Buffer): string {
  if (!buffer.subarray(0, 2).equals(Buffer.from("PK"))) {
    throw new AssistantError("Tệp Word không đúng định dạng DOCX hoặc bị hỏng.", 422);
  }
  let documentXml: string;
  try {
    const archive = new AdmZip(buffer);
    const entry = archive.getEntry("word/document.xml");
    if (!entry || entry.header.size > MAX_FILE_BYTES) throw new Error("Missing or oversized document.xml");
    documentXml = entry.getData().toString("utf8");
  } catch {
    throw new AssistantError("Không thể đọc nội dung tệp Word. Hãy kiểm tra tệp DOCX rồi thử lại.", 422);
  }

  let xml: ReturnType<DOMParser["parseFromString"]>;
  try {
    xml = new DOMParser().parseFromString(documentXml, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("Invalid XML");
  } catch {
    throw new AssistantError("Không thể đọc nội dung tệp Word. Hãy kiểm tra tệp DOCX rồi thử lại.", 422);
  }

  const paragraphs = xml.getElementsByTagNameNS(WORD_NS, "p");
  const lines: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    const textNodes = paragraphs.item(index)?.getElementsByTagNameNS(WORD_NS, "t");
    const parts: string[] = [];
    for (let textIndex = 0; textNodes && textIndex < textNodes.length; textIndex += 1) {
      parts.push(textNodes.item(textIndex)?.textContent || "");
    }
    lines.push(parts.join(""));
  }
  return normalizeText(lines.join("\n"));
}

async function getPdfText(buffer: Buffer): Promise<string> {
  if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
    throw new AssistantError("Tệp PDF không đúng định dạng hoặc bị hỏng.", 422);
  }
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeText(String(result?.text || ""));
  } catch {
    throw new AssistantError("Không đọc được văn bản trong PDF. PDF scan cần được OCR trước.", 422);
  } finally {
    await parser.destroy();
  }
}

export async function extractSpeechDocument(input: { buffer: Buffer; fileName: string }): Promise<{ fileName: string; text: string }> {
  if (!input.buffer.length) throw new AssistantError("Tệp tài liệu đang trống.", 400);
  if (input.buffer.length > MAX_FILE_BYTES) throw new AssistantError("Tệp tài liệu không được vượt quá 20 MB.", 413);
  const fileName = input.fileName.replace(/[\\/\u0000-\u001f]/g, "_").slice(-180) || "tai-lieu";
  const extension = fileName.split(".").pop()?.toLocaleLowerCase("en-US");
  let text: string;

  if (extension === "txt") {
    if (input.buffer.includes(0)) throw new AssistantError("Tệp TXT không phải văn bản UTF-8 hợp lệ.", 422);
    text = normalizeText(input.buffer.toString("utf8"));
  } else if (extension === "docx") {
    text = getDocxText(input.buffer);
  } else if (extension === "pdf") {
    text = await getPdfText(input.buffer);
  } else {
    throw new AssistantError("Chỉ hỗ trợ tệp PDF, Word (.docx) và văn bản (.txt).", 415);
  }

  if (!text) throw new AssistantError("Không tìm thấy văn bản trong tệp. PDF scan cần được OCR trước.", 422);
  if (text.length > MAX_TEXT_CHARACTERS) {
    throw new AssistantError("Tài liệu vượt quá 10.000 ký tự. Hãy chia nhỏ tài liệu rồi tải từng phần.", 413);
  }
  return { fileName, text };
}
