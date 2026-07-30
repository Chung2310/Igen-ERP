import type { PayrollAttendanceEmployeeSnapshot, PayrollAttendanceSnapshot } from "./payroll-operations.interface";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends (<Value>() => Value extends Right ? 1 : 2) ? true : false;

type Expect<Condition extends true> = Condition;

type ReadonlyKeys<Value> = {
  [Key in keyof Value]-?: Equal<Pick<Value, Key>, Readonly<Pick<Value, Key>>> extends true ? Key : never;
}[keyof Value];

type SnapshotMetadataFields =
  | "companyCode"
  | "branchId"
  | "runId"
  | "periodKey"
  | "employees"
  | "lockedAt"
  | "lockedBy";

type SnapshotFieldsAreReadonly = Expect<
  Equal<ReadonlyKeys<PayrollAttendanceSnapshot>, SnapshotMetadataFields>
>;

type BranchIdIsRequired = Expect<
  Equal<{} extends Pick<PayrollAttendanceSnapshot, "branchId"> ? true : false, false>
>;

type EmployeesIsReadonlyArray = Expect<
  Equal<PayrollAttendanceSnapshot["employees"], readonly PayrollAttendanceEmployeeSnapshot[]>
>;

type EmployeeFieldsAreReadonly = Expect<
  Equal<ReadonlyKeys<PayrollAttendanceEmployeeSnapshot>, keyof PayrollAttendanceEmployeeSnapshot>
>;

type PaidLeaveIsImmutable = Expect<
  Equal<PayrollAttendanceEmployeeSnapshot["paidLeaveMinutesByRate"], readonly { readonly minutes: number; readonly payRate: number }[]>
>;

type OvertimeIsImmutable = Expect<
  Equal<PayrollAttendanceEmployeeSnapshot["overtime"], readonly { readonly minutes: number; readonly category: "weekday" | "restDay" | "holiday" }[]>
>;

type LockedAtIsIsoTimestamp = Expect<
  Equal<PayrollAttendanceSnapshot["lockedAt"], string>
>;
