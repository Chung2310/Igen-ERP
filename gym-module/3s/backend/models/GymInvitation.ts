import mongoose, { Schema } from 'mongoose';

// Cross-center invitation. Every service operation must explicitly scope by
// receiving userId or the inviting centerId; never expose an unfiltered list.
const schema = new Schema({
  centerId: { type: Schema.Types.ObjectId, ref: 'Center', required: true },
  sourceCenterId: { type: Schema.Types.ObjectId, ref: 'Center', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'], default: 'PENDING', required: true },
  expiresAt: { type: Date, required: true },
  respondedAt: { type: Date },
}, { timestamps: true });
schema.index({ centerId: 1, userId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' }, name: 'unique_pending_gym_invitation' });
schema.index({ userId: 1, status: 1, createdAt: -1 });
export default mongoose.model('GymInvitation', schema);
