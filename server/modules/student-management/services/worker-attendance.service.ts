import { Batch } from "../models/batch.model";
import { WorkerAttendanceLogModel } from "../models/worker-attendance-log.model";
import type {
  IWorkerAttendanceMark,
  WorkerAttendanceStatus,
} from "../interfaces/worker-attendance.interface";
import { calculateHaversineDistanceMeters } from "../utils/geo.util";
import { logger } from "../config/logger";

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
 *
 * Dự án chưa đặt vị trí thì không chặn — công trường mới lập chưa kịp cấu hình
 * vẫn phải chấm công được, chỉ là không có bằng chứng khoảng cách.
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
 * Trạng thái ngày công dựa trên giờ bắt đầu/kết thúc của chính dự án — lao động
 * không có ca làm việc riêng như nhân sự, nên giờ dự án là chuẩn duy nhất.
 * Chưa bấm giờ về thì để "missing-checkout" chứ không tự suy ra giờ về.
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
  studentId: string;
  batchId: string;
  ownerId: string | string[];
  branchId?: string;
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

function buildOwnerQuery(ownerId: string | string[]): Record<string, unknown> {
  if (ownerId === "ALL") return {};
  return { ownerId: Array.isArray(ownerId) ? { $in: ownerId } : ownerId };
}

export class WorkerAttendanceService {
  /**
   * Ghi một lần bấm. Lần đầu trong ngày là giờ vào, lần sau là giờ về — người
   * dùng ở công trường chỉ có một nút, không phải chọn loại.
   */
  static async mark(input: MarkAttendanceInput): Promise<MarkAttendanceResult> {
    const now = input.at ?? new Date();
    const date = vietnamWorkDate(now);

    const batch = await Batch.findOne({ _id: input.batchId, ...buildOwnerQuery(input.ownerId) });
    if (!batch) {
      throw new WorkerAttendanceError("batch_not_found", "Không tìm thấy dự án.");
    }
    if (!batch.learnerIds.includes(input.studentId)) {
      throw new WorkerAttendanceError("not_in_batch", "Lao động không thuộc dự án này.");
    }

    const distanceMeters = assertWithinProjectRadius(batch.geoLocation, input.latitude, input.longitude);

    const mark: IWorkerAttendanceMark = {
      time: now,
      latitude: input.latitude,
      longitude: input.longitude,
      distanceMeters,
      deviceInfo: input.deviceInfo || "",
      ipAddress: input.ipAddress || "",
      recordedBy: input.recordedBy || "",
    };

    const existing = await WorkerAttendanceLogModel.findOne({
      studentId: input.studentId,
      batchId: input.batchId,
      date,
    });

    if (!existing) {
      const created = await WorkerAttendanceLogModel.create({
        studentId: input.studentId,
        batchId: input.batchId,
        ownerId: String(batch.ownerId),
        branchId: input.branchId ?? (batch as unknown as { branchId?: string }).branchId,
        date,
        checkIn: mark,
        status: resolveAttendanceStatus(now, null, batch.startTime, batch.endTime),
      });
      logger.info(`[WorkerAttendance] check-in: student=${input.studentId} batch=${input.batchId} date=${date}`);
      return { kind: "check-in", date, status: created.status, distanceMeters };
    }

    if (!existing.checkIn) {
      existing.checkIn = mark;
      existing.status = resolveAttendanceStatus(now, existing.checkOut?.time ?? null, batch.startTime, batch.endTime);
      await existing.save();
      return { kind: "check-in", date, status: existing.status, distanceMeters };
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

    existing.checkOut = mark;
    existing.workedMinutes = calculateWorkedMinutes(new Date(existing.checkIn.time), now);
    existing.status = resolveAttendanceStatus(new Date(existing.checkIn.time), now, batch.startTime, batch.endTime);
    await existing.save();

    logger.info(`[WorkerAttendance] check-out: student=${input.studentId} batch=${input.batchId} date=${date}`);
    return {
      kind: "check-out",
      date,
      status: existing.status,
      workedMinutes: existing.workedMinutes,
      distanceMeters,
    };
  }

  /** Bảng chấm công của một dự án trong một ngày. */
  static async listByBatchDate(ownerId: string | string[], batchId: string, date: string) {
    return WorkerAttendanceLogModel.find({ ...buildOwnerQuery(ownerId), batchId, date })
      .sort({ "checkIn.time": 1 })
      .lean();
  }

  /** Lịch sử chấm công của một dự án trong khoảng ngày, để tổng hợp công. */
  static async listByBatchRange(ownerId: string | string[], batchId: string, from: string, to: string) {
    return WorkerAttendanceLogModel.find({
      ...buildOwnerQuery(ownerId),
      batchId,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: -1 })
      .lean();
  }

  /**
   * Quản lý sửa tay một bản ghi (bù giờ về bị quên, chỉnh sai giờ). Chỉ đụng tới
   * mốc thời gian và ghi chú — bằng chứng GPS của lần bấm gốc giữ nguyên.
   */
  static async adjust(
    ownerId: string | string[],
    logId: string,
    changes: { checkInAt?: string | null; checkOutAt?: string | null; note?: string },
    actorId: string
  ) {
    const log = await WorkerAttendanceLogModel.findOne({ _id: logId, ...buildOwnerQuery(ownerId) });
    if (!log) throw new WorkerAttendanceError("log_not_found", "Không tìm thấy bản ghi chấm công.");

    const batch = await Batch.findById(log.batchId);
    if (!batch) throw new WorkerAttendanceError("batch_not_found", "Không tìm thấy dự án.");

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

    if (log.checkIn?.time && log.checkOut?.time && log.checkOut.time < log.checkIn.time) {
      throw new WorkerAttendanceError("invalid_range", "Giờ về phải sau giờ vào.");
    }

    log.workedMinutes =
      log.checkIn?.time && log.checkOut?.time
        ? calculateWorkedMinutes(new Date(log.checkIn.time), new Date(log.checkOut.time))
        : undefined;
    log.status = log.checkIn?.time
      ? resolveAttendanceStatus(
          new Date(log.checkIn.time),
          log.checkOut?.time ? new Date(log.checkOut.time) : null,
          batch.startTime,
          batch.endTime
        )
      : "missing-checkout";

    await log.save();
    return log.toObject();
  }
}
