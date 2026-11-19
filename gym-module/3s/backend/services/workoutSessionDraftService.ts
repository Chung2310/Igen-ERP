import { Types } from 'mongoose';
import WorkoutSessionDraft from '../models/WorkoutSessionDraft.js';
import WorkoutSession from '../models/WorkoutSession.js';
import { getCustomer } from './customerService.js';
import type { AuthenticatedUser } from '../types/express.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export interface SessionDraftInput {
  revision: number; idempotencyKey: string;
  form: Record<string, unknown>; plan: Record<string, unknown>;
  pendingPayload?: Record<string, unknown> | null;
}
const conflict = () => new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Bản nháp đã thay đổi trên thiết bị khác. Hãy mở lại bản nháp trước khi lưu.' });
const scope = (user: AuthenticatedUser, customerId: string) => ({ ownerId: new Types.ObjectId(user.id), customerId: new Types.ObjectId(customerId) });

export async function getSessionDraft(user: AuthenticatedUser, customerId: string) {
  await getCustomer(user, customerId);
  const draft = await WorkoutSessionDraft.findOne(scope(user, customerId)).lean();
  if (draft && await WorkoutSession.exists({ ptId: user.id, customerId, idempotencyKey: draft.idempotencyKey })) {
    // A final save succeeded, including when its response was lost. Never offer it as a new workout.
    await WorkoutSessionDraft.deleteOne({ _id: draft._id, revision: draft.revision });
    return null;
  }
  return draft;
}
export async function saveSessionDraft(user: AuthenticatedUser, customerId: string, input: SessionDraftInput) {
  await getCustomer(user, customerId);
  if (input.pendingPayload && (input.pendingPayload.customerId !== customerId || input.pendingPayload.idempotencyKey !== input.idempotencyKey)) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Thông tin buổi tập chờ lưu không khớp bản nháp.' });
  }
  if (await WorkoutSession.exists({ ptId: user.id, idempotencyKey: input.idempotencyKey })) {
    throw new AppError({ status: 409, code: ERROR_CODES.VALIDATION, message: 'Buổi tập này đã được lưu chính thức. Hãy đóng và tải lại lịch sử.' });
  }
  const data = { form: input.form, plan: input.plan, idempotencyKey: input.idempotencyKey, pendingPayload: input.pendingPayload ?? null };
  if (input.revision === 0) {
    try { return await WorkoutSessionDraft.create({ ...scope(user, customerId), ...data, revision: 1 }); }
    catch (error) { if ((error as { code?: number }).code === 11000) throw conflict(); throw error; }
  }
  const saved = await WorkoutSessionDraft.findOneAndUpdate(
    { ...scope(user, customerId), revision: input.revision },
    { $set: data, $inc: { revision: 1 } }, { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!saved) throw conflict();
  return saved;
}
export async function deleteSessionDraft(user: AuthenticatedUser, customerId: string, revision: number) {
  await getCustomer(user, customerId);
  const result = await WorkoutSessionDraft.deleteOne({ ...scope(user, customerId), revision });
  if (!result.deletedCount && await WorkoutSessionDraft.exists(scope(user, customerId))) throw conflict();
}
