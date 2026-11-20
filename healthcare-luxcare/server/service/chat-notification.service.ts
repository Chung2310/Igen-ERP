import { ChatRoomModel } from "../model/chat-room.model";
import { ChatMessageModel } from "../model/chat-message.model";
import { MobilePushDevice, MobilePushJob } from "../model/mobile-push.model";

export function chatAlertAllowed(room: any, message: any, uid: string, companyCode: string): boolean {
  if (!room || !message || room.companyCode !== companyCode || message.isDeleted) return false;
  if (String(message.roomId) !== String(room._id) || String(message.senderId) === uid) return false;
  if (message.readBy?.some((id: unknown) => String(id) === uid)) return false;
  const member = room.members?.find((item: any) => String(item.userId?._id || item.userId) === uid);
  if (!member || member.notificationsMuted) return false;
  const created = new Date(message.createdAt).getTime();
  return Number.isFinite(created) &&
    (!member.joinedAt || created >= new Date(member.joinedAt).getTime()) &&
    (!member.notificationsChangedAt || created >= new Date(member.notificationsChangedAt).getTime());
}

export async function canNotifyChatMessage(messageId: string, uid: string, companyCode: string) {
  const message = await ChatMessageModel.findById(messageId).lean();
  if (!message) return false;
  const room = await ChatRoomModel.findById(message.roomId).lean();
  return chatAlertAllowed(room, message, uid, companyCode);
}

export async function enqueueChatNotifications() {
  // Explicit false excludes historical messages: no alert flood on upgrade.
  const messages = await ChatMessageModel.find({ mobilePushQueued: false }).sort({ createdAt: 1 }).limit(20).lean();
  for (const message of messages) {
    const room = await ChatRoomModel.findById(message.roomId).lean();
    if (room) {
      for (const member of room.members) {
        const uid = String(member.userId);
        if (!chatAlertAllowed(room, message, uid, room.companyCode)) continue;
        const devices = await MobilePushDevice.find({
          uid, companyCode: room.companyCode, registeredAt: { $lte: message.createdAt },
        }).lean();
        const isActivity = message.content?.startsWith("LUXCAREROOMACTIVITY:");
        const cleanContent = isActivity
          ? message.content.replace(/^LUXCAREROOMACTIVITY:\s*/, "")
          : message.content;
        const pushBody = isActivity
          ? cleanContent.slice(0, 500)
          : (room.isGroup ? `${message.senderName}: ` : "") +
            (cleanContent || "Đã gửi tệp đính kèm").slice(0, 500);

        for (const device of devices) {
          await MobilePushJob.updateOne(
            { notificationId: `chat:${message._id}`, token: device.token, sessionId: device.sessionId },
            { $setOnInsert: {
              uid, companyCode: room.companyCode,
              payload: {
                title: (room.isGroup ? room.name : message.senderName) || "Tin nhắn mới",
                body: pushBody,
                data: { kind: "chat", messageId: String(message._id), roomId: String(room._id),
                  recipientUid: uid, companyCode: room.companyCode },
              },
              expiresAt: new Date(new Date(message.createdAt).getTime() + 3600000),
            } },
            { upsert: true },
          );
        }
      }
    }
    await ChatMessageModel.updateOne({ _id: message._id }, { $set: { mobilePushQueued: true } });
  }
}
