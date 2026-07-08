import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { CompanyModel } from "../model/company.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";

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

// Helper to get local date string YYYY-MM-DD
function getLocalDateString(): string {
  const localOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - localOffset).toISOString().slice(0, 10);
}

export const timekeepingController = {
  /**
   * GET /api/v1/timekeeping/today
   */
  async getTodayStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const uid = req.user?.id;
      const todayStr = getLocalDateString();

      if (!uid) {
        return res.status(401).json({
          status: "error",
          message: "Không xác định được danh tính nhân sự.",
        });
      }

      const log = await TimekeepingLogModel.findOne({ uid, date: todayStr }).lean();
      return res.status(200).json({
        status: "success",
        data: log || null,
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

      // 1. Get company location configuration or default fallback
      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const officeLat = company?.locationConfig?.latitude ?? 10.7769;
      const officeLon = company?.locationConfig?.longitude ?? 106.7009;
      const allowedRadius = company?.locationConfig?.allowedRadius ?? 1000;

      // 2. Compute distance
      const distance = calculateHaversineDistance(latitude, longitude, officeLat, officeLon);

      if (distance > allowedRadius) {
        return res.status(400).json({
          status: "error",
          message: `Bạn đang ở ngoài khu vực chấm công cho phép. Khoảng cách hiện tại: ${Math.round(distance)}m (Giới hạn: ${allowedRadius}m).`,
        });
      }

      const todayStr = getLocalDateString();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      let log = await TimekeepingLogModel.findOne({ uid, date: todayStr });
      if (log && log.checkIn) {
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-in hôm nay rồi.",
        });
      }

      // Check-in after the configured limit local time is marked as Late
      const now = new Date();
      const checkInLimitStr = company?.locationConfig?.checkInLimit || "08:30";
      const [limitHours, limitMinutes] = checkInLimitStr.split(":").map(Number);

      // Adjust to local time zone for checking hour/minutes
      const localTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
      const hours = localTime.getUTCHours();
      const minutes = localTime.getUTCMinutes();
      const isLate = hours > limitHours || (hours === limitHours && minutes > limitMinutes);
      const status = isLate ? "Late" : "Present";

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
          date: todayStr,
          checkIn: checkInDetail,
          status,
        });
      } else {
        log.checkIn = checkInDetail;
        log.status = status;
      }

      await log.save();

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

      // 1. Get company location configuration or default fallback
      const company = await CompanyModel.findOne({ code: companyCode }).lean();
      const officeLat = company?.locationConfig?.latitude ?? 10.7769;
      const officeLon = company?.locationConfig?.longitude ?? 106.7009;
      const allowedRadius = company?.locationConfig?.allowedRadius ?? 1000;

      // 2. Compute distance
      const distance = calculateHaversineDistance(latitude, longitude, officeLat, officeLon);

      if (distance > allowedRadius) {
        return res.status(400).json({
          status: "error",
          message: `Bạn đang ở ngoài khu vực chấm công cho phép. Khoảng cách hiện tại: ${Math.round(distance)}m (Giới hạn: ${allowedRadius}m).`,
        });
      }

      const todayStr = getLocalDateString();
      const ipAddress = req.ip || (req.headers["x-forwarded-for"] as string) || "";

      const log = await TimekeepingLogModel.findOne({ uid, date: todayStr });
      if (!log || !log.checkIn) {
        return res.status(400).json({
          status: "error",
          message: "Bạn chưa thực hiện Check-in hôm nay. Không thể Check-out.",
        });
      }

      if (log.checkOut) {
        return res.status(400).json({
          status: "error",
          message: "Bạn đã thực hiện check-out hôm nay rồi.",
        });
      }

      log.checkOut = {
        time: new Date(),
        latitude,
        longitude,
        distance,
        deviceInfo: deviceInfo || "",
        ipAddress,
      };

      await log.save();

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
      };

      return res.status(200).json({
        status: "success",
        data: company?.locationConfig || fallbackConfig,
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
      const userRole = req.user?.role || "user";

      if (userRole !== "superadmin" && userRole !== "admin" && userRole !== "manager") {
        return res.status(403).json({
          status: "error",
          message: "Bạn không có quyền thay đổi cấu hình vị trí của công ty.",
        });
      }

      const { latitude, longitude, allowedRadius, addressName, checkInLimit, checkOutLimit } = req.body;

      const updatedCompany = await CompanyModel.findOneAndUpdate(
        { code: companyCode },
        {
          $set: {
            locationConfig: {
              latitude,
              longitude,
              allowedRadius,
              addressName: addressName || "",
              checkInLimit: checkInLimit || "08:30",
              checkOutLimit: checkOutLimit || "17:30",
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
};
