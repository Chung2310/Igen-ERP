import { ERROR_CODES } from './errorCodes.js';
interface AppErrorOptions {
  message: string;
  status?: number;
  code?: string;
  errors?: Array<{ field?: string; message: string }>;
  details?: unknown;
  cause?: unknown;
  isOperational?: boolean;
}

class AppError extends Error {
  status: number;
  code: string;
  errors?: Array<{ field?: string; message: string }>;
  details?: unknown;
  isOperational: boolean;

  constructor({ message, status = 500, code = ERROR_CODES.INTERNAL, errors, details, cause, isOperational = true }: AppErrorOptions) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.details = details;
    this.isOperational = isOperational;
  }
}

export { AppError };