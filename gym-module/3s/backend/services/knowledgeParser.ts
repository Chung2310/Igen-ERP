import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export interface ExtractedDocument {
  title: string;
  content: string;
  originalFilename: string;
  fileSizeBytes: number;
}

/**
 * Khắc phục lỗi mã hóa header latin1 thường gặp của Multer khi tải file có dấu tiếng Việt
 */
export function decodeUtf8Filename(filename: string): string {
  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf-8');
    if (!decoded.includes('\uFFFD')) {
      return decoded;
    }
  } catch {
    // fallback
  }
  return filename;
}

/**
 * Làm sạch tên file để tạo tiêu đề tài liệu tự nhiên
 */
export function deriveTitleFromFilename(filename: string): string {
  const cleanName = decodeUtf8Filename(filename);
  const ext = path.extname(cleanName);
  const base = path.basename(cleanName, ext);
  return base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

/**
 * Trích xuất nội dung văn bản từ các định dạng file phổ biến (.txt, .md, .pdf, .docx, .json, .csv)
 */
export async function extractTextFromFile(file: Express.Multer.File): Promise<ExtractedDocument> {
  const decodedOriginalName = decodeUtf8Filename(file.originalname);
  const ext = path.extname(decodedOriginalName).toLowerCase();
  let rawText = '';

  if (ext === '.pdf' || file.mimetype === 'application/pdf') {
    const parser = new PDFParse({ data: file.buffer });
    const textResult = await parser.getText();
    rawText = textResult.text || '';
    await parser.destroy();
  } else if (
    ext === '.docx' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = docxResult.value || '';
  } else {
    // .txt, .md, .markdown, .json, .csv và các định dạng văn bản UTF-8 khác
    rawText = file.buffer.toString('utf-8');
  }

  // Chuẩn hóa văn bản: xóa các ký tự null, khoảng trắng thừa và dòng trống liên tiếp
  const cleanedContent = rawText
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Kiểm tra xem dòng đầu tiên có phải là Markdown Title "# Tiêu đề" không
  let title = deriveTitleFromFilename(decodedOriginalName);
  const firstLineMatch = cleanedContent.match(/^#\s+([^\n]+)/);
  if (firstLineMatch && firstLineMatch[1]?.trim()) {
    title = firstLineMatch[1].trim();
  }

  return {
    title,
    content: cleanedContent,
    originalFilename: decodedOriginalName,
    fileSizeBytes: file.size,
  };
}

/**
 * Phân mảnh văn bản (Chunking) theo ranh giới đoạn tự nhiên
 * Đảm bảo mỗi đoạn chứa đủ ngữ cảnh (~600-900 ký tự) kèm overlap gối đầu
 */
export function chunkText(content: string, chunkSize = 800, overlap = 150): string[] {
  if (!content || !content.trim()) return [];

  const trimmed = content.trim();
  if (trimmed.length <= chunkSize) {
    return [trimmed];
  }

  // Tách văn bản theo các đoạn văn bản (paragraphs) hoặc dòng
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    // Nếu cả đoạn văn quá dài, chia nhỏ theo câu
    if (para.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const sentences = para.split(/(?<=[.?!;])\s+/).filter(Boolean);
      let sentenceChunk = '';

      for (const sent of sentences) {
        if ((sentenceChunk + ' ' + sent).trim().length > chunkSize) {
          if (sentenceChunk) chunks.push(sentenceChunk.trim());
          // Gối đầu một phần câu trước nếu có thể
          const overlapText = sentenceChunk.slice(-overlap).trim();
          sentenceChunk = (overlapText ? overlapText + ' ' : '') + sent;
        } else {
          sentenceChunk = sentenceChunk ? `${sentenceChunk} ${sent}` : sent;
        }
      }

      if (sentenceChunk.trim()) {
        chunks.push(sentenceChunk.trim());
      }
      continue;
    }

    // Nếu gộp thêm đoạn văn vẫn nằm trong giới hạn chunkSize
    if ((currentChunk + '\n\n' + para).trim().length <= chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // Gối đầu từ đoạn trước để duy trì liên tục ngữ cảnh
      const overlapText = currentChunk.slice(-overlap).trim();
      currentChunk = (overlapText ? overlapText + '\n\n' : '') + para;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Lọc bỏ các chunk quá ngắn hoặc vô nghĩa (< 20 ký tự)
  return chunks.filter((c) => c.trim().length >= 20);
}
