import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Center from '../models/Center.js';
import { deletePersonalAccountData } from './personalAccountDeletionService.js';
import { centerDataModels } from '../tenancy/centerDataModels.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';
import { supportsTransactions } from './transactionService.js';
import { collectDeletionAssets, enqueueDeletionAssets } from './deletionMediaService.js';

export interface OwnerDeletionInput {
  mode: 'TRANSFER' | 'CLOSE' | 'PERSONAL';
  currentPassword: string;
  confirmation: string;
  successorId?: string;
}

function fail(status: number, message: string): never {
  throw new AppError({ status, code: status === 403 ? ERROR_CODES.AUTHORIZATION : ERROR_CODES.VALIDATION, message });
}

export async function ownerDeletionOptions(actor: AuthenticatedUser) {
  const user = await User.findOne({ _id: actor.id, role: 'ADMIN' }).lean();
  if (!user?.centerId) fail(403, 'Chức năng này dành cho tài khoản quản trị trung tâm.');
  const center = await Center.findById(user.centerId).lean();
  if (!center) fail(404, 'Không tìm thấy trung tâm.');
  const isOwner = String(center.ownerAdminId) === String(user._id);
  const protectedCenter = Boolean(await User.exists({ centerId: center._id, role: 'SUPER_ADMIN' }));
  return { centerName: center.name, username: user.username, isOwner, canClose: isOwner && !protectedCenter };
}

export async function deleteOwnerAccount(actor: AuthenticatedUser, input: OwnerDeletionInput) {
  // This destructive multi-collection operation must never fall back to partial writes.
  if (!await supportsTransactions()) {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Máy chủ chưa hỗ trợ giao dịch xóa an toàn. Quản trị hệ thống cần cấu hình MongoDB replica set. Chưa có dữ liệu nào bị xóa.' });
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: actor.id, role: 'ADMIN' }).session(session);
      if (!user?.centerId) fail(403, 'Không tìm thấy tài khoản quản trị trung tâm.');
      if (!await bcrypt.compare(input.currentPassword, user.password)) fail(403, 'Mật khẩu hiện tại không đúng.');
      const centerId = user.centerId;
      const center = await Center.findById(centerId).session(session);
      if (!center) fail(404, 'Không tìm thấy trung tâm.');
      const isOwner = String(center.ownerAdminId) === String(user._id);
      if (input.confirmation !== (input.mode === 'CLOSE' ? center.name : user.username)) fail(400, 'Nội dung xác nhận chưa khớp.');
      if (input.mode === 'PERSONAL' ? isOwner : !isOwner) fail(403, 'Quyền chủ trung tâm đã thay đổi. Vui lòng tải lại màn hình.');

      for (const model of centerDataModels.filter(item => ['AiNutritionGenerationJob', 'AiWorkoutGenerationJob', 'AiUsage'].includes(item.modelName))) {
        const ownerField = model.modelName === 'AiUsage' ? 'userId' : 'ownerPtId';
        const active = await model.collection.findOne({ centerId,
          ...(input.mode === 'CLOSE' ? {} : { [ownerField]: user._id }),
          status: model.modelName === 'AiUsage' ? 'RESERVED' : 'PROCESSING',
        }, { session });
        if (active) fail(409, 'Tác vụ AI đang xử lý dữ liệu. Vui lòng đợi tác vụ hoàn tất rồi thử xóa lại.');
      }

      if (input.mode === 'CLOSE') {
        if (await User.exists({ centerId, role: 'SUPER_ADMIN' }).session(session)) {
          fail(403, 'Trung tâm đang chứa tài khoản quản trị hệ thống. Bạn vẫn có thể chuyển quyền và xóa tài khoản cá nhân.');
        }
        // Explicit ObjectId filter: never delete shared catalog entries (centerId null).
        const assets = new Set<string>();
        for (const model of centerDataModels) {
          for await (const document of model.collection.find({ centerId }, { session })) collectDeletionAssets(document, assets);
          await model.collection.deleteMany({ centerId }, { session });
        }
        await enqueueDeletionAssets(assets, session);
        await Center.deleteOne({ _id: centerId, ownerAdminId: user._id }, { session });
        return;
      }

      let successorId: mongoose.Types.ObjectId | undefined;
      if (input.mode === 'TRANSFER') {
        const successor = await User.findOne({ _id: input.successorId, centerId, role: 'PT', status: 'ACTIVE' }).session(session);
        if (!successor || String(successor._id) === String(user._id)) fail(400, 'Chọn một PT đang hoạt động thuộc trung tâm của bạn.');
        successorId = successor._id;
        successor.role = 'ADMIN';
        await successor.save({ session });
        center.ownerAdminId = successor._id;
        await center.save({ session });
      } else {
        successorId = center.ownerAdminId ?? undefined;
        if (!successorId || !await User.exists({ _id: successorId, centerId, role: 'ADMIN', status: 'ACTIVE' }).session(session)) {
          fail(409, 'Trung tâm cần có chủ trung tâm đang hoạt động để tiếp nhận dữ liệu chung.');
        }
      }

      await deletePersonalAccountData(user, successorId, session);
    });
  } finally {
    await session.endSession();
  }
}
