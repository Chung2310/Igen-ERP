import { RetailDebtReminderDeliveryModel } from "../models/retail-debt-reminder-delivery.model";
import { classifyReminderFailure } from "./retail-debt-reminder.service";
import { companyEmailService } from "../../../service/company-email.service";

export interface CompanyReminderMailer { send(input: { companyCode: string; to: string; subject: string; text: string }): Promise<{ messageId: string }> }
export function createCompanyReminderMailer(send = companyEmailService.send.bind(companyEmailService)): CompanyReminderMailer {
  return { send: (input) => send(input.companyCode, { to: input.to, subject: input.subject, text: input.text }) };
}

export function nextReminderAttemptAt(attempt: number, now: Date) { return new Date(now.getTime() + Math.min(24 * 60, 5 * 2 ** Math.max(0, attempt - 1)) * 60_000); }
export function reminderRetryDecision(failureType: "temporary" | "permanent", attempt: number, maxAttempts: number) { return { retry: failureType === "temporary" && attempt < maxAttempts }; }

export async function processRetailReminderDeliveries(now = new Date(), mailer: CompanyReminderMailer = createCompanyReminderMailer()) {
  let sent = 0, failed = 0;
  for (;;) {
    const delivery: any = await RetailDebtReminderDeliveryModel.findOneAndUpdate(
      { channel: "email", $or: [{ status: "queued" }, { status: "failed", failureType: "temporary", nextAttemptAt: { $lte: now } }], $expr: { $lt: ["$attempt", "$maxAttempts"] } },
      { $set: { status: "sending" }, $inc: { attempt: 1 } }, { returnDocument: 'after' },
    ).lean();
    if (!delivery) break;
    try {
      const result = await mailer.send({ companyCode: delivery.companyCode, to: delivery.payload.to, subject: delivery.payload.subject, text: delivery.payload.text });
      await RetailDebtReminderDeliveryModel.updateOne({ _id: delivery._id, status: "sending" }, { $set: { status: "sent", sentAt: now, messageId: result.messageId }, $unset: { error: 1, failureType: 1, nextAttemptAt: 1 } }); sent++;
    } catch (error: any) {
      const failureType = classifyReminderFailure(error), decision = reminderRetryDecision(failureType, delivery.attempt, delivery.maxAttempts);
      await RetailDebtReminderDeliveryModel.updateOne({ _id: delivery._id, status: "sending" }, { $set: { status: "failed", failureType, error: String(error?.message || error), nextAttemptAt: decision.retry ? nextReminderAttemptAt(delivery.attempt, now) : undefined } }); failed++;
    }
  }
  return { sent, failed };
}

export function startRetailReminderRetryScheduler(intervalMs = 60 * 60 * 1000) {
  const run = () => void processRetailReminderDeliveries().catch((error) => console.error("[retail-reminder-retry]", error));
  run(); const timer = setInterval(run, intervalMs); timer.unref?.(); return timer;
}
