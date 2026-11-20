import { centerTenantPlugin } from '../tenancy/centerTenantPlugin.js';
import mongoose from 'mongoose';

export type ClientType = 'WEB' | 'MOBILE';
export type SessionStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface IDeviceSession {
  userId: mongoose.Types.ObjectId;
  clientType: ClientType;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
  refreshToken?: string;
  lastActiveAt: Date;
  status: SessionStatus;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceSessionSchema = new mongoose.Schema<IDeviceSession>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientType: {
      type: String,
      enum: ['WEB', 'MOBILE'],
      default: 'MOBILE',
      index: true,
    },
    deviceId: {
      type: String,
      trim: true,
      default: '',
    },
    deviceName: {
      type: String,
      trim: true,
      default: '',
    },
    platform: {
      type: String,
      trim: true,
      default: '',
    },
    osVersion: {
      type: String,
      trim: true,
      default: '',
    },
    appVersion: {
      type: String,
      trim: true,
      default: '',
    },
    pushToken: {
      type: String,
      trim: true,
      default: '',
    },
    refreshToken: {
      type: String,
      trim: true,
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

deviceSessionSchema.index({ userId: 1, clientType: 1, status: 1 });
deviceSessionSchema.index({ refreshToken: 1, status: 1 });deviceSessionSchema.plugin(centerTenantPlugin);



const DeviceSession = mongoose.model<IDeviceSession>('DeviceSession', deviceSessionSchema);

export default DeviceSession;
