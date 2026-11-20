import mongoose from 'mongoose';

export type CenterStatus = 'ACTIVE' | 'SUSPENDED';
export type CenterWorkspaceType = 'GYM' | 'PERSONAL';

export interface ICenter {
  name: string;
  slug: string;
  status: CenterStatus;
  workspaceType: CenterWorkspaceType;
  membershipVersion?: number;
  mergedIntoCenterId?: mongoose.Types.ObjectId;
  ownerAdminId?: mongoose.Types.ObjectId | null;
  ownerPtId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const centerSchema = new mongoose.Schema<ICenter>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE', required: true, index: true },
  workspaceType: { type: String, enum: ['GYM', 'PERSONAL'], default: 'GYM', required: true, index: true },
  membershipVersion: { type: Number, default: 0 },
  mergedIntoCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center' },
  ownerAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ownerPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: undefined },
}, { timestamps: true });

centerSchema.index(
  { ownerPtId: 1 },
  { name: 'unique_personal_center_owner_pt', unique: true, partialFilterExpression: { workspaceType: 'PERSONAL', ownerPtId: { $type: 'objectId' } } },
);

export default mongoose.model<ICenter>('Center', centerSchema);
