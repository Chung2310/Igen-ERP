import { PayrollPublicationScheduleModel } from "../model/payroll-publication-schedule.model";
import { DEFAULT_PAYROLL_PUBLICATION_SCHEDULE } from "../../src/shared/payrollPublicationSchedule";
import { validatePublicationSchedule } from "./payroll-publication-schedule-state";
import { reconciliationError } from "./payroll-reconciliation-state";

type Scope = { companyCode: string; branchId: string };
const publicSchedule = (record: any) => record ? ({ enabled: record.enabled, day: record.day, hour: record.hour, minute: record.minute, periodOffset: record.periodOffset, version: record.version }) : { ...DEFAULT_PAYROLL_PUBLICATION_SCHEDULE };
export async function getPayrollPublicationSchedule(scope: Scope) {
  return publicSchedule(await PayrollPublicationScheduleModel.findOne(scope).lean());
}
export async function savePayrollPublicationSchedule(scope: Scope, actorId: string, input: unknown) {
  const { version, ...values } = validatePublicationSchedule(input);
  try {
    const saved = await PayrollPublicationScheduleModel.findOneAndUpdate({ ...scope, version: version || { $exists: false } }, {
      $set: { ...values, updatedBy: actorId, effectiveFrom: new Date() }, $inc: { version: 1 }, $setOnInsert: scope,
    }, { returnDocument: "after", upsert: version === 0, runValidators: true });
    if (!saved) throw reconciliationError("Lịch vừa được thay đổi. Hãy tải lại trước khi lưu.");
    return publicSchedule(saved);
  } catch (error: any) {
    if (error.code === 11000) throw reconciliationError("Lịch vừa được thay đổi. Hãy tải lại trước khi lưu.");
    throw error;
  }
}
