import mongoose, { Schema } from 'mongoose';

export interface IMigrationRecord {
  version: string;
  name: string;
  status: 'RUNNING' | 'APPLIED' | 'FAILED' | 'ROLLED_BACK';
  appliedAt?: Date;
  rolledBackAt?: Date;
  ownerId?: string;
  lockedAt?: Date;
  expiresAt?: Date;
  error?: { name: string; message: string };
  metadata: Record<string, unknown>;
}

const schema = new Schema<IMigrationRecord>({
  version: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['RUNNING', 'APPLIED', 'FAILED', 'ROLLED_BACK'], required: true, index: true },
  appliedAt: Date,
  rolledBackAt: Date,
  ownerId: String,
  lockedAt: Date,
  expiresAt: Date,
  error: { type: Schema.Types.Mixed },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

export default mongoose.model<IMigrationRecord>('MigrationRecord', schema);
