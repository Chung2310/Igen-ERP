import { Types, type ClientSession } from 'mongoose';
import Center from '../models/Center.js';
import User from '../models/User.js';
import FeatureFlag from '../models/FeatureFlag.js';
import DeviceSession from '../models/DeviceSession.js';
import CenterRequestLease from '../models/CenterRequestLease.js';
import GymInvitation from '../models/GymInvitation.js';
import AiUsageQuotaCounter from '../models/AiUsageQuotaCounter.js';
import { centerDataModels } from '../tenancy/centerDataModels.js';
import { runWithSystemCenterAccess, runWithCenter } from '../tenancy/centerContext.js';
import { createNotificationOnce } from './notificationService.js';
import { withRequiredTransaction } from './transactionService.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import type { AuthenticatedUser } from '../types/express.js';

function fail(message: string, status = 409): never {
  throw new AppError({ status, code: status === 403 ? ERROR_CODES.AUTHORIZATION : status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.VALIDATION, message });
}
async function assertGymAdmin(actor: AuthenticatedUser, session?: ClientSession) {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role) || !actor.centerId) fail('Chỉ admin gym được quản lý lời mời.', 403);
  const gym = await Center.findOne({ _id: actor.centerId, workspaceType: 'GYM', status: 'ACTIVE' }).session(session ?? null);
  if (!gym) fail('Gym không còn hoạt động.', 403);
  const admin = await User.findOne({ _id: actor.id, centerId: gym._id, role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' }).session(session ?? null);
  if (!admin) fail('Quyền quản trị đã thay đổi.', 403);
  return gym;
}

export async function createGymInvitation(actor: AuthenticatedUser, username: string) {
  return runWithSystemCenterAccess(() => withRequiredTransaction(async session => {
    const gym = await assertGymAdmin(actor, session);
    const pt = await User.findOne({ username: username.trim(), role: 'PT', status: 'ACTIVE' }).session(session);
    if (!pt?.centerId) fail('Không tìm thấy PT độc lập đang hoạt động.', 404);
    const personal = await Center.findOne({ _id: pt.centerId, workspaceType: 'PERSONAL', ownerPtId: pt._id, status: 'ACTIVE' }).session(session);
    if (!personal) fail('Chỉ có thể mời PT đang sử dụng không gian cá nhân.');
    await Center.updateOne({ _id: personal._id, status: 'ACTIVE' }, { $inc: { membershipVersion: 1 } }, { session });
    await GymInvitation.updateMany({ centerId: gym._id, userId: pt._id, status: 'PENDING', expiresAt: { $lte: new Date() } }, { $set: { status: 'EXPIRED' } }, { session });
    const pending = await GymInvitation.findOne({ centerId: gym._id, userId: pt._id, status: 'PENDING' }).session(session);
    if (pending) return { id: pending.id, status: pending.status };
    const [invitation] = await GymInvitation.create([{
      centerId: gym._id, sourceCenterId: personal._id, userId: pt._id, invitedBy: new Types.ObjectId(actor.id),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    }], { session });
    await runWithCenter(personal.id, () => createNotificationOnce({
      userId: pt._id, type: 'GYM_INVITATION', title: 'Lời mời tham gia gym',
      message: `${gym.name} mời bạn tham gia. Bạn có thể xác nhận hoặc từ chối trong mục Lời mời gym.`,
      resourceType: 'gym-invitation', resourceId: invitation.id,
    }, session));
    return { id: invitation.id, status: invitation.status };
  }));
}

export async function listGymInvitations(actor: AuthenticatedUser) {
  return runWithSystemCenterAccess(async () => {
    const admin = ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
    if (admin) await assertGymAdmin(actor);
    else if (actor.role !== 'PT') fail('Không có quyền xem lời mời.', 403);
    const filter = admin ? { centerId: actor.centerId } : { userId: actor.id };
    const invitations = await GymInvitation.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    const centers = await Center.find({ _id: { $in: invitations.map(item => item.centerId) } }).select('name').lean();
    const users = await User.find({ _id: { $in: invitations.map(item => item.userId) } }).select('username fullName').lean();
    const center = actor.centerId ? await Center.findById(actor.centerId).select('name workspaceType').lean() : null;
    return {
      workspaceType: center?.workspaceType, centerName: center?.name,
      items: invitations.map(item => ({
        id: String(item._id), centerName: centers.find(value => String(value._id) === String(item.centerId))?.name || 'Gym không còn tồn tại',
        username: users.find(value => String(value._id) === String(item.userId))?.username || '',
        fullName: users.find(value => String(value._id) === String(item.userId))?.fullName || '',
        status: item.status === 'PENDING' && item.expiresAt <= new Date() ? 'EXPIRED' : item.status,
        expiresAt: item.expiresAt, createdAt: item.createdAt,
      })),
    };
  });
}

async function moveQuotaCounters(sourceId: Types.ObjectId, targetId: Types.ObjectId, session: ClientSession) {
  for await (const counter of AiUsageQuotaCounter.collection.find({ centerId: sourceId }, { session })) {
    if (counter.reservedRequests > 0) fail('Còn lượt AI đang xử lý. Vui lòng thử lại sau.');
    const filter = { centerId: targetId, scope: counter.scope, periodType: counter.periodType, periodKey: counter.periodKey,
      ...(counter.scope === 'USER' ? { userId: counter.userId } : {}),
    };
    await AiUsageQuotaCounter.collection.updateOne(filter, {
      $inc: { usedRequests: counter.usedRequests, providerCostMicrousd: counter.providerCostMicrousd },
      $set: { updatedAt: new Date() }, $setOnInsert: { reservedRequests: 0, createdAt: new Date() },
    }, { upsert: true, session });
    await AiUsageQuotaCounter.collection.deleteOne({ _id: counter._id }, { session });
  }
}

export async function respondToGymInvitation(actor: AuthenticatedUser, id: string, action: 'ACCEPT' | 'DECLINE' | 'CANCEL', consent = false) {
  try {
    return await runWithSystemCenterAccess(() => withRequiredTransaction(async session => {
      const access = action === 'CANCEL' ? { centerId: actor.centerId } : { userId: actor.id };
      if (action === 'CANCEL') await assertGymAdmin(actor, session);
      else if (actor.role !== 'PT') fail('Chỉ PT nhận lời mời được phản hồi.', 403);
      const invitation = await GymInvitation.findOne({ _id: id, ...access }).session(session);
      if (!invitation) fail('Không tìm thấy lời mời.', 404);
      if (action === 'ACCEPT' && invitation.status === 'ACCEPTED') return { accepted: true };
      if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date()) fail('Lời mời đã hết hạn hoặc đã được xử lý.');
      if (action !== 'ACCEPT') {
        invitation.status = action === 'DECLINE' ? 'DECLINED' : 'CANCELLED';
        invitation.respondedAt = new Date();
        await invitation.save({ session });
        return { accepted: false };
      }
      if (!consent) fail('Cần xác nhận chuyển toàn bộ dữ liệu cá nhân sang gym.', 400);
      const pt = await User.findOne({ _id: actor.id, role: 'PT', status: 'ACTIVE', centerId: invitation.sourceCenterId }).session(session);
      if (!pt) fail('Tài khoản đã đổi trung tâm. Hãy tải lại lời mời.');
      const personal = await Center.findOne({ _id: invitation.sourceCenterId, workspaceType: 'PERSONAL', ownerPtId: pt._id, status: 'ACTIVE' }).session(session);
      const gym = await Center.findOne({ _id: invitation.centerId, workspaceType: 'GYM', status: 'ACTIVE' }).session(session);
      if (!personal || !gym) fail('Không gian cá nhân hoặc gym không còn hoạt động.');
      if (await CenterRequestLease.exists({ centerId: personal._id, expiresAt: { $gt: new Date() }, ...(actor.requestLeaseId ? { _id: { $ne: actor.requestLeaseId } } : {}) }).session(session)) {
        fail('Tài khoản đang có thao tác khác. Hãy đợi thao tác hoàn tất rồi xác nhận vào gym.');
      }
      if (!await User.exists({ centerId: gym._id, role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' }).session(session)) fail('Gym chưa có admin đang hoạt động.');
      if (await User.exists({ centerId: personal._id, _id: { $ne: pt._id } }).session(session)) fail('Không gian cá nhân có tài khoản khác; cần quản trị hỗ trợ chuyển dữ liệu.');
      for (const model of centerDataModels.filter(item => ['AiUsage', 'AiNutritionGenerationJob', 'AiWorkoutGenerationJob'].includes(item.modelName))) {
        if (await model.collection.findOne({ centerId: personal._id, status: model.modelName === 'AiUsage' ? 'RESERVED' : { $in: ['PENDING', 'PROCESSING'] } }, { session })) {
          fail('Vui lòng đợi các tác vụ AI hoàn tất trước khi vào gym.');
        }
      }
      // Lock both center documents against concurrent acceptance/closure. Keep
      // the old center as an inactive audit record instead of reusing its ID.
      await Center.updateOne({ _id: gym._id, status: 'ACTIVE' }, { $inc: { membershipVersion: 1 } }, { session });
      await Center.updateOne({ _id: personal._id, status: 'ACTIVE' }, { $set: { status: 'SUSPENDED', mergedIntoCenterId: gym._id } }, { session });
      await moveQuotaCounters(personal._id, gym._id, session);
      for (const model of centerDataModels) {
        if (['User', 'FeatureFlag', 'DeviceSession', 'CenterRequestLease', 'AiUsageQuotaCounter', 'GymInvitation'].includes(model.modelName)) continue;
        await model.collection.updateMany({ centerId: personal._id }, { $set: { centerId: gym._id } }, { session });
      }
      await User.collection.updateOne({ _id: pt._id, centerId: personal._id }, { $set: { centerId: gym._id }, $inc: { authVersion: 1 } }, { session });
      await DeviceSession.deleteMany({ userId: pt._id }, { session });
      await FeatureFlag.deleteMany({ centerId: personal._id }, { session });
      invitation.status = 'ACCEPTED'; invitation.respondedAt = new Date();
      await invitation.save({ session });
      await GymInvitation.updateMany({ userId: pt._id, status: 'PENDING' }, { $set: { status: 'CANCELLED', respondedAt: new Date() } }, { session });
      return { accepted: true };
    }));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      fail('Dữ liệu bị trùng với gym (ví dụ email khách hàng hoặc tên nhóm cơ). Chưa chuyển dữ liệu nào; hãy xử lý mục trùng rồi xác nhận lại.');
    }
    throw error;
  }
}
