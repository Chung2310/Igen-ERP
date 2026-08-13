import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { UserModel } from "../model/user.model";
import { getDayContext, toVietnamDate } from "../service/company-work-calendar.service";
import { resolveShift, shiftWindow, vietnamWorkDate } from "../service/work-shift.service";
import { attendanceResourceService } from "../service/attendance-resource.service";
import { BranchModel } from "../model/branch.model";
import { AttendanceAttemptModel } from "../model/attendance-attempt.model";
import { BranchAttendanceGateError, validateBranchAttendance } from "../service/branch-attendance-gate.service";
import { getRequestPublicIp } from "../utils/request-ip";

const attendanceAction = (req: AuthenticatedRequest) => req.path.includes("check-out") ? "check-out" as const : "check-in" as const;
async function enforceBranchAttendance(req: AuthenticatedRequest, latitude: number, longitude: number) {
  if ((req as any).attendanceBranchGate) return (req as any).attendanceBranchGate;
  const base = { uid: req.user!.id, companyCode: req.user?.companyCode || "SYSTEM", branchId: req.user?.branchId,
    action: attendanceAction(req), latitude, longitude, ipAddress: getRequestPublicIp(req), attemptedAt: new Date() };
  if (!req.user?.branchId) {
    await AttendanceAttemptModel.create({ ...base, outcome: "rejected", reasonCode: "branch_missing" });
    throw new BranchAttendanceGateError("branch_attendance_not_configured");
  }
  const branch = await BranchModel.findOne({ _id: req.user.branchId, companyCode: base.companyCode, isActive: true }).lean();
  try {
    const result = validateBranchAttendance({ branch, latitude, longitude, requestIp: base.ipAddress });
    return { ...base, ...result };
  } catch (error) {
    const gateError = error as BranchAttendanceGateError;
    await AttendanceAttemptModel.create({ ...base, distance: gateError.distance, outcome: "rejected", reasonCode: gateError.reasonCode });
    throw error;
  }
}

const gateMessage = (reasonCode: string) => reasonCode === "outside_radius" ? "Bạn đang ở ngoài khu vực chấm công của chi nhánh."
  : reasonCode === "network_not_allowed" ? "Bạn phải kết nối đúng mạng Wi-Fi của chi nhánh để chấm công."
  : "Chi nhánh chưa cấu hình đầy đủ vị trí và mạng chấm công. Vui lòng liên hệ quản trị viên.";

async function indexAttendanceEvidence(req: AuthenticatedRequest, log: any, action: "check-in" | "check-out") {
  const evidence = (req as any).attendanceEvidence;
  if (!evidence) return;
  await attendanceResourceService.indexAcceptedEvidence({
    companyCode: req.user?.companyCode || "SYSTEM",
    branchId: req.user?.branchId,
    userId: req.user?.id || "",
    userLabel: req.user?.email || req.user?.id || "Nhân viên",
    recordId: String(log._id),
    action,
    mimeType: (req as any).file?.mimetype || "image/jpeg",
    evidence,
  });
}

