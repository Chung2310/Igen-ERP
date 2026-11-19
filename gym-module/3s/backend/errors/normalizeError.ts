import { AppError } from './AppError.js';
import { ERROR_CODES } from './errorCodes.js';
const fieldLabels: Record<string, string> = { email: 'Email', phone: 'Số điện thoại', username: 'Tên đăng nhập' };

interface ErrorLike {
  name?: string; message?: string; code?: string | number; status?: number; type?: string; path?: string;
  errors?: Record<string, { path: string }> | Array<{ field?: string; message: string }>;
  keyPattern?: Record<string, unknown>; keyValue?: Record<string, unknown>;
}

function normalizeError(value: unknown) {
  if (value instanceof AppError) return value;
  const error = value as ErrorLike;
  if (error?.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];
    return new AppError({ status: 409, code: ERROR_CODES.DUPLICATE, message: `${fieldLabels[field] || 'Dữ liệu'} đã được sử dụng.`, details: { field }, cause: value });
  }
  if (error?.name === 'ValidationError') {
    const errors = Object.values(error.errors || {}).map((item) => ({ field: item.path, message: `Giá trị ${item.path} không hợp lệ.` }));
    return new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Dữ liệu gửi lên không hợp lệ.', errors, cause: value });
  }
  if (error?.name === 'CastError') return new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Dữ liệu gửi lên không hợp lệ.', errors: [{ field: error.path, message: 'Giá trị không hợp lệ.' }], cause: value });
  if (['TokenExpiredError', 'JsonWebTokenError'].includes(error?.name || '')) return new AppError({ status: 401, code: ERROR_CODES.AUTHENTICATION, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', cause: value });
  if (error?.type === 'entity.parse.failed') return new AppError({ status: 400, code: ERROR_CODES.INVALID_JSON, message: 'Dữ liệu JSON không hợp lệ.', cause: value });
  if (error?.type === 'entity.too.large' || error?.code === 'LIMIT_FILE_SIZE') return new AppError({ status: 413, code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Dữ liệu gửi lên vượt quá giới hạn cho phép.', cause: value });
  if (error?.status && error.status >= 400 && error.status < 500) return new AppError({ status: error.status, code: typeof error.code === 'string' ? error.code : ERROR_CODES.VALIDATION, message: error.message || 'Dữ liệu gửi lên không hợp lệ.', errors: Array.isArray(error.errors) ? error.errors : undefined, cause: value });
  return new AppError({ status: 500, code: ERROR_CODES.INTERNAL, message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.', cause: value, isOperational: false });
}

export { normalizeError };