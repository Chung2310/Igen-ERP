import KnowledgeDocument, { type IKnowledgeDocument } from '../models/KnowledgeDocument.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { Types } from 'mongoose';
import { extractTextFromFile, chunkText } from './knowledgeParser.js';
import { embedText } from './embeddingProvider.js';

/**
 * Phân đoạn và tạo vector embedding cho tài liệu tri thức (RAG indexer)
 */
export async function indexDocumentChunks(
  documentId: Types.ObjectId | string,
  version: number,
  topic: string,
  content: string
): Promise<number> {
  const docIdObj = typeof documentId === 'string' ? new Types.ObjectId(documentId) : documentId;
  // Xóa sạch các chunk cũ của tài liệu nếu có
  await KnowledgeChunk.deleteMany({ documentId: docIdObj });

  const rawChunks = chunkText(content);
  if (rawChunks.length === 0) return 0;

  const chunkDocs = rawChunks.map((chunk, index) => ({
    documentId: docIdObj,
    documentVersion: version,
    topic,
    position: index,
    content: chunk,
    embedding: embedText(chunk),
  }));

  await KnowledgeChunk.insertMany(chunkDocs);
  return chunkDocs.length;
}

/**
 * Xử lý tải lên nhiều file (PDF, Word, TXT, MD), bóc tách văn bản và tự động tạo RAG chunks
 */
export async function uploadAndProcessFiles(
  files: Express.Multer.File[],
  topic: string,
  user: AuthenticatedUser
) {
  if (!files || files.length === 0) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: 'Vui lòng chọn ít nhất một file tài liệu.',
    });
  }

  const processedDocs: Array<{ id: string; title: string; chunksCount: number; originalFilename: string }> = [];
  let totalChunksCreated = 0;

  for (const file of files) {
    try {
      const extracted = await extractTextFromFile(file);

      if (!extracted.content || extracted.content.length < 10) {
        continue; // Bỏ qua file rỗng
      }

      // Tạo tài liệu mới ở trạng thái PUBLISHED để sẵn sàng cho RAG
      const doc = new KnowledgeDocument({
        title: extracted.title,
        topic: topic || 'QUY TRÌNH & HỆ THỐNG',
        content: extracted.content,
        status: 'PUBLISHED',
        version: 1,
        approvedById: user?.id ? new Types.ObjectId(user.id) : undefined,
        publishedAt: new Date(),
        effectiveAt: new Date(),
      });

      await doc.save();

      // Chunking & Embedding
      const chunksCount = await indexDocumentChunks(
        doc._id as Types.ObjectId,
        doc.version,
        doc.topic,
        doc.content
      );

      totalChunksCreated += chunksCount;
      processedDocs.push({
        id: String(doc._id),
        title: doc.title,
        chunksCount,
        originalFilename: extracted.originalFilename,
      });
    } catch (err: any) {
      console.error(`[knowledgeService] Lỗi khi xử lý file ${file.originalname}:`, err);
    }
  }

  if (processedDocs.length === 0) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: 'Không thể trích xuất văn bản hợp lệ từ các file đã chọn.',
    });
  }

  return {
    processedCount: processedDocs.length,
    totalChunks: totalChunksCreated,
    documents: processedDocs,
    message: `Đã nạp thành công ${processedDocs.length} tài liệu và tạo ${totalChunksCreated} đoạn tri thức vector (RAG)!`,
  };
}

export async function createDocument(payload: Partial<IKnowledgeDocument>, user: AuthenticatedUser) {
  const doc = await KnowledgeDocument.create({
    ...payload,
    status: 'PUBLISHED',
    version: 1,
    approvedById: user?.id ? new Types.ObjectId(user.id) : undefined,
    publishedAt: new Date(),
    effectiveAt: new Date(),
  });

  if (doc.content) {
    await indexDocumentChunks(doc._id as Types.ObjectId, doc.version, doc.topic, doc.content);
  }

  return doc;
}

