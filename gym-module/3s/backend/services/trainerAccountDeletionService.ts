import mongoose from 'mongoose';
import User from '../models/User.js';
import Center from '../models/Center.js';
import GymInvitation from '../models/GymInvitation.js';
import { centerDataModels } from '../tenancy/centerDataModels.js';
import { supportsTransactions } from './transactionService.js';
import { deletePersonalAccountData } from './personalAccountDeletionService.js';
import type { AuthenticatedUser } from '../types/express.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { collectDeletionAssets, enqueueDeletionAssets } from './deletionMediaService.js';

export async function deleteTrainerAccount(actor: AuthenticatedUser) {
  if (!await supportsTransactions()) throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Máy chủ chưa hỗ trợ giao dịch xóa an toàn. Chưa có dữ liệu nào bị xóa.' });
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({ _id: actor.id, role: 'PT' }).session(session);
      if (!user?.centerId) throw new AppError({ status: 403, code: ERROR_CODES.AUTHORIZATION, message: 'Tài khoản đã thay đổi. Vui lòng đăng nhập lại.' });
      const center = await Center.findById(user.centerId).session(session);
      if (center?.workspaceType === 'PERSONAL' && String(center.ownerPtId) === String(user._id)) {
        const otherUsers = await User.countDocuments({ centerId: user.centerId, _id: { $ne: user._id } }).session(session);
        if (otherUsers > 0) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Không thể đóng không gian cá nhân khi còn tài khoản khác.' });
        for (const model of centerDataModels.filter(item => ['AiNutritionGenerationJob', 'AiWorkoutGenerationJob', 'AiUsage'].includes(item.modelName))) {
          const field = model.modelName === 'AiUsage' ? 'userId' : 'ownerPtId';
          if (await model.collection.findOne({ centerId: user.centerId, [field]: user._id, status: model.modelName === 'AiUsage' ? 'RESERVED' : 'PROCESSING' }, { session })) {
            throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tác vụ AI đang xử lý. Vui lòng thử xóa lại khi tác vụ hoàn tất.' });
          }
        }
        const assets = collectDeletionAssets(user.toObject());
        for (const model of centerDataModels) {
          for await (const document of model.collection.find({ centerId: user.centerId }, { session })) {
            collectDeletionAssets(document, assets);
          }
          await model.collection.deleteMany({ centerId: user.centerId }, { session });
        }
        await Center.deleteOne({ _id: center._id }, { session });
        await GymInvitation.deleteMany({ userId: user._id }, { session });
        await enqueueDeletionAssets(assets, session);
        return;
      }
      const owner = center?.ownerAdminId && await User.findOne({ _id: center.ownerAdminId, centerId: user.centerId, role: 'ADMIN', status: 'ACTIVE' }).session(session);
      if (!owner) throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Không tìm thấy chủ trung tâm đang hoạt động để tiếp nhận hồ sơ học viên.' });
      for (const model of centerDataModels.filter(item => ['AiNutritionGenerationJob', 'AiWorkoutGenerationJob', 'AiUsage'].includes(item.modelName))) {
        const field = model.modelName === 'AiUsage' ? 'userId' : 'ownerPtId';
        if (await model.collection.findOne({ centerId: user.centerId, [field]: user._id, status: model.modelName === 'AiUsage' ? 'RESERVED' : 'PROCESSING' }, { session })) {
          throw new AppError({ status: 409, code: ERROR_CODES.UNAVAILABLE, message: 'Tác vụ AI đang xử lý. Vui lòng thử xóa lại khi tác vụ hoàn tất.' });
        }
      }
      await deletePersonalAccountData(user, owner._id, session);
    });
  } finally { await session.endSession(); }
}
