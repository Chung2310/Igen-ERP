import mongoose, { type ClientSession } from 'mongoose';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

// Operations that change several balances or tenant ownership must never fall
// back to independent writes on a standalone MongoDB server.
export async function withRequiredTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!await supportsTransactions()) {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Thao tác cần MongoDB replica set để bảo vệ dữ liệu. Vui lòng liên hệ quản trị hệ thống.' });
  }
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally { await session.endSession(); }
}

export async function supportsTransactions(): Promise<boolean> {
  try {
    const hello = await mongoose.connection.db?.command({ hello: 1 });
    return Boolean(hello?.setName || hello?.msg === 'isdbgrid');
  } catch {
    return false;
  }
}

export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const supported = await supportsTransactions();
  const session = await mongoose.startSession();

  if (!supported) {
    try {
      return await work(session);
    } finally {
      await session.endSession();
    }
  }

  try {
    let result!: T;
    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } catch (error: any) {
      if (
        error?.name === 'MongoServerError' &&
        (error?.code === 20 ||
          error?.code === 263 ||
          String(error?.message).includes('Transaction numbers are only allowed') ||
          String(error?.message).includes('replica set'))
      ) {
        return await work(session);
      }
      throw error;
    }
  } finally {
    try {
      await session.endSession();
    } catch {
      // Ignored
    }
  }
}