export async function listDocuments(query: { page?: number; limit?: number; status?: string; topic?: string; search?: string }) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const filter: Record<string, any> = {};

  if (query.status === 'DRAFT' || query.status === 'PUBLISHED') {
    filter.status = query.status;
  }
  if (query.topic && typeof query.topic === 'string') {
    filter.topic = query.topic;
  }
  if (query.search && query.search.trim()) {
    filter.$or = [
      { title: { $regex: query.search.trim(), $options: 'i' } },
      { topic: { $regex: query.search.trim(), $options: 'i' } },
      { content: { $regex: query.search.trim(), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    KnowledgeDocument.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    KnowledgeDocument.countDocuments(filter),
  ]);

  // Đếm số lượng chunks cho từng tài liệu để hiển thị huy hiệu RAG
  const docIds = items.map((item) => item._id);
  const chunkCounts = await KnowledgeChunk.aggregate([
    { $match: { documentId: { $in: docIds } } },
    { $group: { _id: '$documentId', count: { $sum: 1 } } },
  ]);
  const chunkCountMap = new Map(chunkCounts.map((c) => [String(c._id), c.count]));

  const enhancedItems = items.map((doc) => ({
    ...doc,
    chunkCount: chunkCountMap.get(String(doc._id)) || 0,
  }));

  return {
    items: enhancedItems,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateDocument(id: string, payload: Partial<IKnowledgeDocument>) {
  const doc = await KnowledgeDocument.findById(id);
  if (!doc) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài liệu.' });

  if (payload.title !== undefined) doc.title = payload.title;
  if (payload.topic !== undefined) doc.topic = payload.topic;
  if (payload.content !== undefined) doc.content = payload.content;
  doc.version += 1;

  await doc.save();

  // Cập nhật lại vector chunks khi nội dung hoặc topic thay đổi
  await indexDocumentChunks(doc._id as Types.ObjectId, doc.version, doc.topic, doc.content);

  return doc;
}

export async function deleteDocument(id: string) {
  const doc = await KnowledgeDocument.findById(id);
  if (!doc) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài liệu.' });

  // Xóa toàn bộ chunk vector liên quan
  await KnowledgeChunk.deleteMany({ documentId: doc._id });
  await doc.deleteOne();
  return true;
}

export async function publishDocument(id: string, user: AuthenticatedUser) {
  const doc = await KnowledgeDocument.findById(id);
  if (!doc) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài liệu.' });

  doc.status = 'PUBLISHED';
  doc.publishedAt = new Date();
  doc.effectiveAt = new Date();
  if (user?.id) doc.approvedById = new Types.ObjectId(user.id);

  await doc.save();
  await indexDocumentChunks(doc._id as Types.ObjectId, doc.version, doc.topic, doc.content);

  return doc;
}

export async function unpublishDocument(id: string) {
  const doc = await KnowledgeDocument.findById(id);
  if (!doc) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy tài liệu.' });

  doc.status = 'DRAFT';
  doc.publishedAt = undefined;

  await doc.save();
  // Xóa chunk khi gỡ xuất bản để AI không truy vấn tài liệu nháp
  await KnowledgeChunk.deleteMany({ documentId: doc._id });

  return doc;
}

export async function seedStandardKnowledgeLibrary(user: AuthenticatedUser) {
  const STANDARD_DOCS = [
    {
      title: 'Quy chuẩn dinh dưỡng thể hình 3S: Tỷ lệ Macro theo mục tiêu',
      topic: 'DINH DƯỠNG',
      content: 'Tỷ lệ Protein cho người tập gym duy trì từ 1.8g - 2.2g/kg thể trọng. Nguồn đạm ưu tiên: ức gà, bò nạc, cá hồi, trứng, whey protein isolate. Carbs sạch: gạo lứt, khoai lang, yến mạch. Chất béo tốt: dầu ô liu, quả bơ, các loại hạt hạnh nhân, óc chó.',
    },
    {
      title: 'Nguyên tắc bổ sung nước & điện giải trong buổi tập gym',
      topic: 'TẬP LUYỆN',
      content: 'Uống 500ml nước trước tập 2 tiếng. Trong buổi tập, cứ mỗi 15-20 phút uống ngụm nhỏ 150-200ml. Tránh để khát mới uống vì khi cơ thể mất 2% lượng nước, sức mạnh và hiệu suất cơ bắp giảm tới 15%.',
    },
    {
      title: 'Chiến lược phục hồi cơ bắp sau buổi tập cường độ cao',
      topic: 'PHỤC HỒI',
      content: 'Cửa sổ đồng hóa sau tập: nạp 25-30g protein hấp thu nhanh và 40-50g carbs trong vòng 45-60 phút. Giấc ngủ ban đêm từ 7-8 tiếng là thời điểm hoocmon tăng trưởng GH tiết ra nhiều nhất để tái tạo sợi cơ bị tổn thương.',
    },
    {
      title: 'Quy trình khởi động khớp và kích hoạt cơ chuẩn 3S-Gym',
      topic: 'TẬP LUYỆN',
      content: 'Bắt đầu với 5 phút đi bộ dốc nhẹ để nâng thân nhiệt. Xoay tròn khớp linh hoạt (cổ tay, cổ chân, khớp gối, khớp háng, khớp vai). Thực hiện 2 bài kích hoạt cơ trọng tâm (Glute Bridge, Cat-Cow, Band Pull-Apart) trước khi nâng tạ nặng.',
    },
  ];

  const seeded = [];
  for (const item of STANDARD_DOCS) {
    let doc = await KnowledgeDocument.findOne({ title: item.title });
    if (!doc) {
      doc = new KnowledgeDocument({
        title: item.title,
        topic: item.topic,
        content: item.content,
        version: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        effectiveAt: new Date(),
        approvedById: user?.id ? new Types.ObjectId(user.id) : undefined,
      });
      await doc.save();
    }
    // Index chunks
    await indexDocumentChunks(doc._id as Types.ObjectId, doc.version, doc.topic, doc.content);
    seeded.push(doc);
  }

  return {
    count: seeded.length,
    message: `Đã nạp ${seeded.length} tài liệu tri thức và hoàn tất RAG vector!`,
  };
}
