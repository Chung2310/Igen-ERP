import { Types } from 'mongoose';
import PackageTemplate from '../models/PackageTemplate.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export interface PackageTemplatePayload {
  name: string;
  totalSessions: number;
  durationDays: number;
  price?: number;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface PackageTemplateQuery {
  page?: number | string;
  limit?: number | string;
  status?: string;
  keyword?: string;
}

export async function listTemplates(query: PackageTemplateQuery) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Number(query.limit || 50));
  const filter: Record<string, unknown> = {};

  if (query.status === 'ACTIVE' || query.status === 'INACTIVE') {
    filter.status = query.status;
  }

  if (query.keyword && typeof query.keyword === 'string' && query.keyword.trim()) {
    const trimmed = query.keyword.trim();
    filter.$or = [
      { name: { $regex: trimmed, $options: 'i' } },
      { description: { $regex: trimmed, $options: 'i' } },
    ];
  }

  const [templates, total] = await Promise.all([
    PackageTemplate.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PackageTemplate.countDocuments(filter),
  ]);

  return {
    templates,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getTemplate(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  const template = await PackageTemplate.findById(id).lean();
  if (!template) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  return template;
}

export async function createTemplate(payload: PackageTemplatePayload, userId?: string) {
  if (!payload.name || !payload.name.trim()) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tên gói tập mẫu không được để trống.' });
  }
  if (!payload.totalSessions || Number(payload.totalSessions) < 1) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tổng số buổi phải lớn hơn hoặc bằng 1.' });
  }
  if (!payload.durationDays || Number(payload.durationDays) < 1) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Thời hạn (ngày) phải lớn hơn hoặc bằng 1.' });
  }

  const template = await PackageTemplate.create({
    name: payload.name.trim(),
    totalSessions: Number(payload.totalSessions),
    durationDays: Number(payload.durationDays),
    price: payload.price !== undefined ? Math.max(0, Number(payload.price)) : 0,
    description: payload.description ? payload.description.trim() : '',
    status: payload.status || 'ACTIVE',
    createdBy: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
  });

  return template;
}

export async function updateTemplate(id: string, payload: Partial<PackageTemplatePayload>) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  const updateData: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    if (!payload.name.trim()) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tên gói tập mẫu không được để trống.' });
    }
    updateData.name = payload.name.trim();
  }
  if (payload.totalSessions !== undefined) {
    if (Number(payload.totalSessions) < 1) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Tổng số buổi phải lớn hơn hoặc bằng 1.' });
    }
    updateData.totalSessions = Number(payload.totalSessions);
  }
  if (payload.durationDays !== undefined) {
    if (Number(payload.durationDays) < 1) {
      throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Thời hạn (ngày) phải lớn hơn hoặc bằng 1.' });
    }
    updateData.durationDays = Number(payload.durationDays);
  }
  if (payload.price !== undefined) {
    updateData.price = Math.max(0, Number(payload.price));
  }
  if (payload.description !== undefined) {
    updateData.description = payload.description.trim();
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }

  const template = await PackageTemplate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
  if (!template) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  return template;
}

export async function deleteTemplate(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  const deleted = await PackageTemplate.findByIdAndDelete(id).lean();
  if (!deleted) {
    throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Gói tập mẫu không tồn tại.' });
  }

  return deleted;
}
