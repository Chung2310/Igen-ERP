import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerAttendanceLogModel } from "../models/worker-attendance-log.model";
import type {
  IWorkerAttendanceMark,
  WorkerAttendanceStatus,
} from "../interfaces/worker-attendance.interface";
import { calculateHaversineDistanceMeters } from "../utils/geo.util";
import { logger } from "../../../config/logger";
import { Types } from "mongoose";

/** Bán kính mặc định quanh công trường khi dự án chưa đặt riêng, mét. */
export const DEFAULT_PROJECT_RADIUS_METERS = 300;

/**
 * Khoảng cách tối thiểu giữa hai lần bấm. Lần bấm thứ hai trong ngày được hiểu
 * là giờ về, nên nếu không chặn thì hai lần bấm liên tiếp do lỗi thao tác sẽ
 * đóng luôn ngày công của lao động.
 */
export const MIN_CHECKOUT_GAP_MINUTES = 5;

/** Dung sai đi muộn/về sớm so với giờ dự án, phút. */
export const GRACE_MINUTES = 5;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ngày làm việc YYYY-MM-DD theo giờ Việt Nam. */
export function vietnamWorkDate(value: Date = new Date()): string {
  return new Date(value.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Số phút kể từ 00:00 giờ Việt Nam của một mốc thời gian. */
export function vietnamMinutesOfDay(value: Date): number {
  const shifted = new Date(value.getTime() + VN_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function parseHhMm(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

export class WorkerAttendanceError extends Error {
  constructor(public readonly reasonCode: string, message: string) {
    super(message);
    this.name = "WorkerAttendanceError";
  }
}

export interface ProjectGeoLocation {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
}

/**
 * Kiểm tra vị trí bấm so với tâm dự án.
 */
export function assertWithinProjectRadius(
  geo: ProjectGeoLocation | undefined | null,
  latitude?: number | null,
  longitude?: number | null
): number | undefined {
  if (geo?.latitude == null || geo?.longitude == null) return undefined;

  if (latitude == null || longitude == null) {
    throw new WorkerAttendanceError(
      "missing_location",
      "Dự án yêu cầu vị trí GPS. Vui lòng bật định vị rồi thử lại."
    );
  }

  const distance = calculateHaversineDistanceMeters(latitude, longitude, geo.latitude, geo.longitude);
  const radius = geo.radiusMeters ?? DEFAULT_PROJECT_RADIUS_METERS;

  if (distance > radius) {
    throw new WorkerAttendanceError(
      "outside_radius",
      `Bạn đang ở ngoài phạm vi công trường: cách ${Math.round(distance)}m (cho phép ${radius}m).`
    );
  }

  return distance;
}

/**
 * Trạng thái ngày công dựa trên giờ bắt đầu/kết thúc của chính dự án.
 */
export function resolveAttendanceStatus(
  checkInAt: Date,
  checkOutAt: Date | null | undefined,
  projectStartTime: string,
  projectEndTime: string,
  graceMinutes: number = GRACE_MINUTES
): WorkerAttendanceStatus {
  const startLimit = parseHhMm(projectStartTime, 8 * 60);
  const endLimit = parseHhMm(projectEndTime, 17 * 60);

  const late = vietnamMinutesOfDay(checkInAt) > startLimit + graceMinutes;
  if (!checkOutAt) return "missing-checkout";

  const leftEarly = vietnamMinutesOfDay(checkOutAt) < endLimit - graceMinutes;
  if (late && leftEarly) return "late-left-early";
  if (late) return "late";
  if (leftEarly) return "left-early";
  return "present";
}

/** Số phút làm việc giữa hai mốc, không bao giờ âm. */
export function calculateWorkedMinutes(checkInAt: Date, checkOutAt: Date): number {
  return Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
}

export interface MarkAttendanceInput {
  workerId: string;
  projectId: string;
  companyCode: string | string[];
  branchId?: string;
  /** Explicitly enabled only for authenticated managers who can record attendance on another worker's behalf. */
  allowManual?: boolean;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  ipAddress?: string;
  recordedBy?: string;
  at?: Date;
}

export type MarkKind = "check-in" | "check-out";

export interface MarkAttendanceResult {
  kind: MarkKind;
  date: string;
  status: WorkerAttendanceStatus;
  workedMinutes?: number;
  distanceMeters?: number;
}

function buildCompanyQuery(companyCode: string | string[]): Record<string, unknown> {
  if (companyCode === "ALL") return {};
  return { companyCode: Array.isArray(companyCode) ? { $in: companyCode } : companyCode };
}

function buildProjectScopeQuery(companyCode: string | string[], branchId?: string): Record<string, unknown> {
  return {
    ...buildCompanyQuery(companyCode),
    ...(branchId ? { branchId: new Types.ObjectId(branchId) } : {}),
    deletedAt: null,
  };
}

export class WorkerAttendanceService {
  /**
   * Ghi một lần bấm. Lần đầu trong ngày là giờ vào, lần sau là giờ về.
   */
  static async mark(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
    const now = input.at ?? new Date();
    const date = vietnamWorkDate(now);

    const project = await WorkerProjectModel.findOne({
      _id: new Types.ObjectId(input.projectId),
      ...buildProjectScopeQuery(input.companyCode, input.branchId),
    });
    if (!project) {
      throw new WorkerAttendanceError("project_not_found", "Không tìm thấy dự án.");
    }
    const workerObjectId = new Types.ObjectId(input.workerId);
    if (!project.workerIds.some((id) => id.toString() === workerObjectId.toString())) {
      throw new WorkerAttendanceError("not_in_project", "Lao động không thuộc dự án này.");
    }

    let distanceMeters: number | undefined;
    // Bỏ qua kiểm định vị trí bắt buộc nếu chấm công thủ công (bởi admin/manager - có recordedBy)
    if (!input.allowManual) {
      distanceMeters = assertWithinProjectRadius(project.geoLocation, input.latitude, input.longitude);
    } else if (
      project.geoLocation?.latitude != null &&
      project.geoLocation?.longitude != null &&
      input.latitude != null &&
      input.longitude != null
    ) {
      distanceMeters = calculateHaversineDistanceMeters(
        input.latitude,
        input.longitude,
        project.geoLocation.latitude,
        project.geoLocation.longitude
      );
    }

    const mark: IWorkerAttendanceMark = {
      time: now,
      latitude: input.latitude,
      longitude: input.longitude,
      distanceMeters,
      deviceInfo: input.deviceInfo || "",
      ipAddress: input.ipAddress || "",
      recordedBy: input.recordedBy || "",
    };

    const attendanceKey = {
      workerId: workerObjectId,
      projectId: project._id,
      date,
    };
    let existing = await WorkerAttendanceLogModel.findOne(attendanceKey);

    if (!existing) {
      try {
        const created = await WorkerAttendanceLogModel.create({
          workerId: workerObjectId,
          projectId: project._id,
          companyCode: String(project.companyCode),
          branchId: project.branchId,
          date,
          checkIn: mark,
          status: resolveAttendanceStatus(now, null, project.startTime, project.endTime),
        });
        logger.info(`[WorkerAttendance] check-in: worker=${input.workerId} project=${input.projectId} date=${date}`);
        return { kind: "check-in", date, status: created.status, distanceMeters };
      } catch (error: any) {
        // Two taps can both observe an empty day. The unique index chooses one
        // winner; reload that record and apply the normal minimum-gap rule.
        if (error?.code !== 11000) throw error;
        existing = await WorkerAttendanceLogModel.findOne(attendanceKey);
        if (!existing) throw error;
      }
    }

    if (!existing.checkIn) {
      const updated = await WorkerAttendanceLogModel.findOneAndUpdate(
        { _id: existing._id, checkIn: null, checkOut: null },
        { $set: { checkIn: mark, status: resolveAttendanceStatus(now, null, project.startTime, project.endTime) } },
        { new: true }
      );
      if (!updated) throw new WorkerAttendanceError("already_completed", "Bản ghi chấm công vừa được cập nhật. Vui lòng tải lại.");
      return { kind: "check-in", date, status: updated.status, distanceMeters };
    }

    if (existing.checkOut) {
      throw new WorkerAttendanceError(
        "already_completed",
        "Hôm nay đã chấm đủ giờ vào và giờ về cho dự án này."
      );
    }

    const gapMinutes = (now.getTime() - new Date(existing.checkIn.time).getTime()) / 60000;
    if (gapMinutes < MIN_CHECKOUT_GAP_MINUTES) {
      throw new WorkerAttendanceError(
        "too_soon",
        `Vừa chấm giờ vào xong. Sau ${MIN_CHECKOUT_GAP_MINUTES} phút mới chấm được giờ về.`
      );
    }

    const workedMinutes = calculateWorkedMinutes(new Date(existing.checkIn.time), now);
    const status = resolveAttendanceStatus(new Date(existing.checkIn.time), now, project.startTime, project.endTime);
    const updated = await WorkerAttendanceLogModel.findOneAndUpdate(
      { _id: existing._id, checkOut: null, "checkIn.time": existing.checkIn.time },
      { $set: { checkOut: mark, workedMinutes, status } },
      { new: true }
    );
    if (!updated) {
      throw new WorkerAttendanceError(
        "already_completed",
        "Bản ghi chấm công vừa được cập nhật. Vui lòng tải lại."
      );
    }

    logger.info(`[WorkerAttendance] check-out: worker=${input.workerId} project=${input.projectId} date=${date}`);
    return {
      kind: "check-out",
      date,
      status: updated.status,
      workedMinutes: updated.workedMinutes,
      distanceMeters,
    };
  }

  /** Bảng chấm công của một dự án trong một ngày. */
  static async listByProjectDate(companyCode: string | string[], projectId: string, date: string, branchId?: string) {
    const project = await WorkerProjectModel.findOne({
      _id: new Types.ObjectId(projectId),
      ...buildProjectScopeQuery(companyCode, branchId),
    }).select("_id companyCode").lean();
    if (!project) throw new WorkerAttendanceError("project_not_found", "Không tìm thấy dự án.");

    return WorkerAttendanceLogModel.find({
      companyCode: project.companyCode,
      projectId: project._id,
      date,
    })
      .sort({ "checkIn.time": 1 })
      .lean();
  }

  /** Lịch sử chấm công của một dự án trong khoảng ngày, để tổng hợp công. */
  static async listByProjectRange(companyCode: string | string[], projectId: string, from: string, to: string, branchId?: string) {
    if (from > to) {
      throw new WorkerAttendanceError("invalid_range", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    }
    const project = await WorkerProjectModel.findOne({
      _id: new Types.ObjectId(projectId),
      ...buildProjectScopeQuery(companyCode, branchId),
    }).select("_id companyCode").lean();
    if (!project) throw new WorkerAttendanceError("project_not_found", "Không tìm thấy dự án.");

    return WorkerAttendanceLogModel.find({
      companyCode: project.companyCode,
      projectId: project._id,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: -1 })
      .lean();
  }

  /**
   * Quản lý sửa tay một bản ghi (bù giờ về bị quên, chỉnh sai giờ).
   */
  static async adjust(
    companyCode: string | string[],
    logId: string,
    projectId: string,
    changes: { checkInAt?: string | null; checkOutAt?: string | null; note?: string },
    actorId: string,
    branchId?: string
  ) {
    const project = await WorkerProjectModel.findOne({
      _id: new Types.ObjectId(projectId),
      ...buildProjectScopeQuery(companyCode, branchId),
    });
    if (!project) throw new WorkerAttendanceError("project_not_found", "Không tìm thấy dự án.");

    const log = await WorkerAttendanceLogModel.findOne({
      _id: new Types.ObjectId(logId),
      projectId: project._id,
      companyCode: String(project.companyCode),
    });
    if (!log) throw new WorkerAttendanceError("log_not_found", "Không tìm thấy bản ghi chấm công.");

    const parseChangedTime = (value: string | null | undefined, current?: Date | null) => {
      if (value === undefined) return current ? new Date(current) : null;
      if (value === null) return null;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new WorkerAttendanceError("invalid_time", "Mốc giờ chấm công không hợp lệ.");
      }
      return parsed;
    };

    const nextCheckIn = parseChangedTime(changes.checkInAt, log.checkIn?.time);
    const nextCheckOut = parseChangedTime(changes.checkOutAt, log.checkOut?.time);
    if (nextCheckIn && vietnamWorkDate(nextCheckIn) !== log.date) {
      throw new WorkerAttendanceError("invalid_work_date", "Giờ vào phải thuộc đúng ngày chấm công theo giờ Việt Nam.");
    }
    if (nextCheckOut && !nextCheckIn) {
      throw new WorkerAttendanceError("invalid_range", "Cần có giờ vào trước khi ghi nhận giờ về.");
    }
    if (nextCheckIn && nextCheckOut && nextCheckOut < nextCheckIn) {
      throw new WorkerAttendanceError("invalid_range", "Giờ về phải sau giờ vào.");
    }

    if (changes.checkInAt !== undefined) {
      log.checkIn = changes.checkInAt
        ? { ...(log.checkIn ?? {}), time: new Date(changes.checkInAt), recordedBy: actorId }
        : null;
    }
    if (changes.checkOutAt !== undefined) {
      log.checkOut = changes.checkOutAt
        ? { ...(log.checkOut ?? {}), time: new Date(changes.checkOutAt), recordedBy: actorId }
        : null;
    }
    if (changes.note !== undefined) log.note = changes.note;

    log.workedMinutes =
      log.checkIn?.time && log.checkOut?.time
        ? calculateWorkedMinutes(new Date(log.checkIn.time), new Date(log.checkOut.time))
        : undefined;
    log.status = log.checkIn?.time
      ? resolveAttendanceStatus(
          new Date(log.checkIn.time),
          log.checkOut?.time ? new Date(log.checkOut.time) : null,
          project.startTime,
          project.endTime
        )
      : "missing-checkout";

    await log.save();
    return log.toObject();
  }
}
