import type { ClientSession } from "mongoose";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollRunScopeReservationModel } from "../model/payroll-run-scope-reservation.model";
import { runPayrollAtomicTransaction } from "./payroll-transaction.service";

export type AttendancePeriodScope = {
  companyCode: string;
  branchId: string;
};

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

const writeOptions = (session?: ClientSession) => ({
  returnDocument: "after" as const,
  ...(session ? { session } : {}),
});

function lockedPeriodError() {
  return Object.assign(
    new Error("Kỳ công đã khóa hoặc bảng lương đã bắt đầu duyệt. Hãy mở/reset kỳ trước khi sửa chấm công."),
    { statusCode: 409, code: "ATTENDANCE_PERIOD_LOCKED" },
  );
}

/**
 * Serialize an attendance source mutation with payroll run creation, review,
 * attendance locking, and other payroll input writes for the same branch.
 */
export function runReservedPayrollScopeMutation<T>(
  scope: AttendancePeriodScope,
  operation: (session?: ClientSession) => Promise<T>,
) {
  return runPayrollAtomicTransaction(async (session) => {
    await PayrollRunScopeReservationModel.findOneAndUpdate(
      { scopeKey: JSON.stringify([scope.companyCode, scope.branchId]) },
      { $setOnInsert: scope, $inc: { revision: 1 } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true, ...(session ? { session } : {}) },
    );

    return operation(session);
  });
}

export function runAttendancePeriodMutation<T>(
  scope: AttendancePeriodScope,
  periodKey: string,
  operation: (session?: ClientSession) => Promise<T>,
) {
  return runReservedPayrollScopeMutation(scope, async (session) => {

    const lockedResult = await withSession(
      AttendancePeriodResultModel.findOne({ ...scope, periodKey, status: "locked" }),
      session,
    ).lean();
    if (lockedResult) throw lockedPeriodError();

    const payrollRun = await withSession(
      PayrollRunModel.findOne({ ...scope, periodKey, type: "regular", status: { $ne: "draft" } }),
      session,
    ).lean();
    if (payrollRun) throw lockedPeriodError();

    const draftRun: any = await withSession(
      PayrollRunModel.findOne({ ...scope, periodKey, type: "regular", status: "draft" }),
      session,
    ).lean();
    if (draftRun) {
      const guardedRun = await PayrollRunModel.findOneAndUpdate(
        { _id: draftRun._id, ...scope, periodKey, type: "regular", status: "draft", version: Number(draftRun.version ?? 0) },
        { $set: { needsInputRefresh: true }, $inc: { version: 1 } },
        writeOptions(session),
      ).lean();
      if (!guardedRun) throw lockedPeriodError();
    }

    return operation(session);
  });
}
