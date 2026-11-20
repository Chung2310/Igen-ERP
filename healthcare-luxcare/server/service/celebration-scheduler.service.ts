import { logger } from "../config/logger";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import { CelebrationDeliveryModel } from "../model/celebration-delivery.model";
import { companyEmailService } from "./company-email.service";
import { hasReachedCompanySendTime, renderCelebrationTemplate, vietnamDateParts } from "./company-celebration";

async function deliver(
  company: any,
  eventType: "birthday" | "holiday",
  eventDate: string,
  eventKey: string,
  user: any,
  template: any,
  holidayName = "",
) {
  const variables = { employeeName: user.displayName || user.email, companyName: company.name, holidayName };
  const subject = renderCelebrationTemplate(template.subject, variables);
  const html = renderCelebrationTemplate(template.html, variables);
  let row: any;
  try {
    row = await CelebrationDeliveryModel.create({
      companyCode: company.code,
      eventType,
      eventDate,
      eventKey,
      recipientUserId: String(user._id),
      recipientEmail: user.email,
      subject,
      status: "sending",
      attempts: 1,
    });
  } catch (error: any) {
    if (error?.code !== 11000) {
      logger.error("[CelebrationScheduler] Cannot create delivery", error);
      return false;
    }
    row = await CelebrationDeliveryModel.findOneAndUpdate(
      {
        companyCode: company.code,
        eventType,
        eventDate,
        eventKey,
        recipientEmail: user.email,
        status: "failed",
        attempts: { $lt: 3 },
      },
      { $set: { status: "sending", error: "" }, $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    if (!row) return false;
  }
  try {
    const result = await companyEmailService.send(company.code, { to: user.email, subject, html });
    await CelebrationDeliveryModel.updateOne(
      { _id: row._id },
      { status: "sent", sentAt: new Date(), messageId: result.messageId },
    );
  } catch (error: any) {
    await CelebrationDeliveryModel.updateOne(
      { _id: row._id },
      { status: "failed", error: String(error?.message || error).slice(0, 500) },
    );
  }
  return true;
}

export async function runCelebrationScan(now = new Date()) {
  const local = vietnamDateParts(now);
  const companies: any[] = await CompanyModel.find({
    $or: [{ lifecycleStatus: "active" }, { lifecycleStatus: { $exists: false } }],
  }).lean();
  let queued = 0;
  for (const company of companies) {
    const config = company.celebrationConfig;
    if (!config || !hasReachedCompanySendTime(now, config.sendTime || "08:00")) continue;
    const users: any[] = await UserModel.find({
      companyCode: company.code,
      role: { $ne: "superadmin" },
      isActive: { $ne: false },
      disabledAt: { $in: [null, undefined] },
      email: { $type: "string", $ne: "" },
    })
      .select("_id email displayName birthDate")
      .lean();
    if (config.birthdayEnabled) {
      for (const user of users) {
        if (!user.birthDate) continue;
        const month = String(user.birthDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(user.birthDate.getUTCDate()).padStart(2, "0");
        if (
          month === local.month &&
          day === local.day &&
          (await deliver(company, "birthday", local.date, `birthday:${user._id}`, user, config.birthdayTemplate))
        )
          queued++;
      }
    }
    if (config.holidayEnabled) {
      const holiday: any = await CompanyWorkCalendarDayModel.findOne({
        companyCode: company.code,
        date: local.date,
        dayType: { $in: ["holiday", "substitute_holiday"] },
        isApplied: true,
      }).lean();
      if (holiday) {
        const override = config.holidayOverrides?.find(
          (item: any) => item.date === local.date && item.enabled !== false,
        );
        const template = override
          ? {
              subject: override.subject || config.holidayTemplate.subject,
              html: override.html || config.holidayTemplate.html,
            }
          : config.holidayTemplate;
        for (const user of users)
          if (
            await deliver(
              company,
              "holiday",
              local.date,
              holiday.sourceKey || holiday.date,
              user,
              template,
              holiday.name,
            )
          )
            queued++;
      }
    }
  }
  return { queued };
}

export function startCelebrationScheduler() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runCelebrationScan();
    } catch (error) {
      logger.error("[CelebrationScheduler]", error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
