import CustomerProfile from '../models/CustomerProfile.js';
import InBodyRecord from '../models/InBodyRecord.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { extractInBody } from './ocrProvider.js';
import type { AuthenticatedUser } from '../types/express.js';
import { recordAudit } from './auditService.js';

function normalizeVietnameseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingCustomer(
  ocrName: string,
  customers: Array<{ _id: unknown; fullName: string }>
): { _id: unknown; fullName: string } | null {
  const cleanOcr = normalizeVietnameseName(ocrName)
    .replace(/^(id|name|ten|kh|mr|ms|mrs)\s+/i, '')
    .trim();
  if (!cleanOcr || cleanOcr.length < 2) return null;

  // 1. Exact match sau khi chuẩn hóa
  const exact = customers.find((c) => normalizeVietnameseName(c.fullName) === cleanOcr);
  if (exact) return exact;

  // 2. Match chứa nhau hoặc theo tokens
  const ocrTokens = cleanOcr.split(' ').filter(Boolean);

  const scored = customers.map((c) => {
    const custNorm = normalizeVietnameseName(c.fullName);
    const custTokens = custNorm.split(' ').filter(Boolean);

    if (cleanOcr.includes(custNorm) || custNorm.includes(cleanOcr)) {
      return { customer: c, score: 90 };
    }

    const commonTokens = custTokens.filter((token) => ocrTokens.includes(token));
    if (commonTokens.length === custTokens.length && custTokens.length >= 2) {
      return { customer: c, score: 85 };
    }
    if (commonTokens.length >= 2) {
      return { customer: c, score: 50 + commonTokens.length * 10 };
    }
    return { customer: c, score: 0 };
  });

  const best = scored.filter((item) => item.score >= 70).sort((a, b) => b.score - a.score)[0];
  return best ? best.customer : null;
}

async function createOcrDraft(
  user: AuthenticatedUser,
  customerId: unknown,
  measurementDate: unknown,
  fileOrFiles: Express.Multer.File | Express.Multer.File[],
  requestKey: string
) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
  const primaryFile = files[0];
  if (!primaryFile) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng cung cấp file ảnh hoặc PDF phiếu InBody.' });
  }

  const extracted = await extractInBody(
    { userId: user.id, taskType: 'OCR_INBODY', requestKey: `${requestKey}:ocr-inbody` },
    files
  );

  let targetCustomer: { _id: unknown; fullName: string } | null = null;
  const warnings = [...extracted.warnings];

  const parsedCustomerId =
    typeof customerId === 'string'
      ? customerId.trim()
      : customerId
        ? String(customerId).trim()
        : '';

  if (parsedCustomerId) {
    const customer = await CustomerProfile.findOne({
      _id: parsedCustomerId,
      ...(user.role === 'PT' ? { assignedPtId: user.id } : {}),
    });
    if (!customer) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
    }
    targetCustomer = customer;
  } else {
    // Tự động tìm kiếm khách hàng khớp theo tên trích xuất từ phiếu InBody
    const customers = await CustomerProfile.find({
      ...(user.role === 'PT' ? { assignedPtId: user.id } : {}),
      status: { $ne: 'INACTIVE' },
    }).select('_id fullName').lean();

    if (extracted.customerName && customers.length > 0) {
      const matched = findMatchingCustomer(extracted.customerName, customers);
      if (matched) {
        targetCustomer = matched;
      }
    }
  }

  let resolvedDate: string | Date = new Date();
  if (measurementDate instanceof Date && !Number.isNaN(measurementDate.getTime())) {
    resolvedDate = measurementDate;
  } else if (typeof measurementDate === 'string' && measurementDate.trim()) {
    resolvedDate = measurementDate.trim();
  } else if (extracted.measurementDate) {
    resolvedDate = extracted.measurementDate;
  }

  return InBodyRecord.create({
    customerId: targetCustomer ? targetCustomer._id : null,
    detectedCustomerName: extracted.customerName || null,
    ptId: user.id,
    measurementDate: resolvedDate,
    ...extracted,
    source: 'AI_SCAN',
    status: 'DRAFT',
    publishedAt: null,
    ocrStatus: 'REVIEW_REQUIRED',
    ocrWarnings: warnings,
    sourceImage: {
      fileName: files.length > 1
        ? `${files.length} tệp (${files.map((f) => f.originalname).join(', ')})`
        : primaryFile.originalname,
      mimeType: primaryFile.mimetype,
      data: primaryFile.buffer,
    },
  });
}

async function confirmOcrDraft(user: AuthenticatedUser, id: string, corrections: Record<string, unknown>) {
  const record = await InBodyRecord.findById(id);
  if (!record) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy kết quả InBody.' });
  }

  // Cho phép chọn hoặc đổi học viên lúc xác nhận
  const targetCustomerId = (corrections.customerId as string) || record.customerId;
  if (!targetCustomerId) {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      message: 'Vui lòng chọn học viên áp dụng cho kết quả InBody này.',
    });
  }

  const customer = await CustomerProfile.findOne({
    _id: targetCustomerId,
    ...(user.role === 'PT' ? { assignedPtId: user.id } : {}),
  });
  if (!customer) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy khách hàng.' });
  }

  if (record.source !== 'AI_SCAN' || record.ocrStatus !== 'REVIEW_REQUIRED') {
    throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Kết quả OCR không ở trạng thái chờ xác nhận.' });
  }

  record.customerId = customer._id;

  const allowed = [
    'measurementDate', 'weight', 'height', 'bmi', 'bodyFatPercentage', 'bodyFatMass',
    'muscleMass', 'bmr', 'visceralFatLevel', 'inbodyScore', 'bodyWater',
    'boneMineral', 'waistHipRatio', 'segmentalMuscle', 'segmentalFat',
    'consultationNotes', 'strengths', 'priorities', 'recommendation',
  ];
  for (const field of allowed) {
    if (Object.prototype.hasOwnProperty.call(corrections, field)) {
      record.set(field, corrections[field]);
    }
  }

  record.ocrStatus = 'CONFIRMED';
  const saved = await record.save();
  await recordAudit({ actor: user, action: 'INBODY_OCR_CONFIRMED', resourceType: 'inbody', resourceId: id, customerId: customer._id.toString() });
  return saved;
}

export { createOcrDraft, confirmOcrDraft, normalizeVietnameseName, findMatchingCustomer };

