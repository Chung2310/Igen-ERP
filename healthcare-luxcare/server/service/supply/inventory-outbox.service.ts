import { logger } from "../../config/logger";
import { randomUUID } from "node:crypto";
import {
  SupplyInventoryOutboxModel as Outbox,
  SupplyStockDocumentModel as Document,
} from "../../model/supply-inventory.model";
import { NotificationModel } from "../../model/notification.model";
import { emitToUser } from "../../socket";

export async function dispatchInventoryEvent(event: any) {
  const doc = await Document.findOne({
    _id: event.documentId,
    companyCode: event.companyCode,
    branchId: event.branchId,
    status: "posted",
  }).lean();
  if (!doc?.postedBy) throw new Error("Posted inventory document unavailable");
  const dedupeKey = `supply-posted:${event.documentId}`;
  await NotificationModel.updateOne(
    { companyCode: event.companyCode, recipientUid: doc.postedBy, dedupeKey },
    {
      $setOnInsert: {
        title: "Đã ghi sổ kho",
        body: `Chứng từ ${doc.number} đã được ghi sổ.`,
        type: "kho",
        read: false,
        action: { tab: "supply" },
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  // Repeated invalidations are safe; financial data is fetched through scoped APIs.
  const notification = await NotificationModel.findOne({ companyCode: event.companyCode, recipientUid: doc.postedBy, dedupeKey }).lean();
  if (notification) emitToUser(doc.postedBy, "new_notification", notification);
  emitToUser(doc.postedBy, "supply:changed", { eventId: String(event._id) });
}

export async function processInventoryOutbox(
  dispatch: (event: any) => Promise<void> = dispatchInventoryEvent,
  now = new Date(),
) {
  await Outbox.updateMany(
    { status: "processing", leaseUntil: { $lte: now }, attempts: { $gte: 10 } },
    { $set: { status: "failed" }, $unset: { leaseToken: 1, leaseUntil: 1 } },
  );
  const leaseToken = randomUUID();
  const event = await Outbox.findOneAndUpdate(
    {
      attempts: { $lt: 10 },
      $or: [
        { status: "pending", availableAt: { $lte: now } },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    { $set: { status: "processing", leaseToken, leaseUntil: new Date(now.getTime() + 30000) }, $inc: { attempts: 1 } },
    { sort: { availableAt: 1, _id: 1 }, returnDocument: "after" },
  ).lean();
  if (!event) return false;
  try {
    await dispatch(event);
    await Outbox.updateOne(
      { _id: event._id, leaseToken },
      { $set: { status: "delivered" }, $unset: { leaseToken: 1, leaseUntil: 1 } },
    );
  } catch {
    await Outbox.updateOne(
      { _id: event._id, leaseToken },
      {
        $set: {
          status: event.attempts >= 10 ? "failed" : "pending",
          availableAt: new Date(now.getTime() + Math.min(60000, 1000 * 2 ** event.attempts)),
        },
        $unset: { leaseToken: 1, leaseUntil: 1 },
      },
    );
  }
  return true;
}
export function startInventoryOutboxWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 20 && (await processInventoryOutbox()); i++) {
        /* bounded drain */
      }
    } catch {
      logger.warn("[Supply] Outbox temporarily unavailable; retrying next cycle.");
    } finally {
      running = false;
    }
  }, 5000);
  timer.unref();
  return () => clearInterval(timer);
}
