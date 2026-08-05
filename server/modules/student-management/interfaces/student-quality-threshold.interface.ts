import { Document } from "mongoose";

export interface IStudentQualityThreshold extends Document {
  ownerId: string;
  branchId?: string;
  riskAttendance: number;
  riskAssignment: number;
  riskMiniTest: number;
  watchAttendance: number;
  watchAssignment: number;
  watchMiniTest: number;
}
