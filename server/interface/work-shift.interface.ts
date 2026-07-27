import { Document } from "mongoose";

export interface IShiftBreak {
  name: string;
  startTime: string;
  endTime: string;
  paid: boolean;
}

export interface IWorkShift extends Document {
  companyCode: string;
  code: string;
  name: string;
  color: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  checkInFrom?: string;
  checkInUntil?: string;
  checkOutFrom?: string;
  checkOutUntil?: string;
  breakPeriods: IShiftBreak[];
  allowedLateMinutes: number;
  allowedEarlyLeaveMinutes: number;
  standardMinutes: number;
  workingDays: number[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShiftAssignment extends Document {
  companyCode: string;
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  daysOfWeek: number[];
  createdAt: Date;
  updatedAt: Date;
}
