import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../middlewares/auth.middleware";

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const user = await AuthService.register(req.body);
      res.status(201).json({
        success: true,
        data: {
          uid: user._id.toString(),
          email: user.email,
          displayName: user.displayName,
        },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { user, accessToken, refreshToken } = await AuthService.login(
        req.body,
      );

      // Set refresh token cookie
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          user,
          accessToken,
        },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const token = req.cookies.refreshToken;
      if (!token) {
        return res
          .status(401)
          .json({ success: false, error: "Không tìm thấy Refresh Token." });
      }

      const { accessToken, user } = await AuthService.verifyRefreshToken(token);
      res.json({
        success: true,
        data: {
          user,
          accessToken,
        },
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Token không hợp lệ.";
      res.status(401).json({ success: false, error: msg });
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie("refreshToken");
      res.json({ success: true, message: "Đăng xuất thành công." });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      const user = await AuthService.getUserProfile(req.user.uid);
      const smsSettings = await AuthService.getSmsSettings(req.user.uid);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "Không tìm thấy người dùng." });
      }
      let bankAccountNo = user.bankAccountNo || "";
      let bankId = user.bankId || "";
      let bankAccountName = user.bankAccountName || "";
      let bankQrEnabled = user.bankQrEnabled !== false;

      if (user.role === "user" && user.centerId) {
        const adminUser = await AuthService.getUserProfile(user.centerId);
        if (adminUser) {
          bankAccountNo = adminUser.bankAccountNo || "";
          bankId = adminUser.bankId || "";
          bankAccountName =
            adminUser.bankAccountName || adminUser.displayName || "";
          bankQrEnabled = adminUser.bankQrEnabled !== false;
        }
      }

      res.json({
        success: true,
        data: {
          user: {
            uid: user._id.toString(),
            email: user.email,
            displayName: user.displayName,
            role: user.role,
            centerId: user.centerId,
            bankAccountNo,
            bankId,
            bankAccountName,
            bankQrEnabled,
            businessType: user.businessType || "driving",
            smsSettings: smsSettings
              ? {
                  provider: smsSettings.provider,
                  twilioAccountSid: smsSettings.twilioAccountSid,
                  twilioAuthToken: smsSettings.twilioAuthToken,
                  twilioFromNumber: smsSettings.twilioFromNumber,
                  twilioMessagingServiceSid:
                    smsSettings.twilioMessagingServiceSid,
                  twilioStatusCallbackUrl: smsSettings.twilioStatusCallbackUrl,
                  stringeeApiUrl: smsSettings.stringeeApiUrl,
                  stringeeApiKey: smsSettings.stringeeApiKey,
                  stringeeSecretKey: smsSettings.stringeeSecretKey,
                  stringeeBrandname: smsSettings.stringeeBrandname,
                  stringeeSender: smsSettings.stringeeSender,
                  stringeeStatusCallbackUrl:
                    smsSettings.stringeeStatusCallbackUrl,
                  tingtingApiKey: smsSettings.tingtingApiKey,
                  tingtingSender: smsSettings.tingtingSender,
                }
              : null,
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getUserBankSettings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      const targetUser = await AuthService.getUserProfile(req.params.id);
      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, error: "Không tìm thấy người dùng." });
      }

      let adminUser = targetUser;
      if (targetUser.role === "user" && targetUser.centerId) {
        const resolvedAdmin = await AuthService.getUserProfile(
          targetUser.centerId,
        );
        if (resolvedAdmin) {
          adminUser = resolvedAdmin;
        }
      }

      res.json({
        success: true,
        data: {
          bankAccountNo: adminUser.bankAccountNo || "",
          bankId: adminUser.bankId || "",
          bankAccountName:
            adminUser.bankAccountName || adminUser.displayName || "",
          bankQrEnabled: adminUser.bankQrEnabled !== false,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async updateBankSettings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      if (req.user.role === "user") {
        return res
          .status(403)
          .json({
            success: false,
            error: "Nhân viên không có quyền thay đổi cấu hình ngân hàng.",
          });
      }
      const updatedUser = await AuthService.updateBankSettings(
        req.user.uid,
        req.body,
      );
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, error: "Không tìm thấy người dùng." });
      }
      res.json({
        success: true,
        data: {
          user: {
            uid: updatedUser._id.toString(),
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            role: updatedUser.role,
            centerId: updatedUser.centerId,
            bankAccountNo: updatedUser.bankAccountNo,
            bankId: updatedUser.bankId,
            bankAccountName: updatedUser.bankAccountName,
            bankQrEnabled: updatedUser.bankQrEnabled,
            businessType: updatedUser.businessType || "driving",
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async updateSmsSettings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      const settings = await AuthService.updateSmsSettings(
        req.user.uid,
        req.body,
      );
      res.json({
        success: true,
        data: {
          smsSettings: {
            provider: settings.provider,
            twilioAccountSid: settings.twilioAccountSid,
            twilioAuthToken: settings.twilioAuthToken,
            twilioFromNumber: settings.twilioFromNumber,
            twilioMessagingServiceSid: settings.twilioMessagingServiceSid,
            twilioStatusCallbackUrl: settings.twilioStatusCallbackUrl,
            stringeeApiUrl: settings.stringeeApiUrl,
            stringeeApiKey: settings.stringeeApiKey,
            stringeeSecretKey: settings.stringeeSecretKey,
            stringeeBrandname: settings.stringeeBrandname,
            stringeeSender: settings.stringeeSender,
            stringeeStatusCallbackUrl: settings.stringeeStatusCallbackUrl,
            tingtingApiKey: settings.tingtingApiKey,
            tingtingSender: settings.tingtingSender,
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chua xac thuc." });
      }
      const users = await AuthService.listUsers(req.user);
      res.json({ success: true, data: { users } });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chua xac thuc." });
      }
      const user = await AuthService.createManagedUser(req.user, req.body);
      res.status(201).json({ success: true, data: { user } });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      const updatedUser = await AuthService.updateManagedUser(
        req.user,
        req.params.id,
        req.body,
      );
      res.json({ success: true, data: { user: updatedUser } });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      await AuthService.deleteManagedUser(req.user, req.params.id);
      res.json({ success: true, message: "Đã xóa người dùng thành công." });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async updateBusinessSettings(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: "Chưa xác thực." });
      }
      if (req.user.role === "user") {
        return res
          .status(403)
          .json({
            success: false,
            error: "Nhân viên không có quyền thay đổi lĩnh vực đào tạo.",
          });
      }
      const updatedUser = await AuthService.updateBusinessSettings(
        req.user.uid,
        req.body,
      );
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, error: "Không tìm thấy người dùng." });
      }
      res.json({
        success: true,
        data: {
          user: {
            uid: updatedUser._id.toString(),
            email: updatedUser.email,
            displayName: updatedUser.displayName,
            role: updatedUser.role,
            centerId: updatedUser.centerId,
            bankAccountNo: updatedUser.bankAccountNo,
            bankId: updatedUser.bankId,
            businessType: updatedUser.businessType || "driving",
          },
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async getTeacherPublicInfo(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = await AuthService.getUserProfile(req.params.id);
      if (!user || user.isActive === false) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              "Không tìm thấy thông tin giáo viên hoặc tài khoản đã bị khóa.",
          });
      }
      res.json({
        success: true,
        data: {
          displayName: user.displayName,
          centerId: user.centerId,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  }
}
