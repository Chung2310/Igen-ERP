import type { ClientSession, Types } from 'mongoose';
import Notification from '../models/Notification.js';

interface NotificationInput {
  userId: string | Types.ObjectId;
  type: string;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
}

export async function createNotificationOnce(input: NotificationInput, session?: ClientSession) {
  return Notification.findOneAndUpdate(
    { userId: input.userId, type: input.type, resourceType: input.resourceType, resourceId: input.resourceId },
    { $setOnInsert: { ...input, readAt: null } },
    { upsert: true, returnDocument: 'after', session },
  );
}