// Haversine formula to compute distance in meters
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper to calculate attendance status based on check-in/out times and limits
function calculateAttendanceStatus(
  checkInTime: Date,
  checkOutTime: Date | null,
  config: {
    checkInLimit?: string;
    checkOutLimit?: string;
    lunchBreakStart?: string;
    lunchBreakEnd?: string;
  }
): string {
  const parseTimeToMinutes = (timeStr?: string, defaultVal: number = 0): number => {
    if (!timeStr) return defaultVal;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const T_in_limit = parseTimeToMinutes(config.checkInLimit, 8 * 60 + 30); // default 08:30
  const T_out_limit = parseTimeToMinutes(config.checkOutLimit, 17 * 60 + 30); // default 17:30
  const T_lunch_start = parseTimeToMinutes(config.lunchBreakStart, 12 * 60); // default 12:00
  const T_lunch_end = parseTimeToMinutes(config.lunchBreakEnd, 13 * 60); // default 13:00

  const getLocalMinutes = (date: Date): number => {
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localTime.getUTCHours() * 60 + localTime.getUTCMinutes();
  };

  const m_in = getLocalMinutes(checkInTime);

  if (!checkOutTime) {
    if (m_in >= T_lunch_start) {
      return "Half-Day";
    }
    if (m_in > T_in_limit) {
      return "Late";
    }
    return "Present";
  }

  const m_out = getLocalMinutes(checkOutTime);

  const onlyMorning = m_out <= T_lunch_end;
  const onlyAfternoon = m_in >= T_lunch_start;

  if (onlyMorning || onlyAfternoon) {
    return "Half-Day";
  }

  const isLate = m_in > T_in_limit;
  const isEarly = m_out < T_out_limit;

  if (isLate && isEarly) {
    return "Late-Left-Early";
  }
  if (isLate) {
    return "Late";
  }
  if (isEarly) {
    return "Left-Early";
  }
  return "Present";
}

function calculateShiftStatus(checkInTime: Date, checkOutTime: Date | null, scheduledStartAt: Date, scheduledEndAt: Date, allowedLateMinutes = 0, allowedEarlyLeaveMinutes = 0): string {
  const late = checkInTime.getTime() > scheduledStartAt.getTime() + allowedLateMinutes * 60_000;
  if (!checkOutTime) return late ? "Late" : "Present";
  const early = checkOutTime.getTime() < scheduledEndAt.getTime() - allowedEarlyLeaveMinutes * 60_000;
  if (late && early) return "Late-Left-Early";
  if (late) return "Late";
  if (early) return "Left-Early";
  return "Present";
}

export const timekeepingController = {
  /**
   * GET /api/v1/timekeeping/today
   */
  async getTodayStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const todayStr = vietnamWorkDate();
      const vietnamDate = toVietnamDate();

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      const yesterday = vietnamWorkDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const log = await TimekeepingLogModel.findOne({ uid, companyCode, $or: [{ date: todayStr }, { date: yesterday, checkOut: null }] }).sort({ date: -1 }).lean();
      const dayContext = await getDayContext(companyCode, vietnamDate);
      return res.status(200).json({
        status: "success",
        data: {
          log: log || null,
          workCalendar: {
            date: dayContext.date,
            isWorkingDay: dayContext.isWorkingDay,
            label: dayContext.label,
          },
        },
      });
    } catch (error: any) {
      console.error("[timekeepingController.getTodayStatus] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy trạng thái chấm công hôm nay.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/timekeeping/check-in
   */
  async checkIn(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { latitude, longitude, deviceInfo } = req.body;

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      let gate: Awaited<ReturnType<typeof enforceBranchAttendance>>;
      try { gate = await enforceBranchAttendance(req, Number(latitude), Number(longitude)); }
      catch (error) { const reasonCode = error instanceof BranchAttendanceGateError ? error.reasonCode : "branch_attendance_not_configured"; return res.status(400).json({ status: "error", reasonCode, message: gateMessage(reasonCode) }); }

      // 1. Get company location configuration or default fallback
      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const distance = gate.distance;

      const todayStr = vietnamWorkDate();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      const yesterday = vietnamWorkDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      let log = await TimekeepingLogModel.findOne({ uid, companyCode, $or: [{ date: todayStr }, { date: yesterday, checkIn: { $ne: null }, checkOut: null }] }).sort({ date: -1 });
      if (log && log.checkIn) {
        await AttendanceAttemptModel.create({ ...gate, outcome: "rejected", reasonCode: "already_checked_in", evidence: (req as any).attendanceEvidence, evidenceDeleteAfter: (req as any).attendanceEvidenceDeleteAfter });
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-in hôm nay rồi.",
        });
      }

      const now = new Date();
      const resolved = await resolveShift(companyCode, uid, todayStr);
      const { scheduledStartAt, scheduledEndAt } = shiftWindow(resolved.shift, todayStr);
      const status = calculateShiftStatus(now, null, scheduledStartAt, scheduledEndAt, resolved.shift.allowedLateMinutes) as any;

      const checkInDetail = {
        time: now,
        latitude,
        longitude,
        distance,
        deviceInfo: deviceInfo || "",
        ipAddress,
      };

      if (!log) {
        log = new TimekeepingLogModel({
          uid,
          companyCode,
          branchId: req.user?.branchId || undefined,
          date: todayStr,
          checkIn: checkInDetail,
          status,
          shiftId: resolved.shift._id ? String(resolved.shift._id) : undefined,
          shiftName: resolved.shift.name,
          shiftCode: resolved.shift.code,
          workDate: todayStr,
          scheduledStartAt,
          scheduledEndAt,
          standardMinutes: resolved.shift.standardMinutes,
          breakPeriods: resolved.shift.breakPeriods,
          assignmentSource: resolved.source,
        });
      } else {
        log.checkIn = checkInDetail;
        log.status = status as any;
        if (!log.branchId && req.user?.branchId) {
          log.branchId = req.user.branchId;
        }
      }

      await log.save();
      await indexAttendanceEvidence(req, log, "check-in");
      await AttendanceAttemptModel.create({ ...gate, outcome: "accepted", reasonCode: "verified", evidence: (req as any).attendanceEvidence, evidenceDeleteAfter: (req as any).attendanceEvidenceDeleteAfter });

      return res.status(200).json({
        status: "success",
        message: "Chấm công vào (Check-in) thành công!",
        data: log,
      });
    } catch (error: any) {
      console.error("[timekeepingController.checkIn] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi check-in.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/timekeeping/check-out
   */
  async checkOut(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const companyCode = req.user?.companyCode || "SYSTEM";
      const { latitude, longitude, deviceInfo } = req.body;

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      let gate: Awaited<ReturnType<typeof enforceBranchAttendance>>;
      try { gate = await enforceBranchAttendance(req, Number(latitude), Number(longitude)); }
      catch (error) { const reasonCode = error instanceof BranchAttendanceGateError ? error.reasonCode : "branch_attendance_not_configured"; return res.status(400).json({ status: "error", reasonCode, message: gateMessage(reasonCode) }); }

      // 1. Get company location configuration or default fallback
      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const distance = gate.distance;

      const todayStr = vietnamWorkDate();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      const yesterday = vietnamWorkDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
      const log = await TimekeepingLogModel.findOne({ uid, companyCode, date: { $in: [todayStr, yesterday] }, checkIn: { $ne: null }, checkOut: null }).sort({ date: -1 });
      if (!log || !log.checkIn) {
        await AttendanceAttemptModel.create({ ...gate, outcome: "rejected", reasonCode: "missing_check_in", evidence: (req as any).attendanceEvidence, evidenceDeleteAfter: (req as any).attendanceEvidenceDeleteAfter });
        return res.status(400).json({
          status: "error",
          message: "Bạn chưa thực hiện Check-in hôm nay. Không thể Check-out.",
        });
      }

      if (log.checkOut) {
        await AttendanceAttemptModel.create({ ...gate, outcome: "rejected", reasonCode: "already_checked_out", evidence: (req as any).attendanceEvidence, evidenceDeleteAfter: (req as any).attendanceEvidenceDeleteAfter });
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-out hôm nay rồi.",
        });
      }

      const checkOutTime = new Date();
      log.checkOut = {
        time: checkOutTime,
        latitude,
        longitude,
        distance,
        deviceInfo: deviceInfo || "",
        ipAddress,
      };

      if (log.scheduledStartAt && log.scheduledEndAt) {
        const resolved = await resolveShift(companyCode, uid, log.workDate || log.date);
        log.status = calculateShiftStatus(log.checkIn.time, checkOutTime, log.scheduledStartAt, log.scheduledEndAt, resolved.shift.allowedLateMinutes, resolved.shift.allowedEarlyLeaveMinutes) as any;
      } else {
        const me = await UserModel.findById(uid).select("workHoursConfig").lean();
        const custom = me?.workHoursConfig?.useCustom ? me.workHoursConfig : undefined;
        log.status = calculateAttendanceStatus(log.checkIn.time, checkOutTime, {
          checkInLimit: custom?.checkInLimit || company?.locationConfig?.checkInLimit || "08:30",
          checkOutLimit: custom?.checkOutLimit || company?.locationConfig?.checkOutLimit || "17:30",
          lunchBreakStart: custom?.lunchBreakStart || company?.locationConfig?.lunchBreakStart || "12:00",
          lunchBreakEnd: custom?.lunchBreakEnd || company?.locationConfig?.lunchBreakEnd || "13:00",
        }) as any;
      }

      if (!log.branchId && req.user?.branchId) {
        log.branchId = req.user.branchId;
      }

      await log.save();
      await indexAttendanceEvidence(req, log, "check-out");
      await AttendanceAttemptModel.create({ ...gate, outcome: "accepted", reasonCode: "verified", evidence: (req as any).attendanceEvidence, evidenceDeleteAfter: (req as any).attendanceEvidenceDeleteAfter });

      return res.status(200).json({
        status: "success",
        message: "Chấm công ra (Check-out) thành công!",
        data: log,
      });
    } catch (error: any) {
      console.error("[timekeepingController.checkOut] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi check-out.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/timekeeping/company-location
   */
  async getCompanyLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";
      const company = await CompanyModel.findOne({ code: companyCode }).lean();

      const fallbackConfig = {
        latitude: 10.7769,
        longitude: 106.7009,
        allowedRadius: 1000,
        addressName: "Tòa nhà Bitexco",
        checkInLimit: "08:30",
        checkOutLimit: "17:30",
        lunchBreakStart: "12:00",
        lunchBreakEnd: "13:00",
        workingDays: [1, 2, 3, 4, 5],
      };

      return res.status(200).json({
        status: "success",
        data: { ...fallbackConfig, ...(company?.locationConfig || {}), annualLeaveDays: company?.annualLeaveDays ?? 12 },
      });
    } catch (error: any) {
      console.error("[timekeepingController.getCompanyLocation] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy vị trí công ty.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/timekeeping/company-location
   */
  async updateCompanyLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const { latitude, longitude, allowedRadius, addressName, checkInLimit, checkOutLimit, lunchBreakStart, lunchBreakEnd, workingDays, annualLeaveDays } = req.body;

      const updatedCompany = await CompanyModel.findOneAndUpdate(
        { code: companyCode },
        {
          $set: {
            annualLeaveDays: Number.isInteger(annualLeaveDays) ? annualLeaveDays : 12,
            locationConfig: {
              latitude,
              longitude,
              allowedRadius,
              addressName: addressName || "",
              checkInLimit: checkInLimit || "08:30",
              checkOutLimit: checkOutLimit || "17:30",
              lunchBreakStart: lunchBreakStart || "12:00",
              lunchBreakEnd: lunchBreakEnd || "13:00",
              workingDays: workingDays || [1, 2, 3, 4, 5],

            },
          },
        },
        { new: true }
      ).lean();

      if (!updatedCompany) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy thông tin doanh nghiệp cần cập nhật.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật tọa độ chấm công doanh nghiệp thành công!",
        data: updatedCompany.locationConfig,
      });
    } catch (error: any) {
      console.error("[timekeepingController.updateCompanyLocation] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi cập nhật vị trí công ty.",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/timekeeping/work-hours
   */
  async listEmployeeWorkHours(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const users = await UserModel.find({ companyCode })
        .select("_id fullName email role employmentStatus officialDate workHoursConfig")
        .lean();

      return res.status(200).json({ status: "success", data: users });
    } catch (error: any) {
      console.error("[timekeepingController.listEmployeeWorkHours] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi lấy giờ làm việc nhân viên.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/timekeeping/work-hours/:uid
   */
  async updateEmployeeWorkHours(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode || "SYSTEM";

      const { uid } = req.params;
      const { useCustom, checkInLimit, checkOutLimit, lunchBreakStart, lunchBreakEnd, workingDays, annualLeaveDays, employmentStatus, officialDate } = req.body;

      const updatedUser = await UserModel.findOneAndUpdate(
        { _id: uid, companyCode },
        {
          $set: {
            workHoursConfig: {
              useCustom: !!useCustom,
              checkInLimit: checkInLimit || "08:30",
              checkOutLimit: checkOutLimit || "17:30",
              lunchBreakStart: lunchBreakStart || "12:00",
              lunchBreakEnd: lunchBreakEnd || "13:00",
              workingDays: workingDays || [1, 2, 3, 4, 5],
              annualLeaveDays: Number.isInteger(annualLeaveDays) ? annualLeaveDays : undefined,
              employmentStatus: employmentStatus || "official",
              officialDate: officialDate || undefined,
            },
          },
        },
        { new: true }
      )
        .select("_id fullName email role employmentStatus officialDate workHoursConfig")
        .lean();

      if (!updatedUser) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy nhân viên cần cập nhật.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật giờ làm việc nhân viên thành công!",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("[timekeepingController.updateEmployeeWorkHours] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi hệ thống khi cập nhật giờ làm việc nhân viên.",
        details: error.message,
      });
    }
  },
};
