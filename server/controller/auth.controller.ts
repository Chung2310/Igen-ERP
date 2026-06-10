import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import { AuthenticatedRequest } from "../middleware/auth";

export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    try {
      const user = await authService.register(req.body);
      const userObj = user.toObject();
      delete userObj.password;

      return res.status(201).json({
        status: "success",
        message: "Đăng ký tài khoản thành công",
        data: userObj,
      });
    } catch (error: any) {
      console.error("[authController.register] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký tài khoản",
      });
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const { user, accessToken, refreshToken } = await authService.login(email, password);

      // Lưu Refresh Token vào HTTPOnly Cookie bảo mật
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      });

      const userObj = user.toObject();
      delete userObj.password;

      return res.status(200).json({
        status: "success",
        message: "Đăng nhập thành công",
        accessToken,
        user: userObj,
      });
    } catch (error: any) {
      console.error("[authController.login] Error:", error);
      return res.status(401).json({
        status: "error",
        message: error.message || "Đăng nhập thất bại",
      });
    }
  },

  /**
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req: Request, res: Response) {
    try {
      // Ưu tiên đọc từ Cookies
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          status: "error",
          message: "Yêu cầu mã làm mới (Refresh Token).",
        });
      }

      const { accessToken } = await authService.refresh(refreshToken);
      return res.status(200).json({
        status: "success",
        accessToken,
      });
    } catch (error: any) {
      console.error("[authController.refreshToken] Error:", error);
      return res.status(401).json({
        status: "error",
        message: error.message || "Làm mới mã truy cập thất bại",
      });
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response) {
    try {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      return res.status(200).json({
        status: "success",
        message: "Đăng xuất tài khoản thành công",
      });
    } catch (error: any) {
      console.error("[authController.logout] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi đăng xuất",
      });
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const user = await authService.getMe(userId);
      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy hồ sơ người dùng.",
        });
      }

      return res.status(200).json({
        status: "success",
        user,
      });
    } catch (error: any) {
      console.error("[authController.getMe] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy thông tin người dùng",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/auth/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const updatedUser = await authService.updateProfile(userId, req.body);
      if (!updatedUser) {
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy hồ sơ người dùng.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật hồ sơ người dùng thành công",
        user: updatedUser,
      });
    } catch (error: any) {
      console.error("[authController.updateProfile] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể cập nhật hồ sơ người dùng",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/auth/change-password
   */
  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      await authService.changePassword(userId, password);
      return res.status(200).json({
        status: "success",
        message: "Thay đổi mật khẩu thành công",
      });
    } catch (error: any) {
      console.error("[authController.changePassword] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể thay đổi mật khẩu",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/auth/register-company
   * (Chỉ dành cho superadmin)
   */
  async registerCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await authService.registerCompanyAndAdmin(req.body);
      const adminObj = result.admin.toObject();
      delete adminObj.password;

      return res.status(201).json({
        status: "success",
        message: "Đăng ký doanh nghiệp và tài khoản Admin thành công",
        data: {
          company: result.company,
          admin: adminObj,
        },
      });
    } catch (error: any) {
      console.error("[authController.registerCompany] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký doanh nghiệp",
      });
    }
  },

  /**
   * POST /api/v1/auth/register-user
   * (Dành cho superadmin hoặc admin)
   */
  async registerUser(req: AuthenticatedRequest, res: Response) {
    try {
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      if (callerRole !== "superadmin") {
        // Chỉ superadmin mới được đăng ký user cho công ty khác
        req.body.companyCode = callerCompanyCode;
      }

      const newUser = await authService.registerUserForCompany(req.body, callerCompanyCode, callerRole);
      const userObj = newUser.toObject();
      delete userObj.password;

      return res.status(201).json({
        status: "success",
        message: "Đăng ký thành viên doanh nghiệp thành công",
        data: userObj,
      });
    } catch (error: any) {
      console.error("[authController.registerUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký thành viên",
      });
    }
  },

  /**
   * GET /api/v1/auth/users
   */
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      let companyCode = req.query.companyCode as string;

      // Bảo vệ dữ liệu đa doanh nghiệp (Tenant Isolation)
      if (req.user?.role !== "superadmin") {
        companyCode = req.user?.companyCode;
      }

      const filter = companyCode ? { companyCode } : {};
      const users = await authService.getUsers(filter);

      return res.status(200).json({
        status: "success",
        data: users,
      });
    } catch (error: any) {
      console.error("[authController.getUsers] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách nhân sự",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/auth/companies
   * (Chỉ dành cho superadmin)
   */
  async getCompanies(req: AuthenticatedRequest, res: Response) {
    try {
      const companies = await authService.getAllCompanies();
      return res.status(200).json({
        status: "success",
        data: companies,
      });
    } catch (error: any) {
      console.error("[authController.getCompanies] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách doanh nghiệp",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/auth/users/bulk
   */
  async bulkUpdateUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      await authService.bulkUpdateUsers(req.body.updates, callerCompanyCode!, callerRole!);

      return res.status(200).json({
        status: "success",
        message: "Cập nhật cấu trúc nhân sự thành công",
      });
    } catch (error: any) {
      console.error("[authController.bulkUpdateUsers] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật cấu trúc nhân sự",
      });
    }
  },

  /**
   * PATCH /api/v1/auth/users/:id
   */
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      const updatedUser = await authService.updateUser(id, req.body, callerCompanyCode!, callerRole!);

      return res.status(200).json({
        status: "success",
        message: "Cập nhật thông tin nhân sự thành công",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("[authController.updateUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật thông tin nhân sự",
      });
    }
  },

  /**
   * DELETE /api/v1/auth/users/:id
   */
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      await authService.deleteUser(id, callerCompanyCode!, callerRole!);

      return res.status(200).json({
        status: "success",
        message: "Xóa nhân sự thành công",
      });
    } catch (error: any) {
      console.error("[authController.deleteUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể xóa nhân sự",
      });
    }
  },
};
